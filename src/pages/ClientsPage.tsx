import * as React from 'react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { 
  Search, UserPlus, Wallet, Phone, FileText, 
  ChevronRight, Plus, Loader2, User, Clock as ClockIcon
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useUIStore } from '../stores/uiStore'
import { useTranslation } from '../i18n'
import { ClientAccount } from '../types'
import { db } from '../lib/offlineDB'
import { TopBar } from '../components/layout/TopBar'
import { Input } from '../components/ui/Input'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { ClientCardSkeleton } from '../components/ui/Skeleton'
import { BottomSheet } from '../components/ui/BottomSheet'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

const PAGE_SIZE = 30

export default function ClientsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { cafe } = useAuthStore()
  const addToast = useUIStore((state) => state.addToast)
  
  const [clients, setClients] = useState<ClientAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [showNewClient, setShowNewClient] = useState(false)

  // New client form
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const loadClients = async (targetPage: number = 0, isInitial: boolean = false) => {
    if (!cafe) return
    if (targetPage === 0) {
      if (isInitial) setIsLoading(true)
    } else {
      setIsLoadingMore(true)
    }
    
    // Load local data first for instant display on page 0
    if (targetPage === 0 && isInitial) {
      const cached = await db.clients.where('cafe_id').equals(cafe.id).limit(PAGE_SIZE).toArray()
      if (cached.length > 0) {
        setClients(cached.sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
        setIsLoading(false)
      }
    }

    if (!navigator.onLine) {
      setIsLoading(false)
      setIsLoadingMore(false)
      return
    }

    try {
      const from = targetPage * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('client_accounts')
        .select('*', { count: 'exact' })
        .eq('cafe_id', cafe.id)
        .order('updated_at', { ascending: false })

      if (search.trim()) {
        const trimmed = search.trim()
        query = query.or(`name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%`)
      }

      const { data, count, error } = await query.range(from, to)
      
      if (error) {
        console.error('Error fetching clients:', error)
      } else if (data) {
        if (targetPage === 0) {
          setClients(data)
        } else {
          setClients(prev => {
            const existingIds = new Set(prev.map(c => c.id))
            const newItems = data.filter(c => !existingIds.has(c.id))
            return [...prev, ...newItems]
          })
        }
        db.clients.bulkPut(data)
        
        if (count !== null) {
          setTotalCount(count)
          setHasMore(from + data.length < count)
        } else {
          setHasMore(data.length === PAGE_SIZE)
        }
        setPage(targetPage)
      }
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }

  // Reload on search or cafe change with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadClients(0, true)
    }, 250)
    return () => clearTimeout(timer)
  }, [cafe, search])

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      loadClients(page + 1, false)
    }
  }

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cafe || !newName) return
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('client_accounts')
        .insert({
          cafe_id: cafe.id,
          name: newName,
          phone: newPhone || null,
          balance: 0,
          notes: newNotes || null
        })
      
      if (error) throw error
      
      addToast(t("clients.client_created"), "success")
      setShowNewClient(false)
      setNewName('')
      setNewPhone('')
      setNewNotes('')
      loadClients(0, true)
    } catch (error: any) {
      addToast(error.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const filteredClients = clients

  return (
    <div className="min-h-screen bg-bg pb-8">
      <TopBar />

      <main className="pt-20 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-text">{t('clients.title')}</h1>
        </div>

        <Input
          placeholder={t("reports.search_placeholder")}
          icon={<Search size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        
        <div className="space-y-4">
          {isLoading && clients.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ opacity: 1 - i * 0.15 }}>
                <ClientCardSkeleton />
              </div>
            ))
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredClients.map((client) => (
                <motion.div
                  key={client.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="glass border-white/5 rounded-3xl p-5 flex items-center justify-between cursor-pointer group hover:bg-white/[0.02] transition-all duration-300"
                >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar name={client.name} size={48} />
                  </div>
                  <div>
                    <div className="text-base font-bold text-text mb-0.5">{client.name}</div>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-surface2 rounded-full text-[9px] font-bold text-text3 uppercase tracking-wider">
                      <ClockIcon size={10} />
                      {formatDistanceToNow(new Date(client.updated_at), { addSuffix: true, locale: fr })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-text3 group-hover:text-text group-hover:bg-white/10 transition-all">
                    <ChevronRight size={18} className="rtl:rotate-180" />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          )}

          {filteredClients.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-text3">
              <Wallet size={40} className="mb-4 opacity-20" />
              <p className="text-sm font-medium">Aucun client trouvé</p>
            </div>
          )}

          {hasMore && (
            <div className="pt-2 pb-4 flex justify-center">
              <Button
                variant="ghost"
                onClick={handleLoadMore}
                isLoading={isLoadingMore}
                className="w-full max-w-xs h-11 border border-border text-xs font-bold uppercase tracking-wider hover:bg-surface2"
              >
                {t('common.load_more')}
              </Button>
            </div>
          )}
        </div>
      </main>

      <button
        onClick={() => setShowNewClient(true)}
        className="fixed bottom-[24px] end-6 w-14 h-14 bg-linear-to-br from-accent to-[#ea6b0a] rounded-full flex items-center justify-center text-white shadow-2xl shadow-accent/40 z-50 active:scale-90 transition-all"
      >
        <UserPlus size={24} />
      </button>

      <BottomSheet isOpen={showNewClient} onClose={() => setShowNewClient(false)} title={t('clients.new')}>
        <form onSubmit={handleCreateClient} className="space-y-6 pt-4">
          <Input
            placeholder={t("sessions.client")}
            icon={<User size={18} />}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <Input
            type="tel"
            placeholder="06 XX XX XX XX"
            icon={<Phone size={18} />}
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
          <div className="space-y-2">
            <label className="text-xs font-bold text-text3 uppercase tracking-widest">Notes</label>
            <textarea
              className="input h-24 py-3 resize-none"
              placeholder={t("sessions.notes")}
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full h-14" isLoading={isSaving}>
            Créer le compte
          </Button>
        </form>
      </BottomSheet>

    </div>
  )
}
