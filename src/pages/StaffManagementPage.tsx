import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { 
  ChevronLeft, Plus, User, Key, Timer, 
  BarChart2, Users, Settings, Trash2, Loader2, Check,
  Search, Filter, Power, DollarSign, Lock, MessageCircle, Phone
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useUIStore } from '../stores/uiStore'
import { useTranslation } from '../i18n'
import { useAudit } from '../hooks/useAudit'
import { Staff, Database, StaffPermissions } from '../types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { NumPad } from '../components/ui/NumPad'
import { PINDots } from '../components/ui/PINDots'
import { hashPIN } from '../lib/crypto'

import { db } from '../lib/offlineDB'

import { queueMutation } from '../lib/offlineSync'

export default function StaffManagementPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { cafe } = useAuthStore()
  const addToast = useUIStore((state) => state.addToast)
  const { logAction } = useAudit()

  const [staffList, setStaffList] = useState<Staff[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [showEdit, setShowEdit] = useState(false)

  // New Staff Form
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [permissions, setPermissions] = useState({
    sessions: true,
    reports: false,
    clients: false,
    settings: false,
    rates: false
  })
  const [isActive, setIsActive] = useState(true)

  const loadStaff = async () => {
    if (!cafe) return
    setIsLoading(true)

    const localStaff = await db.staff.toArray()
    if (localStaff.length > 0) {
      setStaffList(localStaff.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      setIsLoading(false)
    }

    if (!navigator.onLine) {
        setIsLoading(false)
        return
    }

    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('cafe_id', cafe.id)
      .order('created_at', { ascending: false })
    if (data) {
       setStaffList(data)
       db.staff.bulkPut(data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadStaff()
  }, [cafe])

  const handleAddStaff = async () => {
    if (!cafe || !name || pin.length < 4) return
    setIsSaving(true)
    try {
      const pinHash = await hashPIN(pin)
      
      const payload = {
          id: crypto.randomUUID(),
          cafe_id: cafe.id,
          name,
          phone: phone || null,
          pin_hash: pinHash,
          permissions,
          active: true,
          created_at: new Date().toISOString()
      };

      await queueMutation('staff', 'insert', payload, payload);
      
      try {
         await logAction('staff_created', {
           staff_name: name,
           permissions
         })
      } catch(e) {}

      addToast(t('staff.staff_added'), "success")
      setShowAdd(false)
      setName('')
      setPhone('')
      setPin('')
      setPermissions({ sessions: true, reports: false, clients: false, settings: false, rates: false })
      setIsActive(true)
      loadStaff()
    } catch (error: any) {
      addToast(error.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteStaff = async () => {
    if (!staffToDelete) return
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', staffToDelete.id)
      
      if (error) throw error
      
      await logAction('staff_deleted', {
        staff_id: staffToDelete.id,
        staff_name: staffToDelete.name
      })

      addToast(t('staff.staff_deleted'), "success")
      setStaffToDelete(null)
      loadStaff()
    } catch (error: any) {
      addToast(error.message, 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleStaffActive = async (staff: Staff) => {
    try {
      const { error } = await supabase
        .from('staff')
        .update({ active: !staff.active })
        .eq('id', staff.id)
      
      if (error) throw error
      
      await logAction('staff_updated', {
        staff_id: staff.id,
        staff_name: staff.name,
        active: !staff.active
      })

      loadStaff()
      addToast(staff.active ? t('staff.staff_deactivated') : t('staff.staff_activated'), "success")
    } catch (error: any) {
      addToast(error.message, 'error')
    }
  }

  const handleUpdateStaff = async () => {
    if (!editingStaff || !name) return
    setIsSaving(true)
    try {
      const updateData: Partial<Database['public']['Tables']['staff']['Update']> = {
        name,
        phone: phone || null,
        permissions: permissions as any,
        active: isActive
      }
      
      // Only update PIN if provided
      if (pin.length === 4) {
        updateData.pin_hash = await hashPIN(pin)
      }

      const { error } = await supabase
        .from('staff')
        .update(updateData)
        .eq('id', editingStaff.id)
      
      if (error) throw error
      
      await logAction('staff_updated', {
        staff_id: editingStaff.id,
        staff_name: name,
        permissions,
        active: isActive,
        pin_changed: pin.length === 4
      })

      addToast(t('staff.staff_updated'), "success")
      setShowEdit(false)
      setEditingStaff(null)
      setName('')
      setPhone('')
      setPin('')
      setPermissions({ sessions: true, reports: false, clients: false, settings: false, rates: false })
      setIsActive(true)
      loadStaff()
    } catch (error: any) {
      addToast(error.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const getStaffPerms = (staff: Staff): { sessions: boolean; reports: boolean; clients: boolean; settings: boolean; rates: boolean } => {
    if (!staff.permissions) {
      return { sessions: true, reports: false, clients: false, settings: false, rates: false }
    }
    const perms = staff.permissions as unknown as StaffPermissions
    return {
      sessions: true,
      reports: !!perms.reports,
      clients: !!perms.clients,
      settings: !!perms.settings,
      rates: !!perms.rates
    }
  }

  const openEdit = (staff: Staff) => {
    setEditingStaff(staff)
    setName(staff.name)
    setPhone(staff.phone || '')
    setPermissions(getStaffPerms(staff))
    setIsActive(staff.active)
    setPin('')
    setShowEdit(true)
  }

  const togglePermission = (key: keyof StaffPermissions) => {
    if (key === 'sessions') return // Always required
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const filteredStaff = staffList.filter(staff => {
    const matchesSearch = staff.name.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = statusFilter === 'all' || 
                         (statusFilter === 'active' && staff.active) || 
                         (statusFilter === 'inactive' && !staff.active)
    return matchesSearch && matchesFilter
  })

  return (
    <div className="min-h-screen bg-bg pb-12">
      <header className="fixed top-0 inset-x-0 h-14 bg-bg/90 backdrop-blur-xl border-b border-border z-[100] flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 -ms-2 text-text3 hover:text-text">
            <ChevronLeft size={20} className="rtl:rotate-180" />
          </button>
          <h1 className="text-sm font-bold text-text">{t('staff.title')}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => {
              const searchInput = document.getElementById('staff-search')
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
            className="p-2 text-text3 hover:text-text"
          >
            <Search size={20} />
          </button>
          <button 
            onClick={() => setShowFilters(true)} 
            className="p-2 text-text3 hover:text-text relative"
          >
            <Filter size={20} />
            {statusFilter !== 'all' && (
              <span className="absolute top-2 end-2 w-2 h-2 bg-accent rounded-full" />
            )}
          </button>
          <button onClick={() => setShowAdd(true)} className="p-2 -me-2 text-accent hover:text-accent2">
            <Plus size={20} />
          </button>
        </div>
      </header>

      <main className="pt-20 px-4 space-y-4">
        <div 
          id="staff-search" 
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ height: 0, opacity: 0, marginBottom: 0 }}
        >
          <Input
            placeholder={t('staff.search_placeholder')}
            icon={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filteredStaff.map((staff) => (
          <div 
            key={staff.id} 
            onClick={() => openEdit(staff)}
            className="bg-surface border border-border rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-accent-border transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-surface2 rounded-full flex items-center justify-center text-text3">
                <User size={20} />
              </div>
              <div>
                <div className="text-sm font-bold text-text">{staff.name}</div>
                {(() => {
                  const perms = getStaffPerms(staff);
                  return (
                    <div className="flex gap-1.5 mt-1">
                      {perms.sessions && <Timer size={10} className="text-accent" />}
                      {perms.reports && <BarChart2 size={10} className="text-info" />}
                      {perms.clients && <Users size={10} className="text-success" />}
                      {perms.settings && <Settings size={10} className="text-warning" />}
                      {perms.rates && <DollarSign size={10} className="text-accent2" />}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  openEdit(staff)
                }}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors ${
                  staff.active ? 'bg-success-dim text-success hover:bg-success/20' : 'bg-surface2 text-text3 hover:bg-surface3'
                }`}
              >
                {staff.active ? t('staff.active') : t('staff.inactive')}
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  toggleStaffActive(staff)
                }}
                className={`p-2 rounded-lg transition-colors ${staff.active ? 'text-success hover:bg-success/10' : 'text-text3 hover:bg-surface2'}`}
                title={staff.active ? t('staff.deactivate') : t('staff.activate')}
              >
                <Power size={18} />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  setStaffToDelete(staff)
                }}
                className="p-2 text-text3 hover:text-error transition-colors"
                title={t('staff.delete')}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}

        {filteredStaff.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-text3">
            <Users size={40} className="mb-4 opacity-20" />
            <p className="text-sm font-medium">
              {search || statusFilter !== 'all' ? t('staff.no_results') : t('staff.no_staff')}
            </p>
          </div>
        )}
      </main>

      <BottomSheet 
        isOpen={showAdd || showEdit} 
        onClose={() => {
          setShowAdd(false)
          setShowEdit(false)
          setEditingStaff(null)
          setName('')
          setPin('')
          setPermissions({ sessions: true, reports: false, clients: false, settings: false, rates: false })
          setIsActive(true)
        }} 
        title={showEdit ? t('staff.edit_staff') : t('staff.add')}
      >
        <div className="space-y-6 pt-4">
          <div className="space-y-4">
            <Input
              placeholder={t('staff.name')}
              icon={<User size={18} />}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            
            <Input
              placeholder="06 XX XX XX XX"
              icon={<Phone size={18} />}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
            />
          </div>

          {showEdit && !pin && (
            <div className="bg-surface2 p-4 rounded-xl border border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-surface rounded-full flex items-center justify-center text-text3 border border-border">
                  <Key size={18} />
                </div>
                <div>
                  <div className="text-sm font-bold text-text">{t('auth.password')}</div>
                  <div className="text-[12px] text-text3 tracking-[0.2em] font-mono">****</div>
                </div>
              </div>
              <Button variant="ghost" className="h-9 px-3 text-[11px]" onClick={() => setPin(' ')}>
                {t('staff.change_pin')}
              </Button>
            </div>
          )}

          {(!showEdit || pin) && (
            <div className="space-y-4">
              <label className="text-xs font-bold text-text3 uppercase tracking-widest text-center block w-full">
                {showEdit ? t('staff.new_pin') : t('staff.pin_setup')}
              </label>
              
              <div className="flex flex-col items-center gap-6">
                <PINDots length={pin === ' ' ? 0 : pin.length} />
                
                <div className="w-full max-w-[280px]">
                  <NumPad 
                    onPress={(val) => {
                      if (pin === ' ') setPin(val)
                      else if (pin.length < 4) setPin(pin + val)
                    }}
                    onDelete={() => {
                        if (pin === ' ') return
                        setPin(pin.slice(0, -1))
                    }}
                  />
                </div>
              </div>

              {showEdit && pin && (
                <div className="flex justify-center">
                  <Button variant="ghost" size="sm" onClick={() => setPin('')}>
                    {t('common.cancel')}
                  </Button>
                </div>
              )}
              
              {pin.length === 4 && phone && name && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <Button 
                    type="button"
                    onClick={() => {
                      const msg = `Bienvenue dans Nook OS ! 👋\n\nTon profil a été complété. Voici tes accès:\n\nNom d'utilisateur: *${name}*\nCode Café: *${cafe?.invite_code || ''}*\nCode PIN: *${pin}*\n\nLien: https://nookos.ma`
                      window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')
                    }}
                    className="w-full mt-2 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 hover:bg-[#25D366]/20"
                  >
                    <MessageCircle size={18} />
                    Envoyer les accès via WhatsApp
                  </Button>
                </motion.div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text3 uppercase tracking-widest">Statut du compte</label>
            <button
              onClick={() => setIsActive(!isActive)}
              className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
                isActive ? 'bg-[#0f2922] border-[#134e3a]' : 'bg-surface2 border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? 'bg-success text-white' : 'bg-border text-text3'}`}>
                  <Check size={16} />
                </div>
                <div className="text-start">
                  <div className="text-sm font-bold text-text">{isActive ? t('staff.account_active') : t('staff.account_inactive')}</div>
                  <div className="text-[10px] text-text3">{isActive ? t('staff.can_login') : t('staff.cannot_login')}</div>
                </div>
              </div>
              <div className={`w-10 h-5 rounded-full relative transition-colors ${isActive ? 'bg-success' : 'bg-border'}`}>
                <motion.div 
                  animate={{ x: isActive ? 22 : 2 }}
                  className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm"
                />
              </div>
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-text3 uppercase tracking-widest">{t('staff.permissions')}</label>
            <div className="space-y-2">
              {([
                { id: 'sessions', icon: Timer, label: t('staff.perm_sessions'), locked: true },
                { id: 'reports', icon: BarChart2, label: t('staff.perm_reports'), locked: false },
                { id: 'clients', icon: Users, label: t('staff.perm_clients'), locked: false },
                { id: 'settings', icon: Settings, label: t('staff.perm_settings'), locked: false },
                { id: 'rates', icon: DollarSign, label: t('staff.perm_rates'), locked: false },
              ] as const).map(perm => (
                <button
                  key={perm.id}
                  onClick={() => togglePermission(perm.id)}
                  className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
                    permissions[perm.id] ? 'bg-[#2a1a14] border-accent' : 'bg-surface2 border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <perm.icon size={18} className={permissions[perm.id] ? 'text-accent' : 'text-text3'} />
                    <div className="text-start">
                      <div className="text-sm font-bold text-text">{perm.label}</div>
                      {perm.locked && <div className="text-[10px] text-text3 italic">{t('staff.always_on')}</div>}
                    </div>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${
                    permissions[perm.id] ? 'bg-accent' : 'bg-border'
                  }`}>
                    <motion.div 
                      animate={{ x: permissions[perm.id] ? 22 : 2 }}
                      className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm"
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Button 
            className="w-full h-14 mt-4" 
            onClick={showEdit ? handleUpdateStaff : handleAddStaff}
            isLoading={isSaving}
            disabled={!name || (!showEdit && pin.length < 4) || Boolean(showEdit && pin && pin !== ' ' && pin.length < 4)}
          >
            {showEdit ? t('staff.save') : t('staff.create')}
          </Button>

          {showEdit && (
            <div className="mt-8 pt-6 border-t border-border">
              <label className="text-[10px] font-bold text-error uppercase tracking-widest mb-4 block">
                Zone de danger
              </label>
              <Button
                variant="danger"
                className="w-full h-14"
                onClick={() => {
                  setStaffToDelete(editingStaff)
                  setShowEdit(false)
                }}
              >
                <Trash2 size={18} />
                {t('staff.delete')}
              </Button>
            </div>
          )}
        </div>
      </BottomSheet>

      <ConfirmDialog
        isOpen={staffToDelete !== null}
        onClose={() => setStaffToDelete(null)}
        onConfirm={handleDeleteStaff}
        title={t('staff.delete_staff')}
        message={`${t('staff.delete_confirm')} ${staffToDelete?.name} ?`}
        variant="danger"
        confirmLabel={isDeleting ? t('staff.deleting') : t('staff.delete')}
      />

      <BottomSheet
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        title={t('common.filters') || 'Filtres'}
      >
        <div className="space-y-6 pt-4">
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-text3 uppercase tracking-widest">Par statut</h3>
            <div className="flex flex-wrap gap-2">
              {([
                { id: 'all' as const, label: t('common.all') },
                { id: 'active' as const, label: t('staff.active') },
                { id: 'inactive' as const, label: t('staff.inactive') },
              ]).map(s => (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id)}
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

          <button
            onClick={() => setShowFilters(false)}
            className="w-full h-12 bg-gradient-to-br from-accent to-[#ea6b0a] text-white font-bold rounded-xl shadow-[0_2px_12px_rgba(249,115,22,0.25)] mt-4 active:scale-[0.98] transition-all"
          >
            {t('common.apply') || 'Appliquer'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
