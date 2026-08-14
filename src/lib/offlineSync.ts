import { supabase } from './supabase';
import { useSessionStore } from '../stores/sessionStore';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { db } from './offlineDB';

export interface SyncOperation {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  payload: any;
  timestamp: number;
  retries?: number;
}

const getQueue = (): SyncOperation[] => {
  const queue = localStorage.getItem('nook-sync-queue');
  return queue ? JSON.parse(queue) : [];
};

const saveQueue = (queue: SyncOperation[]) => {
  localStorage.setItem('nook-sync-queue', JSON.stringify(queue));
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

    if (productsRes.data) await db.products.bulkPut(productsRes.data);
    if (clientsRes.data) await db.clients.bulkPut(clientsRes.data);
    if (staffRes.data) await db.staff.bulkPut(staffRes.data);
    if (sessionsRes.data) await db.sessions.bulkPut(sessionsRes.data);

  } catch (err) {
    console.error("Failed to sync offline DB", err);
  }
};

export const queueMutation = async (
  table: string, 
  action: 'insert' | 'update' | 'delete', 
  payload: any, 
  optimisticData?: any
) => {
  if (navigator.onLine) {
    // Try online execution first
    try {
      let query = supabase.from(table);
      let response;
      if (action === 'insert') {
        response = await query.insert(payload).select().single();
      } else if (action === 'update') {
        response = await query.update(payload).eq('id', payload.id).select().single();
      } else if (action === 'delete') {
        response = await query.delete().eq('id', payload.id);
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
      addSession(optimisticData || { ...payload, id: opId });
    } else if (action === 'update') {
      if ((optimisticData || payload).status !== 'active') {
         removeSession(payload.id);
      } else {
         updateSession(optimisticData || payload);
      }
    }
  }

  // Save to OfflineDB for local reads immediately
  try {
     const dataToStore = optimisticData || { ...payload, id: opId };
     if (action === 'insert' || action === 'update') {
        if (table === 'products') await db.products.put(dataToStore);
        if (table === 'client_accounts') await db.clients.put(dataToStore);
        if (table === 'staff') await db.staff.put(dataToStore);
        if (table === 'sessions') await db.sessions.put(dataToStore);
     } else if (action === 'delete') {
        if (table === 'products') await db.products.delete(payload.id);
        if (table === 'client_accounts') await db.clients.delete(payload.id);
        if (table === 'staff') await db.staff.delete(payload.id);
        if (table === 'sessions') await db.sessions.delete(payload.id);
     }
  } catch(e) {
     console.error("Could not optimistically write to OfflineDB", e);
  }

  useUIStore.getState().addToast("Sauvegardé hors ligne (sync lors de la reconnexion)", "info");
  
  return optimisticData || { ...payload, id: opId };
};

export const processSyncQueue = async () => {
  if (!navigator.onLine) return;

  const queue = getQueue();
  if (queue.length === 0) return;

  let newQueue = [...queue];
  let hasErrors = false;

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
        const { error: err } = await query.update(payload).eq('id', payload.id);
        error = err;
      } else if (op.action === 'delete') {
        const { error: err } = await query.delete().eq('id', payload.id);
        error = err;
      }

      if (error) {
        throw error;
      }

      // Sync offline DB immediately for local consistancy
      if (op.action === 'insert' || op.action === 'update') {
         if (op.table === 'products') await db.products.put(payload);
         if (op.table === 'client_accounts') await db.clients.put(payload);
         if (op.table === 'staff') await db.staff.put(payload);
         if (op.table === 'sessions') await db.sessions.put(payload);
      } else if (op.action === 'delete') {
         if (op.table === 'products') await db.products.delete(payload.id);
         if (op.table === 'client_accounts') await db.clients.delete(payload.id);
         if (op.table === 'staff') await db.staff.delete(payload.id);
         if (op.table === 'sessions') await db.sessions.delete(payload.id);
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
     syncDataToOfflineDB(state.cafe.id);
  }
};

window.addEventListener('online', () => {
  processSyncQueue();
  const state = useAuthStore.getState();
  if (state.cafe) {
     syncDataToOfflineDB(state.cafe.id);
  }
});
