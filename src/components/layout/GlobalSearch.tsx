import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, User, Clock as ClockIcon, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { motion, AnimatePresence } from 'motion/react'
import { Session, ClientAccount } from '../../types'
import { useTranslation } from '../../i18n'

export const GlobalSearch = () => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [clients, setClients] = useState<ClientAccount[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const { cafe } = useAuthStore()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    const search = async () => {
      if (!query.trim() || !cafe) {
        setClients([])
        setSessions([])
        return
      }

      setIsSearching(true)
      
      const safeQuery = query.replace(/"/g, '')
      const isNumber = !isNaN(parseInt(query))
      const [clientsRes, sessionsRes] = await Promise.all([
        supabase
          .from('client_accounts')
          .select('*')
          .eq('cafe_id', cafe.id)
          .or(`name.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%`)
          .limit(5),
        supabase
          .from('sessions')
          .select('*')
          .eq('cafe_id', cafe.id)
          .or(`customer_name.ilike.%${safeQuery}%,customer_phone.ilike.%${safeQuery}%${isNumber ? `,seat_number.eq.${parseInt(query)}` : ''}`)
          .limit(5)
      ])

      if (clientsRes.data) setClients(clientsRes.data)
      if (sessionsRes.data) setSessions(sessionsRes.data)
      
      setIsSearching(false)
    }

    const debounce = setTimeout(search, 300)
    return () => clearTimeout(debounce)
  }, [query, cafe])

  const handleClose = () => {
    setIsOpen(false)
    setQuery('')
  }

  const navigateTo = (path: string) => {
    navigate(path)
    handleClose()
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="p-2 text-text3 hover:text-text transition-colors"
      >
        <Search size={18} />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed inset-0 z-[200] bg-bg/95 backdrop-blur-xl flex flex-col"
            >
              <div className="p-4 border-b border-border flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-text3" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={t('common.search') + "..."}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full h-12 bg-surface border border-border rounded-xl ps-10 pe-4 text-text placeholder:text-text3 focus:border-accent focus:outline-none"
                  />
                </div>
                <button 
                  onClick={handleClose}
                  className="p-3 text-text3 hover:text-text bg-surface rounded-xl border border-border"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {query.trim() && !isSearching && clients.length === 0 && sessions.length === 0 && (
                  <div className="text-center text-text3 py-8">
                    {t('common.no_results')} "{query}"
                  </div>
                )}

                {clients.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-text3 uppercase tracking-widest">{t('dashboard.clients')}</h3>
                    {clients.map(client => (
                      <div 
                        key={client.id}
                        onClick={() => navigateTo(`/clients/${client.id}`)}
                        className="bg-surface border border-border p-3 rounded-xl flex items-center justify-between cursor-pointer hover:border-text3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-surface2 flex items-center justify-center text-text2">
                            <User size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-text">{client.name}</div>
                            {client.phone && <div className="text-xs text-text3">{client.phone}</div>}
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-text3 rtl:rotate-180" />
                      </div>
                    ))}
                  </div>
                )}

                {sessions.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-text3 uppercase tracking-widest">{t('dashboard.sessions')}</h3>
                    {sessions.map(session => (
                      <div 
                        key={session.id}
                        onClick={() => navigateTo(`/sessions/${session.id}`)}
                        className="bg-surface border border-border p-3 rounded-xl flex items-center justify-between cursor-pointer hover:border-text3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-surface2 flex items-center justify-center text-text2">
                            <ClockIcon size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-text">
                              Place {session.seat_number} — {session.customer_name}
                            </div>
                            <div className="text-xs text-text3 flex items-center gap-1">
                              <span>{session.status === 'active' ? t('dashboard.active') : t('dashboard.closed')}</span>
                              <span>•</span>
                              <span>{session.total_amount?.toFixed(2) || '0.00'} DH</span>
                            </div>
                            {session.customer_phone && <div className="text-xs text-text3 mt-0.5">{session.customer_phone}</div>}
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-text3 rtl:rotate-180" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
