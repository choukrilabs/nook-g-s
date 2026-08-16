import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { Json } from '../types/index'

export function useAudit() {
  const { cafe, type, staff } = useAuthStore.getState()

  const logAction = async (action: string, details: any = {}) => {
    // Get fresh state in case it changed
    const currentState = useAuthStore.getState()
    if (!currentState.cafe) return

    try {
      await supabase.from('audit_log').insert({
        cafe_id: currentState.cafe.id,
        staff_id: currentState.type === 'staff' ? currentState.staff?.id || null : null,
        is_owner: currentState.type === 'owner',
        action,
        details: details as Json
      })
    } catch (error) {
      console.error('Failed to log action:', error)
    }
  }

  return { logAction }
}
