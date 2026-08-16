import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Armchair, StopCircle, Zap, AlertCircle, FileText } from 'lucide-react'
import { Session } from '../../types'
import { useTranslation } from '../../i18n'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

import { useAuthStore } from '../../stores/authStore'
import { generateReceiptPDF } from '../../lib/pdf'

interface SessionCardProps {
  session: Session
  onEnd: (session: Session) => void
}

export const SessionCard = ({ session, onEnd }: SessionCardProps) => {
  const { t } = useTranslation()
  const { cafe } = useAuthStore()
  const [elapsed, setElapsed] = useState('')
  const [amount, setAmount] = useState(0)
  const [isLong, setIsLong] = useState(false)

  useEffect(() => {
    const update = () => {
      const start = new Date(session.started_at).getTime()
      const now = new Date().getTime()
      const diffMs = now - start
      
      const hours = Math.floor(diffMs / 3600000)
      const minutes = Math.floor((diffMs % 3600000) / 60000)
      const seconds = Math.floor((diffMs % 60000) / 1000)
      
      setElapsed(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      
      // Calculate amount
      const durationHours = diffMs / 3600000
      const calculatedAmount = durationHours * session.rate_per_hour
      const rawTotal = calculatedAmount + session.extras_total
      setAmount(Math.max(cafe?.premium_rate || 0, rawTotal))
      
      // Check for long session based on cafe settings
      const alertHours = cafe?.long_session_alert_hours || 3
      if (hours >= alertHours) setIsLong(true)
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [session])

  return (
    <motion.div
      layout
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={() => onEnd(session)}
      className={`relative p-5 rounded-2xl border transition-all duration-500 cursor-pointer overflow-hidden ${
        isLong 
          ? 'bg-error/5 border-error/40 shadow-2xl shadow-error/10' 
          : 'bg-surface border-border hover:border-border2 shadow-sm'
      }`}
    >
      {isLong && (
        <>
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-error/60 via-error to-error/60 animate-pulse" />
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-error/10 rounded-full blur-3xl animate-pulse" />
        </>
      )}

      <div className="flex items-start justify-between mb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className={`badge ${isLong ? 'bg-error text-white' : 'bg-accent/10 text-accent border border-accent/20 font-bold'}`}>
              <Armchair size={10} />
              <span className="text-[10px]">Place {session.seat_number}</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-text3" />
            <div className="text-[10px] font-bold text-text3 tracking-wider uppercase">{format(new Date(session.started_at), 'HH:mm')}</div>
          </div>
          <h3 className="text-base font-bold text-text leading-tight">{session.customer_name}</h3>
        </div>
        <div className="h-6 px-2.5 bg-surface2/80 rounded-lg flex items-center text-[10px] font-mono font-bold text-text3 border border-white/5 uppercase tracking-wider">
          {session.rate_per_hour.toFixed(2)} DH/h
        </div>
      </div>

      {isLong && (
        <motion.div 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-1.5 text-error text-[10px] font-black uppercase tracking-[0.2em] mb-4"
        >
          <div className="w-2 h-2 rounded-full bg-error animate-ping" />
          <span>ALERTE: SESSION LONGUE</span>
        </motion.div>
      )}

      <div className="mt-4 flex items-center justify-between glass border-white/5 rounded-2xl p-4">
        <div className="flex items-center gap-6">
          <div className="space-y-1.5">
            <div className="text-[9px] text-text3 font-black uppercase tracking-[0.2em]">{t('sessions.duration')}</div>
            <div className="text-xl font-mono font-extrabold text-text leading-none tracking-tighter">{elapsed}</div>
          </div>
          
          <div className="w-px h-8 bg-linear-to-b from-transparent via-border to-transparent" />
          
          <div className="space-y-1.5">
            <div className="text-[9px] text-text3 font-black uppercase tracking-[0.2em]">{t('sessions.amount')}</div>
            <div className="text-xl font-mono font-extrabold text-accent leading-none tracking-tighter">{amount.toFixed(2)} DH</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (cafe) {
                const diffMs = new Date().getTime() - new Date(session.started_at).getTime();
                const durationMinutes = Math.floor(diffMs / 60000);
                const rawTimeCost = (durationMinutes / 60) * session.rate_per_hour;
                generateReceiptPDF(cafe, { ...session, duration_minutes: durationMinutes, time_cost: rawTimeCost, total_amount: amount });
              }
            }}
            className="w-10 h-10 flex items-center justify-center bg-surface2/50 border border-border/50 text-text2 rounded-xl transition-all hover:bg-surface2 hover:text-text hover:border-text/10 active:scale-90"
            title="Recu"
          >
            <FileText size={16} />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEnd(session);
            }}
            className="w-12 h-10 flex items-center justify-center bg-error/10 border border-error/20 text-error rounded-xl transition-all hover:bg-error/20 active:scale-90"
          >
            <StopCircle size={20} className="fill-error/20" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
