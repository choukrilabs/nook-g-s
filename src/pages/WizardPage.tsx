import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { 
  Store, MapPin, Navigation, Phone, Armchair, Clock as ClockIcon, Star, Timer, 
  User, CheckCircle, ArrowRight, Copy, Check, Loader2, Sliders, Lock
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useUIStore } from '../stores/uiStore'
import { useTranslation } from '../i18n'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { NumPad } from '../components/ui/NumPad'
import { PINDots } from '../components/ui/PINDots'
import { hashPIN } from '../lib/crypto'

export default function WizardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { owner, setCafe } = useAuthStore()
  const addToast = useUIStore((state) => state.addToast)

  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  // Step 1: Cafe Info
  const [cafeName, setCafeName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')

  // Step 2: Config
  const [seats, setSeats] = useState(20)
  const [defaultRate, setDefaultRate] = useState(2.00)
  const [premiumRate, setPremiumRate] = useState(3.00)
  const [billingIncrement, setBillingIncrement] = useState('minute')

  // Step 3: Staff
  const [addStaff, setAddStaff] = useState(false)
  const [staffName, setStaffName] = useState('')
  const [staffPin, setStaffPin] = useState('')
  const [staffPermissions, setStaffPermissions] = useState({
    sessions: true,
    reports: false,
    clients: false,
    settings: false
  })

  // Step 4: Final
  const [inviteCode, setInviteCode] = useState('')

  const handleFinish = async () => {
    setIsLoading(true)
    try {
      // 1. Generate invite code with collision check
      let code = ''
      let isUnique = false
      
      while (!isUnique) {
        code = Math.floor(100000 + Math.random() * 900000).toString()
        const { data: existing } = await supabase
          .from('cafes')
          .select('id')
          .eq('invite_code', code)
          .maybeSingle()
          
        if (!existing) {
          isUnique = true
        }
      }
      
      setInviteCode(code)

      // 2. Insert Cafe
      const { data: cafe, error: cafeError } = await supabase
        .from('cafes')
        .insert({
          owner_id: owner?.id,
          name: cafeName,
          city,
          address,
          phone,
          total_seats: seats,
          default_rate: defaultRate,
          premium_rate: premiumRate,
          billing_increment: billingIncrement,
          invite_code: code,
          setup_complete: true
        })
        .select()
        .single()
      
      if (cafeError) throw cafeError
      if (!cafe) throw new Error('Could not create cafe')

      // 3. Insert Staff if needed
      if (addStaff && staffName && staffPin) {
        const pinHash = await hashPIN(staffPin)
        const { error: staffError } = await supabase
          .from('staff')
          .insert({
            cafe_id: cafe.id,
            name: staffName,
            pin_hash: pinHash,
            permissions: staffPermissions
          })
        
        if (staffError) throw staffError
      }

      setCafe(cafe)
      setStep(4)
    } catch (error: any) {
      addToast(error.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text">{t('wizard.step1.title')}</h2>
              <p className="text-sm text-text2 mt-2">{t('wizard.step1.subtitle')}</p>
            </div>
            <div className="space-y-4">
              <Input
                placeholder={t("wizard.step1.title")}
                icon={<Store size={18} />}
                value={cafeName}
                onChange={(e) => setCafeName(e.target.value)}
                required
              />
              <Input
                placeholder={t("wizard.step1.subtitle")}
                icon={<MapPin size={18} />}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <Input
                placeholder={t("wizard.step1.title")}
                icon={<Navigation size={18} />}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <Input
                type="tel"
                placeholder="06 XX XX XX XX"
                icon={<Phone size={18} />}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button onClick={() => setStep(2)} className="w-full" disabled={!cafeName}>
              {t('common.next')}
            </Button>
          </motion.div>
        )
      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text">{t('wizard.step2.title')}</h2>
              <p className="text-sm text-text2 mt-2">{t('wizard.step2.subtitle')}</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text3 uppercase tracking-wider">Nombre de places</label>
                <div className="flex items-center gap-4">
                  <Button variant="ghost" className="w-12 h-12 p-0" onClick={() => setSeats(Math.max(1, seats - 1))}>-</Button>
                  <Input type="number" className="text-center font-mono text-lg" value={seats} onChange={(e) => setSeats(parseInt(e.target.value) || 0)} />
                  <Button variant="ghost" className="w-12 h-12 p-0" onClick={() => setSeats(seats + 1)}>+</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text3 uppercase tracking-wider">Tarif standard (DH/h)</label>
                  <Input type="number" step="0.5" icon={<ClockIcon size={16} />} value={defaultRate} onChange={(e) => setDefaultRate(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text3 uppercase tracking-wider">Minimum à payer (DH)</label>
                  <Input type="number" step="0.5" icon={<Star size={16} />} value={premiumRate} onChange={(e) => setPremiumRate(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text3 uppercase tracking-wider">Incrément de facturation</label>
                <select 
                  className="input appearance-none"
                  value={billingIncrement}
                  onChange={(e) => setBillingIncrement(e.target.value)}
                >
                  <option value="minute">À la minute (défaut)</option>
                  <option value="15min">Par 15 minutes</option>
                  <option value="30min">Par 30 minutes</option>
                  <option value="hour">À l'heure</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setStep(1)}>{t('common.back')}</Button>
              <Button className="flex-[2]" onClick={() => setStep(3)}>{t('common.next')}</Button>
            </div>
          </motion.div>
        )
      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="text-2xl font-bold text-text">{t('wizard.step3.title')}</h2>
              <p className="text-sm text-text2 mt-2">{t('wizard.step3.subtitle')}</p>
            </div>
            
            <div 
              onClick={() => setAddStaff(!addStaff)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                addStaff ? 'bg-accent-glow border-accent-border' : 'bg-surface2 border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  addStaff ? 'bg-accent border-accent' : 'border-border'
                }`}>
                  {addStaff && <Check size={12} className="text-white" />}
                </div>
                <span className="text-sm font-medium text-text">Ajouter un employé maintenant</span>
              </div>
            </div>

            {addStaff && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-6 pt-2"
              >
                <Input
                  placeholder={t("staff.name")}
                  icon={<User size={18} />}
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text2">{t('staff.pin_setup')}</label>
                  <div className="relative w-full">
                    <div className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none text-text3">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={staffPin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '')
                        setStaffPin(val)
                      }}
                      placeholder={t('auth.password')}
                      className="input ps-11"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            <div className="flex flex-col gap-3">
              <Button onClick={() => { setAddStaff(false); handleFinish(); }} className="w-full" isLoading={isLoading}>
                {addStaff ? t('common.next') : t('common.next')}
              </Button>
              {addStaff && (
                <button onClick={() => { setAddStaff(false); handleFinish(); }} className="text-sm text-text3 hover:text-text transition-colors">
                  Ignorer cette étape
                </button>
              )}
            </div>
          </motion.div>
        )
      case 4:
        return (
          <motion.div
            key="step4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8 text-center"
          >
            <div className="flex flex-col items-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12 }}
                className="w-16 h-16 bg-success-dim text-success rounded-full flex items-center justify-center mb-4"
              >
                <CheckCircle size={40} />
              </motion.div>
              <h2 className="text-2xl font-bold text-text">{t('wizard.step4.title')}</h2>
            </div>

            <div className="bg-surface2 border border-border rounded-2xl p-6 space-y-4">
              <p className="text-xs font-semibold text-text3 uppercase tracking-wider">Code d'invitation de votre café</p>
              <div className="bg-black/25 border border-border rounded-xl p-4 flex items-center justify-center gap-4 group">
                <span className="text-3xl font-mono font-bold text-text tracking-[0.3em] ps-[0.3em]">
                  {inviteCode}
                </span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(inviteCode)
                    addToast(t("wizard.code_copied"), "success")
                  }}
                  className="p-2 text-text3 hover:text-accent transition-colors"
                >
                  <Copy size={20} />
                </button>
              </div>
              <p className="text-xs text-text3">Partagez ce code avec vos employés pour qu'ils puissent se connecter</p>
            </div>

            <Button onClick={() => navigate('/dashboard')} className="w-full h-14 text-lg">
              {t('wizard.finish')}
              <ArrowRight size={20} className="rtl:rotate-180" />
            </Button>
          </motion.div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center p-6 pt-12">
      {/* Progress Indicator */}
      {step < 4 && (
        <div className="w-full max-w-[520px] flex items-center justify-between mb-12 relative px-2">
          <div className="absolute top-1/2 inset-x-0 h-0.5 bg-border -translate-y-1/2 z-0" />
          {[1, 2, 3].map((s) => (
            <div key={s} className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                step === s ? 'bg-accent text-white scale-110 shadow-lg shadow-accent/30' : 
                step > s ? 'bg-success text-white' : 'bg-surface2 text-text3 border border-border'
              }`}>
                {step > s ? <Check size={14} /> : s}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="w-full max-w-[520px]">
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </div>
    </div>
  )
}
