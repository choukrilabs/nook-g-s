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
import { BottomSheet } from '../components/ui/BottomSheet'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function ClientsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { cafe } = useAuthStore()
  const addToast = useUIStore((state) => state.addToast)
  
  const [clients, setClients] = useState<ClientAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNewClient, setShowNewClient] = useState(false)

  // New client form
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const loadClients = async () => {
    if (!cafe) return
    setIsLoading(true)
    
    // Load local data first for instant display
    const cached = await db.clients.where('cafe_id').equals(cafe.id).toArray()
    if (cached.length > 0) {
       setClients(cached.sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
       setIsLoading(false)
    }

    if (!navigator.onLine) {
       setIsLoading(false)
       return
    }

    try {
      const { data } = await supabase
        .from('client_accounts')
        .select('*')
        .eq('cafe_id', cafe.id)
        .order('updated_at', { ascending: false })
      
      if (data) {
        setClients(data)
        db.clients.bulkPut(data)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadClients()
  }, [cafe])

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cafe || !newName) return
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('client_accounts' as any)
        .insert({
          cafe_id: cafe.id,
          name: newName,
          phone: newPhone || null,
          balance: 0,
          notes: newNotes || null
        })
      
      if (error) throw error
      
      addToast("Compte client créé", "success")
      setShowNewClient(false)
      setNewName('')
      setNewPhone('')
      setNewNotes('')
      loadClients()
    } catch (error: any) {
      addToast(error.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone && c.phone.includes(search))
    if (!matchesSearch) return false
    return true
  })

  return (
    <div className="min-h-screen bg-bg pb-8">
      <TopBar />

      <main className="pt-20 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-text">{t('clients.title')}</h1>
        </div>

        <Input
          placeholder="Rechercher un client..."
          icon={<Search size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        
        <div className="space-y-4">
          {isLoading && clients.length === 0 ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass border-white/5 rounded-3xl p-5 flex items-center justify-between" style={{ opacity: 1 - i * 0.15 }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/5 animate-pulse" />
                  <div className="space-y-2">
                    <div className="w-32 h-4 bg-white/10 rounded-full animate-pulse" />
                    <div className="w-20 h-3 bg-white/5 rounded-full animate-pulse" />
                  </div>
                </div>
                <div className="w-16 h-6 bg-white/10 rounded-full animate-pulse" />
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
                    <ChevronRight size={18} />
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
            placeholder="Nom du client"
            icon={<User size={18} />}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <Input
            type="tel"
            placeholder="Téléphone (optionnel)"
            icon={<Phone size={18} />}
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
          <div className="space-y-2">
            <label className="text-xs font-bold text-text3 uppercase tracking-widest">Notes</label>
            <textarea
              className="input h-24 py-3 resize-none"
              placeholder="Informations complémentaires..."
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
