import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useSessionStore } from '../stores/sessionStore'
import { db } from '../lib/offlineDB'
import { readJson, writeJson } from '../lib/storage'

export const useRealtime = () => {
  const { cafe, type, staff, setStaff, logout } = useAuthStore()
  const { setActiveSessions, addSession, updateSession, removeSession } = useSessionStore()

  useEffect(() => {
    if (!cafe) return

    // Initial load
    const loadSessions = async () => {
      // Show offline active sessions instantly
      const localSessions = (await db.sessions
          .where('cafe_id').equals(cafe.id)
          .toArray())
          .filter((session) => session.status === 'active')
          .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
      
      if (localSessions.length > 0) {
        setActiveSessions(localSessions);
      }

      if (!navigator.onLine) {
         return;
      }
      
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('cafe_id', cafe.id)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
      
      if (data) {
         setActiveSessions(data)
         db.sessions.bulkPut(data)
      }
    }

    loadSessions()

    // Realtime subscription for sessions
    const sessionsChannel = supabase
      .channel(`sessions-cafe-${cafe.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `cafe_id=eq.${cafe.id}`,
        },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload
          
          if (eventType === 'INSERT') {
            if ((newRow as any).status === 'active') {
              addSession(newRow as any)
            }
          } else if (eventType === 'UPDATE') {
            if ((newRow as any).status === 'active') {
              updateSession(newRow as any)
            } else {
              removeSession((oldRow as any).id)
            }
          } else if (eventType === 'DELETE') {
            removeSession((oldRow as any).id)
          }
        }
      )
      .subscribe()

    // Realtime subscription for current staff member
    let staffChannel: ReturnType<typeof supabase.channel> | null = null
    
    if (type === 'staff' && staff) {
      staffChannel = supabase
        .channel(`staff-${staff.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'staff',
            filter: `id=eq.${staff.id}`,
          },
          (payload) => {
            const updatedStaff = payload.new as any
            if (updatedStaff.active === false) {
              logout()
            } else {
              setStaff(updatedStaff)
              const parsed = readJson<Record<string, unknown> | null>('nook_staff_session', null)
              if (parsed) {
                writeJson('nook_staff_session', {
                  ...parsed,
                  permissions: updatedStaff.permissions
                })
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'staff',
            filter: `id=eq.${staff.id}`,
          },
          () => {
            logout()
          }
        )
        .subscribe()
    }

    return () => {
      supabase.removeChannel(sessionsChannel)
      if (staffChannel) supabase.removeChannel(staffChannel)
    }
  }, [cafe, type, staff?.id])
}
