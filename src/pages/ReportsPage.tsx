import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { 
  BarChart2, TrendingUp, Users, Clock as ClockIcon, 
  Banknote, CreditCard, Wallet, Gift,
  Calendar, ChevronDown, Loader2, Activity, ChevronLeft,
  Download, Coffee, Utensils, Package
} from 'lucide-react'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell 
} from 'recharts'
import { supabase } from '../lib/supabase'
import { db } from '../lib/offlineDB'
import { useAuthStore } from '../stores/authStore'
import { useTranslation } from '../i18n'
import { Session } from '../types'
import { TopBar } from '../components/layout/TopBar'
import { format, startOfDay, subDays, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function ReportsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { cafe } = useAuthStore()
  
  const [sessions, setSessions] = useState<Session[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week')
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      if (!cafe) return
      setIsLoading(true)
      
      let startDate = startOfDay(new Date())
      if (period === 'week') startDate = subDays(startDate, 7)
      if (period === 'month') startDate = subMonths(startDate, 1)

      // Load products safely first
      let localProducts: any[] = []
      try {
        localProducts = await db.products.where('cafe_id').equals(cafe.id).toArray()
      } catch (e) {
        console.warn('Failed to load local products', e)
      }

      // Load local data first
      let localSessions: Session[] = []
      try {
        localSessions = await db.sessions
          .where('status').equals('completed')
          .filter(s => new Date(s.ended_at!) >= startDate)
          .sortBy('ended_at');
      } catch (e) {
        console.warn('Failed to load local sessions', e)
      }
      
      if (localSessions.length > 0) {
        setSessions(localSessions)
      }

      if (localProducts.length > 0) {
        setProducts(localProducts)
      }

      if (!navigator.onLine) {
         setIsLoading(false)
         return
      }

      const [sessionsRes, productsRes] = await Promise.all([
        supabase
          .from('sessions')
          .select('*')
          .eq('cafe_id', cafe.id)
          .eq('status', 'completed')
          .gte('ended_at', startDate.toISOString())
          .order('ended_at', { ascending: true }),
        supabase
          .from('products')
          .select('*')
          .eq('cafe_id', cafe.id)
      ])
      
      if (sessionsRes.data) {
         setSessions(sessionsRes.data)
         db.sessions.bulkPut(sessionsRes.data)
      }
      
      if (productsRes.data) {
         setProducts(productsRes.data)
         db.products.bulkPut(productsRes.data)
      }

      setIsLoading(false)
    }

    loadData()
  }, [cafe, period])

  const stats = {
    revenue: sessions.reduce((acc, s) => acc + s.total_amount, 0),
    count: sessions.length,
    avgDuration: sessions.length > 0 
      ? Math.round(sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0) / sessions.length)
      : 0,
    payments: sessions.reduce((acc: any, s) => {
      const method = s.payment_method || 'other'
      acc[method] = (acc[method] || 0) + s.total_amount
      return acc
    }, {})
  }

  const itemSales = sessions.reduce((acc: Record<string, {name: string, qty: number}>, s) => {
    if (Array.isArray(s.extras)) {
      s.extras.forEach((extra: any) => {
        if (!acc[extra.id]) {
          acc[extra.id] = { name: extra.name, qty: 0 }
        }
        acc[extra.id].qty += extra.qty
      })
    }
    return acc
  }, {})

  const bestSellingItem = (Object.values(itemSales) as {name: string, qty: number}[]).sort((a, b) => b.qty - a.qty)[0]

  const categoryRevenue: Record<string, number> = sessions.reduce((acc: Record<string, number>, s) => {
    if (Array.isArray(s.extras)) {
      s.extras.forEach((extra: any) => {
        const product = products.find(p => p.id === extra.id)
        const category = product?.category || 'autre'
        acc[category] = (acc[category] || 0) + (extra.price * extra.qty)
      })
    }
    return acc
  }, { boisson: 0, nourriture: 0, autre: 0 } as Record<string, number>)

  // Chart Data
  const chartData = sessions.reduce((acc: any[], s) => {
    const dateStr = period === 'today' 
      ? format(new Date(s.ended_at!), 'HH:00') 
      : format(new Date(s.ended_at!), 'dd/MM')
    
    const existing = acc.find(d => d.date === dateStr)
    if (existing) {
      existing.revenue += s.total_amount
    } else {
      acc.push({ date: dateStr, revenue: s.total_amount })
    }
    return acc
  }, [])

  const generatePDF = async () => {
    if (!cafe) return

    const doc = new jsPDF()
    
    // Header
    doc.setFontSize(22)
    doc.text(cafe.name, 14, 20)
    doc.setFontSize(12)
    doc.text(`Rapport - Période: ${period === 'today' ? t('common.today') : period === 'week' ? t('common.thisWeek') : t('common.thisMonth')}`, 14, 30)
    doc.setFontSize(10)
    doc.text(`${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 36)

    // Summary Statistics
    doc.setFontSize(14)
    doc.text('Résumé', 14, 50)
    
    autoTable(doc, {
      startY: 55,
      head: [['Sessions', 'Revenu Total', 'Moyenne (min)', 'Paiements (Espèces/Carte/Compte/Gratuit)']],
      body: [
        [
          stats.count.toString(), 
          `${stats.revenue.toFixed(2)} DH`, 
          stats.avgDuration.toString(),
          `${stats.payments.cash?.toFixed(2) || '0'} / ${stats.payments.card?.toFixed(2) || '0'} / ${stats.payments.account?.toFixed(2) || '0'} / ${stats.payments.free?.toFixed(2) || '0'}`
        ]
      ],
      theme: 'grid',
      headStyles: { fillColor: [249, 115, 22] }
    })

    // Category Breakdown
    let finalY = (doc as any).lastAutoTable.finalY || 80
    doc.setFontSize(14)
    doc.text('Revenus par Catégorie', 14, finalY + 15)

    autoTable(doc, {
      startY: finalY + 20,
      head: [['Boissons', 'Nourriture', 'Autres']],
      body: [
        [
          `${(categoryRevenue['boisson'] || 0).toFixed(2)} DH`,
          `${(categoryRevenue['nourriture'] || 0).toFixed(2)} DH`,
          `${(categoryRevenue['autre'] || 0).toFixed(2)} DH`
        ]
      ],
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40] }
    })

    // Session Details
    finalY = (doc as any).lastAutoTable.finalY || 120
    doc.setFontSize(14)
    doc.text('Détails des Sessions', 14, finalY + 15)

    const sessionData = sessions.map(s => [
      format(new Date(s.ended_at!), 'dd/MM/yyyy HH:mm'),
      s.customer_name || '-',
      s.seat_number?.toString() || '-',
      s.duration_minutes?.toString() || '0',
      `${s.total_amount.toFixed(2)} DH`,
      s.payment_method || '-'
    ])

    autoTable(doc, {
      startY: finalY + 20,
      head: [['Date', 'Client', 'Place', 'Durée (min)', 'Montant', 'Mode de Paiement']],
      body: sessionData,
      theme: 'striped',
      headStyles: { fillColor: [40, 40, 40] }
    })

    // Capture Chart
    finalY = (doc as any).lastAutoTable.finalY || 100
    try {
      const chartElement = document.getElementById('report-chart-container')
      if (chartElement) {
        // Add new page if not enough space
        if (finalY > doc.internal.pageSize.height - 100) {
          doc.addPage()
          finalY = 20
        } else {
          finalY += 20
        }
        
        doc.setFontSize(14)
        doc.text('Évolution des Revenus', 14, finalY)
        
        const canvas = await html2canvas(chartElement, { scale: 2, backgroundColor: '#080b12' })
        const imgData = canvas.toDataURL('image/png')
        
        const imgWidth = doc.internal.pageSize.width - 28
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        doc.addImage(imgData, 'PNG', 14, finalY + 10, imgWidth, imgHeight)
      }
    } catch (err) {
      console.error('Error capturing chart', err)
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(10)
        doc.text(
            `Page ${i} - Généré par Nook OS`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        )
    }

    doc.save(`Rapport_${cafe.name}_${period}.pdf`)
  }

  return (
    <div className="min-h-screen bg-bg pb-8">
      <TopBar />

      <main className="pt-20 px-4 space-y-6">
        {/* Period Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'today', label: t('common.today') },
            { id: 'week', label: t('common.thisWeek') },
            { id: 'month', label: t('common.thisMonth') },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as any)}
              className={`flex-shrink-0 px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition-all ${
                period === p.id 
                  ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20' 
                  : 'bg-surface/50 text-text3 border-white/5 hover:border-white/10 glass'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Technical Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass border-white/5 p-5 rounded-3xl shadow-sm relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-accent/5 rounded-full blur-2xl group-hover:bg-accent/10 transition-colors" />
            <div className="flex flex-col gap-3 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                  <Banknote size={12} />
                </div>
                <span className="text-[9px] font-black text-text3 uppercase tracking-[0.2em]">{t('reports.revenue') || 'Revenu'}</span>
              </div>
              <div className="text-xl font-mono font-extrabold text-accent leading-none">
                {stats.revenue.toFixed(2)} <span className="text-[10px] opacity-60">DH</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass border-white/5 p-5 rounded-3xl shadow-sm relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />
            <div className="flex flex-col gap-3 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-surface2 flex items-center justify-center text-text2">
                  <Activity size={12} />
                </div>
                <span className="text-[9px] font-black text-text3 uppercase tracking-[0.2em]">Commandes</span>
              </div>
              <div className="text-xl font-mono font-extrabold text-text leading-none">
                {stats.count} <span className="text-[10px] opacity-60 uppercase font-bold tracking-tighter">Sess.</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass border-white/5 p-5 rounded-3xl shadow-sm relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />
            <div className="flex flex-col gap-3 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-surface2 flex items-center justify-center text-text2">
                  <ClockIcon size={12} />
                </div>
                <span className="text-[9px] font-black text-text3 uppercase tracking-[0.2em]">Moyenne</span>
              </div>
              <div className="text-xl font-mono font-extrabold text-text leading-none">
                {stats.avgDuration} <span className="text-[10px] opacity-60 uppercase font-bold tracking-tighter">Min.</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass border-white/5 p-5 rounded-3xl shadow-sm relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />
            <div className="flex flex-col gap-3 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-surface2 flex items-center justify-center text-text2">
                  <TrendingUp size={12} />
                </div>
                <span className="text-[9px] font-black text-text3 uppercase tracking-[0.2em]">Top Article</span>
              </div>
              <div className="text-xs font-bold text-text truncate leading-tight mt-1">
                {bestSellingItem ? `${bestSellingItem.name} (${bestSellingItem.qty})` : '-'}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Chart Section */}
        <section className="space-y-4" id="report-chart-container">
          <h3 className="text-[11px] font-black text-text3 uppercase tracking-[0.2em]">Évolution des Revenus</h3>
          <div className="glass border-white/5 rounded-3xl p-4 h-[240px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#263548" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#475569" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#475569" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => `${val}`}
                  />
                  <Tooltip 
                    cursor={{ stroke: 'rgba(255,255,255,0.05)', strokeWidth: 2 }}
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#1f2d45', borderRadius: '12px' }}
                    itemStyle={{ color: '#f97316', fontWeight: 'bold' }}
                    labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#f97316" 
                    strokeWidth={3} 
                    dot={{ fill: '#080b12', stroke: '#f97316', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#ea6b0a', stroke: '#ffffff' }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text3 text-sm">
                Aucune donnée disponible
              </div>
            )}
          </div>
        </section>

        {/* Category Breakdown */}
        <section className="space-y-4">
          <h3 className="text-[11px] font-black text-text3 uppercase tracking-[0.2em]">{t('reports.category_breakdown') || 'Par Catégorie'}</h3>
          <div className="glass border-white/5 rounded-3xl p-6 space-y-6">
            {[
              { id: 'boisson', icon: Coffee, label: t('cat.boisson') || 'Boissons', color: '#0ea5e9' },
              { id: 'nourriture', icon: Utensils, label: t('cat.nourriture') || 'Nourriture', color: '#f59e0b' },
              { id: 'autre', icon: Package, label: t('cat.autre') || 'Autres', color: '#8b5cf6' },
            ].map(cat => {
              const amount = categoryRevenue[cat.id] || 0
              const totalExtras = Object.values(categoryRevenue).reduce((sum, value) => sum + value, 0)
              const percentage = totalExtras > 0 ? (amount / totalExtras) * 100 : 0
              return (
                <div key={cat.id} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cat.color}15` }}>
                        <cat.icon size={16} style={{ color: cat.color }} />
                      </div>
                      <span className="text-xs font-bold text-text2 uppercase tracking-wide">{cat.label}</span>
                    </div>
                    <div className="text-sm font-mono font-extrabold text-text">
                      {amount.toFixed(2)} <span className="text-[10px] opacity-60">DH</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: cat.color, boxShadow: `0 0 8px ${cat.color}80` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Payment Breakdown */}
        <section className="space-y-4">
          <h3 className="text-[11px] font-black text-text3 uppercase tracking-[0.2em]">{t('reports.payment_breakdown')}</h3>
          <div className="glass border-white/5 rounded-3xl p-6 space-y-6">
            {[
              { id: 'cash', icon: Banknote, label: t('sessions.cash'), color: '#f97316' },
              { id: 'card', icon: CreditCard, label: t('sessions.card'), color: '#3b82f6' },
              { id: 'account', icon: Wallet, label: t('sessions.account'), color: '#8b5cf6' },
              { id: 'free', icon: Gift, label: t('sessions.free'), color: '#ef4444' },
            ].map(method => {
              const amount = stats.payments[method.id] || 0
              const percentage = stats.revenue > 0 ? (amount / stats.revenue) * 100 : 0
              return (
                <div key={method.id} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${method.color}15` }}>
                        <method.icon size={16} style={{ color: method.color }} />
                      </div>
                      <span className="text-xs font-bold text-text2 uppercase tracking-wide">{method.label}</span>
                    </div>
                    <div className="text-sm font-mono font-extrabold text-text">
                      {amount.toFixed(2)} <span className="text-[10px] opacity-60">DH</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      className="h-full rounded-full shadow-[0_0_8px_rgba(249,115,22,0.5)]"
                      style={{ backgroundColor: method.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <button 
          onClick={generatePDF}
          className="w-full h-12 mt-6 rounded-xl bg-accent text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-accent/20"
        >
          <Download size={18} />
          {t('reports.download') || 'Télécharger le PDF'}
        </button>
      </main>

    </div>
  )
}
