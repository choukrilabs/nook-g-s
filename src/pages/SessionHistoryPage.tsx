import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { 
  ChevronLeft, Search, Filter, Banknote, CreditCard, 
  Wallet, Gift, Clock as ClockIcon, Calendar, ChevronRight, Check
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { db } from '../lib/offlineDB'
import { useAuthStore } from '../stores/authStore'
import { useTranslation } from '../i18n'
import { Session } from '../types'
import { format, isToday, isYesterday, startOfDay, startOfWeek, startOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'
import { TopBar } from '../components/layout/TopBar'
import { Input } from '../components/ui/Input'
import { BottomSheet } from '../components/ui/BottomSheet'

export default function SessionHistoryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { cafe } = useAuthStore()
  
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('all')
  const [customDate, setCustomDate] = useState('')
  const [statusFilter, setStatusFilter] = useState<'completed' | 'cancelled' | 'active' | 'all'>('all')
  const [paymentFilter, setPaymentFilter] = useState<'cash' | 'card' | 'account' | 'free' | 'all'>('all')
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  useEffect(() => {
    const loadSessions = async () => {
      if (!cafe) return
      setIsLoading(true)

      let gteDate: Date | null = null;
      let ltDate: Date | null = null;
      if (period === 'today') {
        gteDate = startOfDay(new Date());
      } else if (period === 'week') {
        gteDate = startOfWeek(new Date(), { weekStartsOn: 1 });
      } else if (period === 'month') {
        gteDate = startOfMonth(new Date());
      } else if (period === 'custom' && customDate) {
        gteDate = startOfDay(new Date(customDate));
        ltDate = new Date(gteDate);
        ltDate.setDate(ltDate.getDate() + 1);
      }

      // Load local data for instant display
      const localSessions = await db.sessions.toArray();
      let filtered = localSessions;
      
      if (statusFilter !== 'all') {
         filtered = filtered.filter(s => s.status === statusFilter);
      }
      if (paymentFilter !== 'all') {
         filtered = filtered.filter(s => s.payment_method === paymentFilter);
      }
      
      if (gteDate) {
          filtered = filtered.filter(s => new Date(s.started_at) >= gteDate!);
      }
      if (ltDate) {
          filtered = filtered.filter(s => new Date(s.started_at) < ltDate!);
      }
      
      filtered.sort((a,b) => {
          const tA = a.ended_at ? new Date(a.ended_at).getTime() : new Date(a.started_at).getTime();
          const tB = b.ended_at ? new Date(b.ended_at).getTime() : new Date(b.started_at).getTime();
          return tB - tA;
      });
      
      if (filtered.length > 0) {
        setSessions(filtered);
        setIsLoading(false);
      }

      if (!navigator.onLine) {
         setIsLoading(false);
         return;
      }
      
      let query = supabase
        .from('sessions')
        .select('*')
        .eq('cafe_id', cafe.id)
        .order('ended_at', { ascending: false, nullsFirst: true }) // nullsFirst so active sessions with null ended_at show at top
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      } else {
        query = query.in('status', ['active', 'completed', 'cancelled'])
      }

      if (paymentFilter !== 'all') {
        query = query.eq('payment_method', paymentFilter)
      }
      
      if (gteDate) query = query.gte('started_at', gteDate.toISOString())
      if (ltDate) query = query.lt('started_at', ltDate.toISOString())

      const { data } = await query as any
      if (data) {
          setSessions(data)
          db.sessions.bulkPut(data)
      }
      setIsLoading(false)
    }

    loadSessions()
  }, [cafe, period, customDate, statusFilter, paymentFilter])

  const filteredSessions = sessions.filter(s => 
    s.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    s.seat_number.toString().includes(search)
  )

  const groupedSessions = filteredSessions.reduce((acc: Record<string, Session[]>, session) => {
    const date = format(new Date(session.ended_at || session.started_at), 'yyyy-MM-dd')
    if (!acc[date]) acc[date] = []
    acc[date].push(session)
    return acc
  }, {})

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr)
    if (isToday(date)) return "Aujourd'hui"
    if (isYesterday(date)) return "Hier"
    return format(date, 'EEEE d MMMM', { locale: fr })
  }

  return (
    <div className="min-h-screen bg-bg pb-8">
      <TopBar />

      <main className="pt-20 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-text">{t('dashboard.history')}</h1>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsFilterOpen(true)}
              className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text2 hover:text-text transition-colors relative"
            >
              <Filter size={18} />
              {(period !== 'today' || statusFilter !== 'completed' || paymentFilter !== 'all') && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full" />
              )}
            </button>
            <button 
              onClick={() => {
                const searchInput = document.getElementById('history-search')
                if (searchInput) {
                  if (searchInput.style.height === '0px' || !searchInput.style.height) {
                    searchInput.style.height = '44px'
                    searchInput.style.opacity = '1'
                    searchInput.style.marginBottom = '16px'
                    setTimeout(() => searchInput.querySelector('input')?.focus(), 50)
                  } else {
                    searchInput.style.height = '0px'
                    searchInput.style.opacity = '0'
                    searchInput.style.marginBottom = '0px'
                    setSearch('')
                  }
                }
              }}
              className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text2 hover:text-text transition-colors"
            >
              <Search size={18} />
            </button>
          </div>
        </div>

        <div 
          id="history-search" 
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ height: 0, opacity: 0, marginBottom: 0 }}
        >
          <Input
            placeholder={t('reports.search_placeholder')}
            icon={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface border border-border rounded-xl p-3 text-center">
            <div className="text-[10px] text-text3 font-bold uppercase mb-1">{filteredSessions.length} {t('reports.sessions')}</div>
            <div className="text-lg font-mono font-bold text-text">{t('reports.total')}</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-3 text-center">
            <div className="text-[10px] text-text3 font-bold uppercase mb-1">
              {filteredSessions.reduce((acc, s) => acc + s.total_amount, 0).toFixed(2)} DH
            </div>
            <div className="text-lg font-mono font-bold text-accent2">{t('reports.revenue')}</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-3 text-center">
            <div className="text-[10px] text-text3 font-bold uppercase mb-1">
              {filteredSessions.length > 0 
                ? Math.round(filteredSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0) / filteredSessions.length)
                : 0} min
            </div>
            <div className="text-lg font-mono font-bold text-text">{t('reports.average')}</div>
          </div>
        </div>


        <div className="space-y-8">
          {isLoading && sessions.length === 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="w-24 h-3 bg-white/5 rounded-full animate-pulse" />
                <div className="w-16 h-3 bg-white/5 rounded-full animate-pulse" />
              </div>
              <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-3 bg-white/5 rounded-full animate-pulse" />
                      <div className="space-y-2">
                        <div className="w-32 h-3 bg-white/10 rounded-full animate-pulse" />
                        <div className="w-20 h-2 bg-white/5 rounded-full animate-pulse" />
                      </div>
                    </div>
                    <div className="w-12 h-4 bg-white/10 rounded-full animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ) : Object.keys(groupedSessions).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-text3">
              <Calendar size={40} className="mb-4 opacity-20" />
              <p className="text-sm font-medium">{t('reports.no_sessions')}</p>
            </div>
          ) : (
            Object.entries(groupedSessions).map(([date, daySessions]: [string, any]) => (
              <div key={date} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-text3 uppercase tracking-widest">{formatDateHeader(date)}</h3>
                <span className="text-xs font-mono font-bold text-text3">
                  {daySessions.reduce((acc: number, s: any) => acc + s.total_amount, 0).toFixed(2)} DH
                </span>
              </div>
              <div className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border">
                {daySessions.map((session: any) => (
                  <motion.div
                    key={session.id}
                    whileTap={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                    onClick={() => navigate(`/sessions/${session.id}`)}
                    className="p-4 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-[11px] font-mono text-text3">
                        {session.ended_at ? format(new Date(session.ended_at), 'HH:mm') : format(new Date(session.started_at), 'HH:mm')}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-text">
                          Place {session.seat_number} — {session.customer_name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-text3">
                          <ClockIcon size={10} />
                          {session.duration_minutes || '- '} min
                          {session.status === 'active' && (
                            <span className="px-1.5 py-0.5 rounded bg-accent-glow text-accent2 border border-accent-border font-bold">Actif</span>
                          )}
                          {session.status === 'cancelled' && (
                            <span className="px-1.5 py-0.5 rounded bg-error-dim text-error border border-error/20 font-bold">Annulée</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-mono font-bold text-text">
                          {session.total_amount ? session.total_amount.toFixed(2) : '0.00'} DH
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-text3" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            ))
          )}
        </div>
      </main>
      
      <BottomSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title={t('common.filters') || 'Filtres'}
      >
        <div className="space-y-6">
          {/* Period Filter */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-text3 uppercase tracking-widest">{t('common.filters')}</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'today', label: t('common.today') },
                { id: 'week', label: t('common.thisWeek') },
                { id: 'month', label: t('common.thisMonth') },
                { id: 'all', label: t('common.all') },
                { id: 'custom', label: t('reports.custom_date') },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id as any)}
                  className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                    period === p.id 
                      ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' 
                      : 'bg-surface2 text-text3 border-border hover:border-text3'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {period === 'custom' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden pt-2"
                >
                  <Input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Status Filter */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-text3 uppercase tracking-widest">Par statut</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'Tous' },
                { id: 'active', label: 'Actives' },
                { id: 'completed', label: 'Terminées' },
                { id: 'cancelled', label: 'Annulées' },
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id as any)}
                  className={`px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 ${
                    statusFilter === s.id 
                      ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' 
                      : 'bg-surface2 text-text3 border-border hover:border-text3'
                  }`}
                >
                  {statusFilter === s.id && <Check size={14} />}
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method Filter */}
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-xs font-bold text-text3 uppercase tracking-widest">Par paiement</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'Tous' },
                { id: 'cash', label: 'Espèces' },
                { id: 'card', label: 'Carte' },
                { id: 'account', label: 'Compte' },
                { id: 'free', label: 'Offert' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setPaymentFilter(p.id as any)}
                  className={`px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 ${
                    paymentFilter === p.id 
                      ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' 
                      : 'bg-surface2 text-text3 border-border hover:border-text3'
                  }`}
                >
                  {paymentFilter === p.id && <Check size={14} />}
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setIsFilterOpen(false)}
            className="w-full h-12 bg-gradient-to-br from-accent to-[#ea6b0a] text-white font-bold rounded-xl shadow-[0_2px_12px_rgba(249,115,22,0.25)] mt-4 active:scale-[0.98] transition-all"
          >
            {t('common.apply')}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
