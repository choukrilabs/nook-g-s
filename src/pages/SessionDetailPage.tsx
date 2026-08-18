import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { 
  ChevronLeft, MoreVertical, Clock as ClockIcon, Gauge, AlertCircle, 
  ShoppingBag, Plus, StopCircle, Edit2, Trash2, CheckCircle,
  Banknote, CreditCard, Wallet, Gift, Loader2, Phone, FileText
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useUIStore } from '../stores/uiStore'
import { useTranslation } from '../i18n'
import { useAudit } from '../hooks/useAudit'
import { Button } from '../components/ui/Button'
import { Session, Product, SessionExtra, ClientAccount } from '../types'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { format } from 'date-fns'
import { queueMutation } from '../lib/offlineSync'
import { generateReceiptPDF, generateReceiptText } from '../lib/pdf'
import { db } from '../lib/offlineDB'
import {
  calculateChange,
  calculateClientAccountDebit,
  formatDH,
} from '../lib/calculations'
import { calculateSessionCost, calculateNewExtrasTotal } from '../lib/pricing'

export default function SessionDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { cafe, type, staff } = useAuthStore()
  const addToast = useUIStore((state) => state.addToast)
  const { logAction } = useAudit()

  const [session, setSession] = useState<Session | null>(null)
  const [clientAccount, setClientAccount] = useState<ClientAccount | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [elapsed, setElapsed] = useState('')
  const [timeCost, setTimeCost] = useState(0)
  const [isLong, setIsLong] = useState(false)
  
  const [showExtras, setShowExtras] = useState(false)
  const [showEnd, setShowEnd] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  
  const [products, setProducts] = useState<Product[]>([])
  const [selectedExtras, setSelectedExtras] = useState<Record<string, number>>({})
  const [itemToRemove, setItemToRemove] = useState<number | null>(null)

  // End session & payment state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'account' | 'free'>('cash')
  const [cashTendered, setCashTendered] = useState<string>('')

  useEffect(() => {
    const loadSession = async () => {
      if (!id) return
      
      const localSess = await db.sessions.get(id);
      if (localSess) {
         setSession(localSess);
         setIsLoading(false);
      }
      
      if (!navigator.onLine) {
         setIsLoading(false);
         return;
      }

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error || !data) {
        addToast(t("sessions.session_not_found"), "error")
        navigate('/dashboard')
        return
      }
      setSession(data)
      setIsLoading(false)
      
      // Update local cache
      if (data) {
        db.sessions.put(data)
        if (data.client_account_id) {
          const { data: clientData } = await supabase
            .from('client_accounts')
            .select('*')
            .eq('id', data.client_account_id)
            .single()
          if (clientData) {
            setClientAccount(clientData)
            db.clients.put(clientData)
          }
        }
      }
    }

    const loadProducts = async () => {
      if (!cafe) return
      
      if (!navigator.onLine) {
         const allProds = await db.products.toArray();
         setProducts(allProds.filter(p => p.active).sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0)));
         return;
      }

      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('cafe_id', cafe.id)
        .eq('active', true)
        .order('sort_order')
      if (data) {
         setProducts(data)
         db.products.bulkPut(data)
      }
    }

    loadSession()
    loadProducts()
  }, [id, cafe])

  useEffect(() => {
    if (!session) return
    const update = () => {
      const costResult = calculateSessionCost(
        session as any,
        {
          defaultRate: cafe?.default_rate || 0,
          premiumRate: cafe?.premium_rate || 0,
        }
      )
      
      setElapsed(costResult.durationFormatted)
      setTimeCost(costResult.timeCost)
      setIsLong(costResult.isLongSession)
    }

    update()
    if (session.status !== 'completed') {
      const interval = setInterval(update, 1000)
      return () => clearInterval(interval)
    }
  }, [session, cafe])

  const getExtras = (sess: Session): SessionExtra[] => {
    return Array.isArray(sess.extras) ? (sess.extras as unknown as SessionExtra[]) : []
  }

  const handleAddExtras = async () => {
    if (!session) return
    const newExtras: SessionExtra[] = [...getExtras(session)]

    Object.entries(selectedExtras).forEach(([prodId, qty]) => {
      if (qty <= 0) return
      const product = products.find(p => p.id === prodId)
      if (product) {
        newExtras.push({ id: prodId, name: product.name, price: product.price, qty })
      }
    })

    const newExtrasTotal = calculateNewExtrasTotal(newExtras)

    try {
      const data = await queueMutation('sessions', 'update', {
        id: session.id,
        extras: newExtras,
        extras_total: newExtrasTotal
      }, { ...session, extras: newExtras, extras_total: newExtrasTotal });
      
      try {
        await logAction('extras_added', {
          session_id: session.id,
          customer_name: session.customer_name,
          seat_number: session.seat_number,
          extras_added: Object.entries(selectedExtras).filter(([_, q]) => q > 0).map(([id, q]) => {
            const p = products.find(p => p.id === id)
            return { name: p?.name, qty: q, price: p?.price }
          })
        })
      } catch (e) { console.error(e) }

      setSession(data)
      setShowExtras(false)
      setSelectedExtras({})
      addToast(t("sessions.extras_added"), "success")
    } catch (error: any) {
      addToast(error.message, 'error')
    }
  }

  const handleRemoveExtra = async (index: number) => {
    if (!session) return
    const newExtras: SessionExtra[] = [...getExtras(session)]
    newExtras.splice(index, 1)
    const newExtrasTotal = calculateNewExtrasTotal(newExtras)

    try {
      const data = await queueMutation('sessions', 'update', {
        id: session.id,
        extras: newExtras,
        extras_total: newExtrasTotal
      }, { ...session, extras: newExtras, extras_total: newExtrasTotal });
      
      setSession(data)
      addToast(t("sessions.item_deleted"), "success")
    } catch (error: any) {
      addToast(error.message, 'error')
    }
  }

  const handleEndSession = async (method: string) => {
    if (!session) return
    setIsLoading(true)
    try {
      const { durationMinutes, timeCost: finalTimeCost, totalAmount } = calculateSessionCost(
        session as any,
        {
          defaultRate: cafe?.default_rate || 0,
          premiumRate: cafe?.premium_rate || 0,
        }
      )

      if (method === 'account' && clientAccount) {
        const { canAfford, newBalance, shortfall } = calculateClientAccountDebit(
          clientAccount.balance,
          totalAmount
        )
        if (!canAfford) {
          throw new Error(`Solde client insuffisant (${clientAccount.balance.toFixed(2)} DH). Manque: ${shortfall.toFixed(2)} DH`)
        }

        if (navigator.onLine && clientAccount.cafe_id) {
          const { error: rpcError } = await (supabase.rpc as any)('process_client_balance_transaction', {
            p_cafe_id: clientAccount.cafe_id,
            p_client_id: clientAccount.id,
            p_amount: totalAmount,
            p_type: 'debit',
            p_description: `Paiement session ${session.seat_number}`,
            p_staff_id: staff?.id || null,
            p_session_id: session.id
          })
          if (rpcError) throw rpcError;

          // Update total_visits separately (balance and total_spent are handled by RPC)
          await queueMutation('client_accounts', 'update', {
            id: clientAccount.id,
            total_visits: (clientAccount.total_visits || 0) + 1,
          }, {
            ...clientAccount,
            balance: newBalance,
            total_spent: (clientAccount.total_spent || 0) + totalAmount,
            total_visits: (clientAccount.total_visits || 0) + 1,
          })
        } else {
          throw new Error("Paiement par compte non disponible hors ligne.");
        }
      }

      const updatedSession = {
        ...session,
        status: 'completed',
        ended_at: new Date().toISOString(),
        duration_minutes: durationMinutes,
        time_cost: finalTimeCost,
        total_amount: totalAmount,
        payment_method: method
      };

      await queueMutation('sessions', 'update', {
        id: session.id,
        status: 'completed',
        ended_at: updatedSession.ended_at,
        duration_minutes: durationMinutes,
        time_cost: finalTimeCost,
        total_amount: totalAmount,
        payment_method: method
      }, updatedSession);

      setSession(updatedSession);

      try {
        await logAction('session_closed', {
          session_id: session.id,
          customer_name: session.customer_name,
          seat_number: session.seat_number,
          duration_minutes: durationMinutes,
          total_amount: totalAmount,
          payment_method: method
        })
      } catch (e) { console.error(e) }

      addToast(t("sessions.session_closed_amount").replace("{{amount}}", totalAmount.toFixed(2)), "success")
      setShowEnd(false)
    } catch (error: any) {
      addToast(error.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    )
  }

  const rawTotal = timeCost + session.extras_total
  const totalAmount = session.status === 'completed' ? session.total_amount : Math.max(cafe?.premium_rate || 0, rawTotal)

  return (
    <div className="min-h-screen bg-bg pb-32">
      <header className="fixed top-0 inset-x-0 h-14 bg-bg/90 backdrop-blur-xl border-b border-border z-[100] flex items-center justify-between px-4">
        <button onClick={() => navigate(-1)} className="p-2 -ms-2 text-text3 hover:text-text">
          <ChevronLeft size={20} className="rtl:rotate-180" />
        </button>
        <h1 className="text-sm font-bold text-text">Place {session.seat_number}</h1>
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
                    {session.status === 'active' && (
                      <button 
                        onClick={() => {
                          setShowMoreMenu(false)
                          // TODO: implement edit name
                        }}
                        className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-text2 hover:text-text hover:bg-surface2 transition-colors text-start"
                      >
                        <Edit2 size={16} />
                        Modifier le nom
                      </button>
                    )}
                    {type === 'owner' && (
                      <button 
                        onClick={() => {
                          setShowMoreMenu(false)
                          setShowCancel(true)
                        }}
                        className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-error hover:bg-error/10 transition-colors text-start"
                      >
                        <Trash2 size={16} />
                        Annuler la session
                      </button>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main className="pt-20 px-4 space-y-6">
        {/* Timer Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 rounded-3xl border border-accent/20 bg-linear-to-br from-accent/10 via-surface to-transparent flex flex-col items-center text-center relative overflow-hidden shadow-2xl shadow-accent/10"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-accent to-transparent opacity-50" />
          
          <div className="text-xs font-bold text-accent uppercase tracking-widest mb-1">{session.customer_name}</div>
          {session.customer_phone && (
            <div className="text-[11px] text-text3 font-medium mb-4 flex items-center justify-center gap-1.5">
              <Phone size={12} />
              {session.customer_phone}
            </div>
          )}
          <motion.div 
            animate={session.status === 'active' ? { scale: [1, 1.02, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="text-6xl font-mono font-black text-text tracking-tighter mb-6 drop-shadow-glow"
          >
            {elapsed}
          </motion.div>
          
          <div className="flex gap-6">
            <div className="flex items-center gap-2 text-text3 text-[10px] font-bold uppercase tracking-wider">
              <ClockIcon size={12} className="text-accent" />
              {format(new Date(session.started_at), 'HH:mm')}
            </div>
            <div className="flex items-center gap-2 text-text3 text-[10px] font-bold uppercase tracking-wider">
              <Gauge size={12} className="text-accent2" />
              {session.rate_per_hour.toFixed(2)} DH/h
            </div>
          </div>

          {session.status === 'completed' && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-6 px-4 py-2 bg-success/10 border border-success/20 rounded-full flex items-center gap-2 text-success text-[10px] font-black uppercase tracking-widest"
            >
              <CheckCircle size={12} />
              Terminée
            </motion.div>
          )}
          {session.status === 'cancelled' && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-6 px-4 py-2 bg-error/10 border border-error/20 rounded-full flex items-center gap-2 text-error text-[10px] font-black uppercase tracking-widest"
            >
              <AlertCircle size={12} />
              Annulée
            </motion.div>
          )}

          {isLong && session.status !== 'completed' && session.status !== 'cancelled' && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-6 px-4 py-2 bg-warning/10 border border-warning/20 rounded-full flex items-center gap-2 text-warning text-[10px] font-black uppercase tracking-widest"
            >
              <AlertCircle size={12} />
              Session longue
            </motion.div>
          )}
        </motion.div>

        {/* Premium Bill Details */}
        <section className="relative mt-8">
          <div className="bg-[#f8f9fa] text-gray-900 rounded-t-3xl rounded-b-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            {/* Header / Logo Area */}
            <div className="p-6 text-center border-b-2 border-dashed border-gray-300 bg-white relative">
               <div className="w-16 h-16 mx-auto bg-gray-900 text-white rounded-2xl flex items-center justify-center mb-3 shadow-md">
                 <img src={localStorage.getItem('nook_logo') || "/favicon.svg"} alt="Logo" className="w-8 h-8 object-contain bg-white rounded-md p-1" />
               </div>
               <h2 className="text-xl font-black tracking-tight">{cafe?.name || 'Café'}</h2>
               <div className="text-xs text-gray-500 font-medium mt-1">{cafe?.address || ''}</div>
               <div className="flex justify-center mt-3">
                 <div className="bg-gray-100 text-gray-600 border border-gray-200 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    Facture
                 </div>
               </div>
               
               {/* Semi-circle cutouts for the ticket effect */}
               <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-bg rounded-full border-r border-t border-gray-100"></div>
               <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-bg rounded-full border-l border-t border-gray-100"></div>
            </div>

            {/* Bill Lines Area */}
            <div className="p-6 pb-2 space-y-4">
              {/* Time Line */}
              <div className="flex justify-between items-start pb-4 border-b border-gray-200">
                <div>
                  <div className="text-sm font-bold text-gray-800">Temps de session</div>
                  <div className="text-xs text-gray-500 font-medium mt-0.5">
                    {elapsed.split(':').slice(0, 2).join('h ')}min
                  </div>
                </div>
                <div className="text-sm font-mono font-bold text-gray-900">
                  {timeCost.toFixed(2)} DH
                </div>
              </div>

              {/* Extras Lines */}
              {getExtras(session).length > 0 && (
                <div className="space-y-3 pb-4 border-b border-gray-200">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Consommations</div>
                  {getExtras(session).map((extra, i) => (
                    <div key={i} className="flex justify-between items-center group relative">
                      <div className="flex-1">
                        <div className="text-sm font-bold text-gray-800">{extra.name}</div>
                        <div className="text-[11px] text-gray-500 font-medium">
                          {extra.qty} × {extra.price.toFixed(2)} DH
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-mono font-bold text-gray-900">
                          {(extra.price * extra.qty).toFixed(2)} DH
                        </div>
                        {type === 'owner' && session.status === 'active' && (
                          <button 
                            onClick={() => setItemToRemove(i)}
                            className="w-6 h-6 bg-red-100 text-red-500 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors opacity-0 group-hover:opacity-100 absolute -right-2"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total Calculation */}
              <div className="pt-2 pb-6">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-sm font-black text-gray-900 uppercase tracking-wider">Total à payer</div>
                    {totalAmount > rawTotal && (
                      <div className="text-[10px] text-orange-600 font-bold mt-1">
                        * Inclut minimum facturable
                      </div>
                    )}
                  </div>
                  <div className="text-3xl font-mono font-black text-orange-600 tracking-tighter">
                    {totalAmount.toFixed(2)} <span className="text-xl">DH</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Action Bar Footer */}
            <div className="bg-gray-100 p-4 border-t border-gray-200 grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  if (cafe) {
                    generateReceiptPDF(cafe, { ...session, time_cost: timeCost, total_amount: totalAmount });
                  }
                }}
                className="w-full py-3 bg-white border border-gray-300 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-gray-700 shadow-sm active:scale-95 transition-transform uppercase tracking-wider"
              >
                <FileText size={16} />
                PDF
              </button>
              <button
                onClick={() => {
                  if (cafe) {
                    const text = generateReceiptText(cafe, { ...session, time_cost: timeCost, total_amount: totalAmount });
                    const phone = session.customer_phone?.replace(/\D/g, '');
                    if (phone) {
                      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
                    } else {
                      window.open(`https://wa.me/?text=${text}`, '_blank');
                    }
                  }
                }}
                className="w-full py-3 bg-[#25D366] border border-[#128C7E] rounded-xl flex items-center justify-center gap-2 text-xs font-black text-white shadow-sm shadow-[#25D366]/20 active:scale-95 transition-transform uppercase tracking-wider"
              >
                WhatsApp
              </button>
            </div>
          </div>
        </section>

        {session.status === 'active' && (
          <button
            onClick={() => setShowExtras(true)}
            className="w-full py-5 bg-surface2 border border-dashed border-border rounded-2xl flex items-center justify-center gap-3 text-text3 hover:text-accent hover:border-accent hover:bg-accent/5 transition-all group"
          >
            <div className="w-8 h-8 rounded-full bg-bg flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-colors">
              <Plus size={18} />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest">{t('sessions.add_extra')}</span>
          </button>
        )}
      </main>

      {/* Bottom Action */}
      {session.status === 'active' && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-linear-to-t from-bg via-bg to-transparent pt-12">
          <Button
            onClick={() => setShowEnd(true)}
            className="w-full h-14 text-lg bg-linear-to-br from-error to-[#dc2626] shadow-error/30"
          >
            <StopCircle size={20} />
            {t('sessions.end')}
          </Button>
        </div>
      )}

      {/* Extras Sheet */}
      <BottomSheet isOpen={showExtras} onClose={() => setShowExtras(false)} title="Consommations">
        <div className="space-y-6 pt-4">
          {Array.from(new Set(products.map(p => p.category))).map((cat: any) => {
            const catProducts = products.filter(p => p.category === cat)
            if (catProducts.length === 0) return null
            return (
              <div key={cat} className="space-y-3">
                <h4 className="text-[10px] font-bold text-text3 uppercase tracking-widest">{cat}</h4>
                <div className="grid grid-cols-2 gap-3">
                  {catProducts.map(p => (
                    <div 
                      key={p.id} 
                      className={`p-3 rounded-xl border transition-all ${
                        selectedExtras[p.id] ? 'bg-accent-glow border-accent' : 'bg-surface2 border-border'
                      }`}
                    >
                      <div className="text-sm font-bold text-text mb-1">{p.name}</div>
                      <div className="text-xs text-accent2 font-mono mb-3">{p.price.toFixed(2)} DH</div>
                      <div className="flex items-center justify-between">
                        <button 
                          onClick={() => setSelectedExtras(prev => ({ ...prev, [p.id]: Math.max(0, (prev[p.id] || 0) - 1) }))}
                          className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text2 border border-border"
                        >
                          -
                        </button>
                        <span className="text-sm font-bold font-mono">{selectedExtras[p.id] || 0}</span>
                        <button 
                          onClick={() => setSelectedExtras(prev => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }))}
                          className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text2 border border-border"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          <Button 
            className="w-full h-14 mt-4" 
            onClick={handleAddExtras}
            disabled={Object.values(selectedExtras).every(v => v === 0)}
          >
            Ajouter à la session
          </Button>
        </div>
      </BottomSheet>

      {/* End Session Sheet */}
      <BottomSheet isOpen={showEnd} onClose={() => setShowEnd(false)} title="Clôturer la session">
        <div className="space-y-6 pt-4">
          <div className="bg-surface2 p-4 rounded-xl border border-border space-y-2">
            <div className="flex justify-between text-xs text-text3">
              <span>{session.customer_name} — Place {session.seat_number}</span>
              <span>{elapsed.split(':').slice(0, 2).join('h ')}min</span>
            </div>
            <div className="flex justify-between items-baseline">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-text">Total à payer</span>
                {totalAmount > rawTotal && (
                  <span className="text-[10px] text-warning mt-1 italic">
                    Minimum appliqué
                  </span>
                )}
              </div>
              <span className="text-2xl font-mono font-extrabold text-accent2">{totalAmount.toFixed(2)} DH</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-text3 uppercase tracking-wider">Mode de paiement</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'cash' as const, label: 'Espèces', icon: Banknote },
                { id: 'card' as const, label: 'Carte', icon: CreditCard },
                { id: 'account' as const, label: 'Compte', icon: Wallet },
                { id: 'free' as const, label: 'Offert', icon: Gift },
              ].map(m => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(m.id);
                      if (m.id === 'cash' && !cashTendered) {
                        setCashTendered(totalAmount.toString());
                      }
                    }}
                    className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'bg-accent text-white border-accent shadow-md shadow-accent/20'
                        : 'bg-surface2 border-border text-text hover:border-border2'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cash Change Calculator */}
          {paymentMethod === 'cash' && (() => {
            const tenderedNum = parseFloat(cashTendered) || 0;
            const changeInfo = calculateChange(totalAmount, tenderedNum);
            return (
              <div className="p-4 bg-surface2 rounded-xl border border-border space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-text3">
                  <span>Espèces reçues</span>
                  <div className="flex gap-1">
                    {[totalAmount, 50, 100, 200]
                      .filter((val, idx, arr) => arr.indexOf(val) === idx && val >= totalAmount)
                      .slice(0, 4)
                      .map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCashTendered(val.toString())}
                          className="px-2 py-1 bg-surface border border-border hover:border-accent text-[11px] font-mono font-bold rounded-lg text-text"
                        >
                          {val.toFixed(0)} DH
                        </button>
                      ))}
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder={totalAmount.toFixed(2)}
                    className="w-full h-11 bg-surface border border-border rounded-xl px-4 font-mono font-bold text-text text-sm focus:outline-none focus:border-accent"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text3">DH</span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-border/50 text-xs">
                  <span className="font-bold text-text2">Monnaie à rendre</span>
                  <span className={`font-mono font-black text-sm ${
                    changeInfo.isSufficient ? 'text-green-500' : 'text-error'
                  }`}>
                    {changeInfo.isSufficient 
                      ? `${changeInfo.change.toFixed(2)} DH` 
                      : `Manque ${changeInfo.shortfall.toFixed(2)} DH`}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Account Balance Debit Preview */}
          {paymentMethod === 'account' && (
            <div className="p-4 bg-surface2 rounded-xl border border-border space-y-2">
              {clientAccount ? (() => {
                const debit = calculateClientAccountDebit(clientAccount.balance, totalAmount);
                return (
                  <>
                    <div className="flex justify-between text-xs text-text3">
                      <span>Solde actuel ({clientAccount.name})</span>
                      <span className="font-mono font-bold text-text">{clientAccount.balance.toFixed(2)} DH</span>
                    </div>
                    <div className="flex justify-between text-xs text-text3">
                      <span>Débit session</span>
                      <span className="font-mono font-bold text-error">-{totalAmount.toFixed(2)} DH</span>
                    </div>
                    <div className="flex justify-between text-xs pt-2 border-t border-border font-bold">
                      <span className="text-text">Nouveau solde</span>
                      <span className={`font-mono ${debit.canAfford ? 'text-green-500' : 'text-error'}`}>
                        {debit.newBalance.toFixed(2)} DH
                      </span>
                    </div>
                    {!debit.canAfford && (
                      <p className="text-[11px] text-error font-medium mt-1">
                        Solde insuffisant (manque {debit.shortfall.toFixed(2)} DH).
                      </p>
                    )}
                  </>
                );
              })() : (
                <p className="text-xs text-warning">
                  Aucun compte client associé à cette session.
                </p>
              )}
            </div>
          )}

          <div className="pt-2">
            <Button
              className="w-full h-14"
              onClick={() => handleEndSession(paymentMethod)}
            >
              Confirmer le paiement
            </Button>
          </div>
        </div>
      </BottomSheet>

      <ConfirmDialog
        isOpen={itemToRemove !== null}
        onClose={() => setItemToRemove(null)}
        onConfirm={() => {
          if (itemToRemove !== null) handleRemoveExtra(itemToRemove)
          setItemToRemove(null)
        }}
        title="Supprimer l'article ?"
        message="Voulez-vous vraiment retirer cet article de la session ?"
        variant="danger"
      />
    </div>
  )
}
