import { supabase } from './supabase';
import { useSessionStore } from '../stores/sessionStore';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { db } from './offlineDB';

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
  const opId = payload.id || crypto.randomUUID();
  const dataToStore = optimisticData || { ...payload, id: opId };

  // 1. Optimistic update (Zustand)
  if (table === 'sessions') {
    const { addSession, updateSession, removeSession } = useSessionStore.getState();
    if (action === 'insert') {
      addSession(dataToStore);
    } else if (action === 'update') {
      if (dataToStore.status !== 'active') {
         removeSession(dataToStore.id);
      } else {
         updateSession(dataToStore);
      }
    }
  }

  // 2. Save to OfflineDB for local reads immediately
  try {
     if (action === 'insert' || action === 'update') {
        if (table === 'products') await db.products.put(dataToStore);
        if (table === 'client_accounts') await db.clients.put(dataToStore);
        if (table === 'staff') await db.staff.put(dataToStore);
        if (table === 'sessions') await db.sessions.put(dataToStore);
     } else if (action === 'delete') {
        if (table === 'products') await db.products.delete(dataToStore.id);
        if (table === 'client_accounts') await db.clients.delete(dataToStore.id);
        if (table === 'staff') await db.staff.delete(dataToStore.id);
        if (table === 'sessions') await db.sessions.delete(dataToStore.id);
     }
  } catch(e) {
     console.error("Could not optimistically write to OfflineDB", e);
  }

  // 3. Execute network request (Workbox Background Sync will catch failures automatically)
  try {
    let query: any = supabase.from(table as any);
    let response: any;
    
    // Ensure payload ID is set if it was generated
    const finalPayload = { ...payload, id: opId };

    if (action === 'insert') {
      response = await query.insert(finalPayload).select().single();
    } else if (action === 'update') {
      response = await query.update(finalPayload).eq('id', finalPayload.id).select().single();
    } else if (action === 'delete') {
      response = await query.delete().eq('id', finalPayload.id);
    }
    
    if (response && response.error) throw response.error;
    
    if (response && response.data) {
        // Sync the returned data just in case it differs slightly (e.g. created_at)
        if (action === 'insert' || action === 'update') {
            if (table === 'sessions') await db.sessions.put(response.data);
            // Could update Zustand here if we strictly wanted server-authoritative timestamps
        }
    }
    
    return response ? response.data : dataToStore;
  } catch (e: any) {
    if (e.message?.includes('Failed to fetch') || !navigator.onLine) {
      // It's a network error. Workbox Background Sync intercepts this, queues it, 
      // and retries it via the service worker when the internet is restored.
      useUIStore.getState().addToast("Offline Mode / Mode hors ligne", "info");
      return dataToStore;
    }
    
    // Real database error (e.g. RLS)
    throw e;
  }
};

window.addEventListener('online', () => {
  const state = useAuthStore.getState();
  if (state.cafe) {
     syncDataToOfflineDB(state.cafe.id);
     useUIStore.getState().addToast("Online Sync / Connexion rétablie", "success");
  }
});
