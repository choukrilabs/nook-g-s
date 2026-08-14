import { supabase } from './supabase';
import { useSessionStore } from '../stores/sessionStore';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import Dexie from 'dexie';
import { db } from './offlineDB';
import { readJson, writeJson } from './storage';
import { ClientAccount, Product, Session, Staff } from '../types';

export interface SyncOperation {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  timestamp: number;
  retries?: number;
}

const getQueue = (): SyncOperation[] => readJson<SyncOperation[]>('nook-sync-queue', []);

const saveQueue = (queue: SyncOperation[]) => {
  writeJson('nook-sync-queue', queue);
};

const syncTable = async <T extends { id: string; cafe_id: string }>(
  table: Dexie.Table<T, string>,
  cafeId: string,
  rows: T[],
) => {
  const serverIds = new Set(rows.map((row) => row.id));
  const cachedRows = await table.where('cafe_id').equals(cafeId).toArray();
  const staleIds = cachedRows
    .filter((row) => !serverIds.has(row.id))
    .map((row) => row.id);

  await db.transaction('rw', table, async () => {
    if (staleIds.length > 0) await table.bulkDelete(staleIds);
    if (rows.length > 0) await table.bulkPut(rows);
  });
};

let isProcessingQueue = false;

const getPayloadId = (payload: Record<string, unknown>): string => {
  if (typeof payload.id !== 'string') {
    throw new Error('Queued offline mutation is missing a string id');
  }
  return payload.id;
};

const putOfflineRecord = async (table: string, payload: Record<string, unknown>) => {
  if (table === 'products') await db.products.put(payload as unknown as Product);
  if (table === 'client_accounts') await db.clients.put(payload as unknown as ClientAccount);
  if (table === 'staff') await db.staff.put(payload as unknown as Staff);
  if (table === 'sessions') await db.sessions.put(payload as unknown as Session);
};

const deleteOfflineRecord = async (table: string, payload: Record<string, unknown>) => {
  const id = getPayloadId(payload);
  if (table === 'products') await db.products.delete(id);
  if (table === 'client_accounts') await db.clients.delete(id);
  if (table === 'staff') await db.staff.delete(id);
  if (table === 'sessions') await db.sessions.delete(id);
};

export const syncDataToOfflineDB = async (cafeId: string) => {
  if (!navigator.onLine || !cafeId) return;

  try {
    const [productsRes, clientsRes, staffRes, sessionsRes] = await Promise.all([
      supabase.from('products').select('*').eq('cafe_id', cafeId),
      supabase.from('client_accounts').select('*').eq('cafe_id', cafeId),
      supabase.from('staff').select('*').eq('cafe_id', cafeId),
      supabase.from('sessions').select('*').eq('cafe_id', cafeId)
        .gte('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    ]);

    if (productsRes.data) await syncTable(db.products, cafeId, productsRes.data);
    if (clientsRes.data) await syncTable(db.clients, cafeId, clientsRes.data);
    if (staffRes.data) await syncTable(db.staff, cafeId, staffRes.data);
    if (sessionsRes.data) await syncTable(db.sessions, cafeId, sessionsRes.data);

  } catch (err) {
    console.error("Failed to sync offline DB", err);
  }
};

export const queueMutation = async (
  table: string, 
  action: 'insert' | 'update' | 'delete', 
  payload: Record<string, unknown>,
  optimisticData?: Record<string, unknown>
) => {
  if (navigator.onLine) {
    // Try online execution first
    try {
      let query = supabase.from(table);
      let response;
      if (action === 'insert') {
        response = await query.insert(payload).select().single();
      } else if (action === 'update') {
        response = await query.update(payload).eq('id', getPayloadId(payload)).select().single();
      } else if (action === 'delete') {
        response = await query.delete().eq('id', getPayloadId(payload));
      }
      
      if (response && response.error) throw response.error;
      return response ? response.data : null;
    } catch (e: any) {
      if (!e.message?.includes('Failed to fetch') && navigator.onLine) {
        throw e; // Real error from database
      }
      // If it failed due to network, fallback to offline queue
    }
  }

  // Handle offline fallback
  const queue = getQueue();
  const opId = crypto.randomUUID();
  queue.push({
    id: opId,
    table,
    action,
    payload,
    timestamp: Date.now()
  });
  saveQueue(queue);

  // Optimistic update
  if (table === 'sessions') {
    const { addSession, updateSession, removeSession } = useSessionStore.getState();
    if (action === 'insert') {
      addSession((optimisticData || { ...payload, id: opId }) as unknown as Session);
    } else if (action === 'update') {
      if ((optimisticData || payload).status !== 'active') {
         removeSession(getPayloadId(payload));
      } else {
         updateSession((optimisticData || payload) as unknown as Session);
      }
    }
  }

  // Save to OfflineDB for local reads immediately
  try {
     const dataToStore = optimisticData || { ...payload, id: opId };
     if (action === 'insert' || action === 'update') {
        await putOfflineRecord(table, dataToStore);
     } else if (action === 'delete') {
        await deleteOfflineRecord(table, payload);
     }
  } catch(e) {
     console.error("Could not optimistically write to OfflineDB", e);
  }

  useUIStore.getState().addToast("Sauvegardé hors ligne (sync lors de la reconnexion)", "info");
  
  return optimisticData || { ...payload, id: opId };
};

export const processSyncQueue = async () => {
  if (!navigator.onLine || isProcessingQueue) return;

  isProcessingQueue = true;
  const queue = getQueue();
  if (queue.length === 0) {
    isProcessingQueue = false;
    return;
  }

  let newQueue = [...queue];
  let hasErrors = false;

  try {
  for (const op of queue) {
    try {
      let query = supabase.from(op.table);
      
      let payload = { ...op.payload };
      // We explicitly keep the UUID so it matches the client-side generated one

      let error = null;
      if (op.action === 'insert') {
        const { error: err } = await query.insert(payload);
        error = err;
      } else if (op.action === 'update') {
        const { error: err } = await query.update(payload).eq('id', getPayloadId(payload));
        error = err;
      } else if (op.action === 'delete') {
        const { error: err } = await query.delete().eq('id', getPayloadId(payload));
        error = err;
      }

      if (error) {
        throw error;
      }

      // Sync offline DB immediately for local consistancy
      if (op.action === 'insert' || op.action === 'update') {
         await putOfflineRecord(op.table, payload);
      } else if (op.action === 'delete') {
         await deleteOfflineRecord(op.table, payload);
      }

      // Remove from queue upon success
      newQueue = newQueue.filter(item => item.id !== op.id);
    } catch (e: any) {
      console.error('Sync failed for op', op, e);
      
      // Do not increment retry count for network errors
      if (e.message?.includes('Failed to fetch') || !navigator.onLine) {
        hasErrors = true;
        continue;
      }
      
      hasErrors = true;
      
      const opIndex = newQueue.findIndex(item => item.id === op.id);
      if (opIndex !== -1) {
         newQueue[opIndex].retries = (newQueue[opIndex].retries || 0) + 1;
         
         if (newQueue[opIndex].retries! >= 3) {
            newQueue = newQueue.filter(item => item.id !== op.id);
            useUIStore.getState().addToast(
              `L'opération hors-ligne (${op.action} sur ${op.table}) a échoué 3 fois. Elle a été supprimée de la file d'attente pour éviter les blocages.`, 
              "error"
            );
         }
      }
    }
  }

  saveQueue(newQueue);
  if (!hasErrors && queue.length > 0) {
    useUIStore.getState().addToast("Données synchronisées avec le serveur", "success");
  }

  // Optionnally refresh full offline db when queue is fully cleared
  const state = useAuthStore.getState();
  if (state.cafe) {
     await syncDataToOfflineDB(state.cafe.id);
  }
  } finally {
    isProcessingQueue = false;
  }
};

window.addEventListener('online', () => {
  processSyncQueue();
  const state = useAuthStore.getState();
  if (state.cafe) {
     syncDataToOfflineDB(state.cafe.id);
  }
});
