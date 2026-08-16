import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Activity, User, Shield, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useTranslation } from '../i18n'
import { EnrichedAuditLog, AuditLog } from '../types'
import { Input } from '../components/ui/Input'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'

export default function AuditLogPage() {
  const { t, language } = useTranslation()
  const navigate = useNavigate()
  const { cafe } = useAuthStore()
  
  const [logs, setLogs] = useState<EnrichedAuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const loadLogs = async () => {
      if (!cafe) return
      setIsLoading(true)
      
      const { data: logsData } = await supabase
        .from('audit_log')
        .select('*')
        .eq('cafe_id', cafe.id)
        .order('created_at', { ascending: false })
        .limit(100)
        
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name')
        .eq('cafe_id', cafe.id)
        
      if (logsData) {
        const staffMap = new Map((staffData || []).map((s: { id: string; name: string }) => [s.id, s.name]))
        const enrichedLogs: EnrichedAuditLog[] = logsData.map((log: AuditLog) => ({
          ...log,
          staff_name: log.is_owner ? t('auth.owner') : (log.staff_id ? staffMap.get(log.staff_id) || 'Employé inconnu' : 'Système')
        }))
        setLogs(enrichedLogs)
      }
      setIsLoading(false)
    }
    
    loadLogs()
  }, [cafe, t])

  const filteredLogs = logs.filter(log => {
    const searchLower = search.toLowerCase()
    const staffName = log.staff_name?.toLowerCase() || ''
    const action = log.action.toLowerCase()
    return staffName.includes(searchLower) || action.includes(searchLower) || JSON.stringify(log.details).toLowerCase().includes(searchLower)
  })

  const formatAction = (action: string) => {
    const actionMap: Record<string, string> = {
      'session_started': t('audit.session_started'),
      'session_closed': t('audit.session_closed'),
      'extras_added': t('audit.extras_added'),
      'client_recharged': t('audit.client_recharged'),
      'staff_created': t('audit.staff_created'),
      'staff_deleted': t('audit.staff_deleted'),
      'staff_updated': t('audit.staff_updated'),
      'product_added': t('audit.product_added'),
      'product_deleted': t('audit.product_deleted'),
      'product_updated': t('audit.product_updated'),
      'cafe_updated': t('audit.cafe_updated'),
    }
    return actionMap[action] || action
  }

  return (
    <div className="min-h-screen bg-bg pb-12">
      <header className="fixed top-0 inset-x-0 h-14 bg-bg/90 backdrop-blur-xl border-b border-border z-[100] flex items-center px-4">
        <button onClick={() => navigate(-1)} className="p-2 -ms-2 text-text3 hover:text-text">
          <ChevronLeft size={20} className="rtl:rotate-180" />
        </button>
        <h1 className="text-sm font-bold text-text ms-2">{t('settings.audit_log')}</h1>
      </header>

      <main className="pt-20 px-4 space-y-4">
        <Input
          placeholder={t('audit.search_placeholder')}
          icon={<Search size={18} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <div key={log.id} className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {log.is_owner ? (
                    <Shield size={14} className="text-accent" />
                  ) : (
                    <User size={14} className="text-text3" />
                  )}
                  <span className="text-xs font-bold text-text">{log.staff_name}</span>
                </div>
                <div className="text-[10px] text-text3 font-mono">
                  {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: language === 'fr' ? fr : enUS })}
                </div>
              </div>
              
              <div className="text-sm font-medium text-text mb-1">
                {formatAction(log.action)}
              </div>
              
              {log.details && Object.keys(log.details as object).length > 0 && (
                <div className="bg-surface2 rounded-lg p-2 mt-2">
                  <pre className="text-[10px] text-text3 font-mono whitespace-pre-wrap break-words">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}

          {filteredLogs.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-text3">
              <Activity size={40} className="mb-4 opacity-20" />
              <p className="text-sm font-medium">{t('audit.no_logs')}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
