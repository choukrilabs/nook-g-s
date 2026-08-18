import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { 
  ChevronLeft, MoreVertical, Phone, MessageCircle, 
  PlusCircle, BarChart, TrendingUp, Calendar, 
  Clock as ClockIcon, Banknote, Wallet, Loader2, Play, Trash2, Edit2
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { db } from '../lib/offlineDB'
import { useAuthStore } from '../stores/authStore'
import { useUIStore } from '../stores/uiStore'
import { useTranslation } from '../i18n'
import { useAudit } from '../hooks/useAudit'
import { ClientAccount, Session, BalanceTransaction } from '../types'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { BottomSheet } from '../components/ui/BottomSheet'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { queueMutation } from '../lib/offlineSync'
import { calculateClientAccountTopUp } from '../lib/calculations'

export default function ClientDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { cafe, staff, type } = useAuthStore()
  const addToast = useUIStore((state) => state.addToast)
  const { logAction } = useAudit()

  const [client, setClient] = useState<ClientAccount | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sessionsSortOrder, setSessionsSortOrder] = useState<'desc' | 'asc'>('desc')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showTopUpModal, setShowTopUpModal] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState<string>('100')
  const [isSubmittingTopUp, setIsSubmittingTopUp] = useState(false)

  const loadData = async () => {
    if (!id) return
    setIsLoading(true)
    
    // Check local DB first for instant load
    const cachedClient = await db.clients.get(id);
    if (cachedClient) {
        setClient(cachedClient);
        setIsLoading(false);
    }
    
    if (!navigator.onLine) {
        setIsLoading(false);
        return;
    }

    const { data: clientData } = await supabase
      .from('client_accounts')
      .select('*')
      .eq('id', id)
      .single()
    
    if (clientData) {
      setClient(clientData)
      db.clients.put(clientData)
      
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('client_account_id', id)
        .order('created_at', { ascending: false })
      
      if (sessionData) setSessions(sessionData)

    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [id])

  if (isLoading || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    )
  }

  const handleTopUp = async () => {
    if (!client) return
    const amount = parseFloat(topUpAmount)
    if (isNaN(amount) || amount <= 0) {
      addToast('Montant invalide', 'error')
      return
    }

    setIsSubmittingTopUp(true)
    try {
      let newBalance = calculateClientAccountTopUp(client.balance, amount)
      
      // If online, use atomic server-side RPC transaction with row lock
      if (navigator.onLine && client.cafe_id) {
        const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('process_client_balance_transaction', {
          p_cafe_id: client.cafe_id,
          p_client_id: client.id,
          p_amount: amount,
          p_type: 'credit',
          p_description: 'Recharge de solde client',
          p_staff_id: staff?.id || null,
          p_session_id: null
        })
        if (rpcError) {
          throw rpcError;
        } else if (rpcData && (rpcData as any[]).length > 0) {
          newBalance = Number((rpcData as any[])[0].new_balance)
        }
      } else {
        throw new Error("Recharge de compte non disponible hors ligne.");
      }

      const updatedClient = {
        ...client,
        balance: newBalance,
      }

      try {
        await logAction('balance_topup', {
          client_id: client.id,
          client_name: client.name,
          amount: amount,
          new_balance: newBalance,
        })
      } catch (e) { console.error(e) }

      setClient(updatedClient)
      await db.clients.put(updatedClient)
      setShowTopUpModal(false)
      addToast(`Compte rechargé de ${amount.toFixed(2)} DH (Nouveau solde: ${newBalance.toFixed(2)} DH)`, 'success')
    } catch (error: any) {
      addToast(error.message, 'error')
    } finally {
      setIsSubmittingTopUp(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg pb-12">
      <header className="fixed top-0 inset-x-0 h-14 bg-bg/90 backdrop-blur-xl border-b border-border z-[100] flex items-center justify-between px-4">
        <button onClick={() => navigate(-1)} className="p-2 -ms-2 text-text3 hover:text-text">
          <ChevronLeft size={20} className="rtl:rotate-180" />
        </button>
        <h1 className="text-sm font-bold text-text">{client.name}</h1>
        <div className="relative">
          <button 
            onClick={() => setShowMoreMenu(!showMoreMenu)} 
            className="p-2 -me-2 text-text3 hover:text-text"
          >
            <MoreVertical size={20} />
          </button>
          
          <AnimatePresence>
            {showMoreMenu && (
              <>
                <div 
                  className="fixed inset-0 z-[110]" 
                  onClick={() => setShowMoreMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute end-0 mt-2 w-48 bg-surface border border-border rounded-xl overflow-hidden shadow-xl shadow-black/50 z-[120]"
                >
                  <div className="flex flex-col py-1">
                    <button 
                      onClick={() => {
                        setShowMoreMenu(false)
                        setShowTopUpModal(true)
                      }}
                      className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-text2 hover:text-text hover:bg-surface2 transition-colors text-start"
                    >
                      <Wallet size={16} />
                      Recharger le solde
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main className="pt-20 px-4 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col items-center text-center">
          <Avatar name={client.name} size="lg" className="mb-4" />
          <h2 className="text-2xl font-extrabold text-text">{client.name}</h2>
          {client.phone && (
            <div className="flex items-center gap-2 text-text3 text-sm mt-1">
              <Phone size={14} />
              {client.phone}
            </div>
          )}
        </div>

        {/* Balance Card */}
        <div className="p-5 rounded-2xl border border-border bg-surface2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <Wallet size={22} />
            </div>
            <div>
              <div className="text-[11px] font-bold text-text3 uppercase tracking-wider">Solde Compte Client</div>
              <div className="text-2xl font-mono font-black text-text">
                {(client.balance || 0).toFixed(2)} <span className="text-sm font-sans font-bold text-accent">DH</span>
              </div>
            </div>
          </div>
          <Button
            onClick={() => setShowTopUpModal(true)}
            className="h-10 px-4 text-xs font-bold"
          >
            Recharger
          </Button>
        </div>

        {/* Action Card */}
        <div className="p-6 rounded-2xl border border-border bg-surface2 flex flex-col items-center text-center relative overflow-hidden">
          <Button 
            className="w-full h-12 mb-3 bg-gradient-to-br from-accent to-[#ea6b0a] text-white shadow-[0_2px_12px_rgba(249,115,22,0.25)]"
            onClick={() => navigate('/sessions/new', { state: { clientName: client.name, clientPhone: client.phone, clientId: client.id } })}
          >
            <Play size={18} className="fill-current" />
            Démarrer une session
          </Button>

          {client.phone && (
            <a 
              href={`https://wa.me/${client.phone.replace(/\s/g, '')}?text=Bonjour ${client.name}.`}
              target="_blank"
              rel="noreferrer"
              className="w-full mt-3 h-12 btn-ghost flex items-center justify-center gap-2"
            >
              <MessageCircle size={18} />
              Contacter via WhatsApp
            </a>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface border border-border rounded-xl p-3 text-center">
            <BarChart size={16} className="text-text3 mx-auto mb-1.5" />
            <div className="text-lg font-mono font-bold text-text">{client.total_visits}</div>
            <div className="text-[9px] text-text3 font-bold uppercase">Visites</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-3 text-center">
            <TrendingUp size={16} className="text-text3 mx-auto mb-1.5" />
            <div className="text-lg font-mono font-bold text-text">{client.total_spent.toFixed(0)}</div>
            <div className="text-[9px] text-text3 font-bold uppercase">DH Dépensé</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-3 text-center">
            <Calendar size={16} className="text-text3 mx-auto mb-1.5" />
            <div className="text-lg font-mono font-bold text-text">{format(new Date(client.created_at), 'yy')}</div>
            <div className="text-[9px] text-text3 font-bold uppercase">Membre</div>
          </div>
        </div>

        {/* History Tabs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border">
            <div className="flex gap-4">
              <button 
                className="pb-2 text-sm font-bold text-accent transition-all relative"
              >
                Visites
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent" />
              </button>
            </div>
            
            {sessions.length > 0 && (
              <button
                onClick={() => setSessionsSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="flex items-center gap-1.5 pb-2 text-xs font-bold text-text3 hover:text-text transition-colors"
              >
                Trier par date
                <ChevronLeft size={14} className={`transition-transform rotate-[-90deg] ${sessionsSortOrder === 'asc' ? 'rotate-[90deg]' : ''}`} />
              </button>
            )}
          </div>

          <div className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {[...sessions].sort((a, b) => {
              const dateA = new Date(a.started_at).getTime()
              const dateB = new Date(b.started_at).getTime()
              return sessionsSortOrder === 'desc' ? dateB - dateA : dateA - dateB
            }).map((session) => (
              <div key={session.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface2 flex items-center justify-center text-text3">
                    <ClockIcon size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-text">
                      Place {session.seat_number}
                    </div>
                    <div className="text-[10px] text-text3">
                      {format(new Date(session.started_at), 'd MMM yyyy', { locale: fr })}
                    </div>
                  </div>
                </div>
                <div className="text-end">
                  <div className="text-sm font-mono font-bold text-text">
                    {session.total_amount.toFixed(2)} DH
                  </div>
                  <div className="text-[10px] text-text3">
                    {session.duration_minutes} min
                  </div>
                </div>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="p-8 text-center text-text3 text-sm">Aucune visite enregistrée</div>
            )}
          </div>
        </div>
      </main>

      {/* Top Up BottomSheet */}
      <BottomSheet
        isOpen={showTopUpModal}
        onClose={() => setShowTopUpModal(false)}
        title="Recharger le compte client"
      >
        <div className="space-y-6 pt-4">
          <div className="bg-surface2 p-4 rounded-xl border border-border space-y-1">
            <div className="text-xs text-text3">Client</div>
            <div className="text-sm font-bold text-text">{client.name}</div>
            <div className="text-xs text-text3 pt-1">
              Solde actuel : <span className="font-mono font-bold text-accent">{(client.balance || 0).toFixed(2)} DH</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-text3 uppercase tracking-wider">Montant de la recharge (DH)</label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[50, 100, 200, 500].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setTopUpAmount(amt.toString())}
                  className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                    topUpAmount === amt.toString()
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface2 text-text border-border hover:border-border2'
                  }`}
                >
                  +{amt} DH
                </button>
              ))}
            </div>

            <Input
              type="number"
              min="1"
              step="any"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              placeholder="Montant en DH"
            />
          </div>

          {(() => {
            const parsedAmt = parseFloat(topUpAmount) || 0;
            const newBal = (client.balance || 0) + parsedAmt;
            return (
              <div className="p-4 bg-surface2 rounded-xl border border-border flex justify-between items-center text-xs">
                <span className="text-text3 font-medium">Nouveau solde prévu :</span>
                <span className="font-mono font-black text-sm text-green-500">
                  {newBal.toFixed(2)} DH
                </span>
              </div>
            );
          })()}

          <Button
            className="w-full h-14"
            onClick={handleTopUp}
            disabled={isSubmittingTopUp || !parseFloat(topUpAmount) || parseFloat(topUpAmount) <= 0}
          >
            {isSubmittingTopUp ? <Loader2 className="animate-spin" size={18} /> : 'Valider le rechargement'}
          </Button>
        </div>
      </BottomSheet>
    </div>
  )
}
