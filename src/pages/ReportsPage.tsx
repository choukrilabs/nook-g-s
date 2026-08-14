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

  const categoryRevenue = sessions.reduce((acc: Record<string, number>, s) => {
    if (Array.isArray(s.extras)) {
      s.extras.forEach((extra: any) => {
        const product = products.find(p => p.id === extra.id)
        const category = product?.category || 'autre'
        acc[category] = (acc[category] || 0) + (extra.price * extra.qty)
      })
    }
    return acc
  }, { boisson: 0, nourriture: 0, autre: 0 })

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
    
    // Config
    const primaryColor: [number, number, number] = [249, 115, 22]; // #f97316
    const darkColor: [number, number, number] = [40, 40, 40];
    
    // Header
    doc.setFontSize(22)
    doc.text(cafe.name, 14, 20)
    doc.setFontSize(12)
    const periodLabel = period === 'today' ? t('common.today') : period === 'week' ? t('common.thisWeek') : t('common.thisMonth')
    doc.text(`Rapport d'activité - Période : ${periodLabel}`, 14, 30)
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm')}`, 14, 36)
    doc.setTextColor(0)

    // Summary Statistics
    doc.setFontSize(14)
    doc.text('1. Résumé Global', 14, 50)
    
    autoTable(doc, {
      startY: 55,
      head: [['Total Sessions', 'Revenu Total', 'Durée Moyenne (min)']],
      body: [
        [
          stats.count.toString(), 
          `${stats.revenue.toFixed(2)} DH`, 
          stats.avgDuration.toString()
        ]
      ],
      theme: 'grid',
      headStyles: { fillColor: primaryColor }
    })

    let finalY = (doc as any).lastAutoTable.finalY + 15

    // Breakdown tables
    doc.setFontSize(14)
    doc.text('2. Répartition par Catégorie', 14, finalY)

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Boissons', 'Nourriture', 'Autres']],
      body: [
        [
          `${(categoryRevenue['boisson'] || 0).toFixed(2)} DH`,
          `${(categoryRevenue['nourriture'] || 0).toFixed(2)} DH`,
          `${(categoryRevenue['autre'] || 0).toFixed(2)} DH`
        ]
      ],
      theme: 'grid',
      headStyles: { fillColor: darkColor }
    })
    
    finalY = (doc as any).lastAutoTable.finalY + 15
    doc.setFontSize(14)
    doc.text('3. Répartition par Mode de Paiement', 14, finalY)

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Espèces', 'Carte', 'Compte', 'Gratuit']],
      body: [
        [
          `${(stats.payments.cash || 0).toFixed(2)} DH`,
          `${(stats.payments.card || 0).toFixed(2)} DH`,
          `${(stats.payments.account || 0).toFixed(2)} DH`,
          `${(stats.payments.free || 0).toFixed(2)} DH`
        ]
      ],
      theme: 'grid',
      headStyles: { fillColor: darkColor }
    })

    finalY = (doc as any).lastAutoTable.finalY + 20

    // Visual Chart (drawn natively)
    if (finalY > doc.internal.pageSize.height - 80) {
      doc.addPage()
      finalY = 20
    }
    
    doc.setFontSize(14)
    doc.text('4. Évolution des Revenus', 14, finalY)
    
    if (chartData && chartData.length > 0) {
      const chartHeight = 50;
      const chartWidth = 180;
      const marginX = 14;
      
      const maxRev = Math.max(...chartData.map((d: any) => d.revenue), 10);
      const barWidth = Math.min((chartWidth - 20) / chartData.length, 12);
      const gap = ((chartWidth - 20) - (barWidth * chartData.length)) / (chartData.length + 1);
      
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(marginX, finalY + 5, marginX, finalY + 5 + chartHeight); // Y
      doc.line(marginX, finalY + 5 + chartHeight, marginX + chartWidth, finalY + 5 + chartHeight); // X
      
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`${maxRev.toFixed(0)}`, marginX - 2, finalY + 8, { align: 'right' });
      doc.text(`${(maxRev/2).toFixed(0)}`, marginX - 2, finalY + 5 + (chartHeight/2), { align: 'right' });
      doc.text('0', marginX - 2, finalY + 5 + chartHeight, { align: 'right' });

      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      
      chartData.forEach((d: any, i: number) => {
        const x = marginX + gap + (i * (barWidth + gap));
        const barH = (d.revenue / maxRev) * chartHeight;
        const y = finalY + 5 + chartHeight - barH;
        
        if (barH > 0) {
          doc.rect(x, y, barWidth, barH, 'F');
        }
        
        doc.setFontSize(7);
        doc.setTextColor(100);
        const label = chartData.length > 15 ? d.date.split('/')[0] : d.date; 
        doc.text(label, x + (barWidth/2), finalY + 5 + chartHeight + 4, { align: 'center' });
      });
      
      finalY += chartHeight + 20;
    } else {
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text('Aucune donnée disponible pour le graphique.', 14, finalY + 10);
      finalY += 20;
    }

    doc.setTextColor(0);

    // Session Details
    if (finalY > doc.internal.pageSize.height - 40) {
      doc.addPage()
      finalY = 20
    }
    
    doc.setFontSize(14)
    doc.text('5. Détails des Sessions', 14, finalY)

    const sessionData = sessions.map(s => [
      format(new Date(s.ended_at!), 'dd/MM/yyyy HH:mm'),
      s.customer_name || '-',
      s.seat_number?.toString() || '-',
      s.duration_minutes?.toString() || '0',
      `${s.total_amount.toFixed(2)} DH`,
      s.payment_method === 'cash' ? 'Espèces' : s.payment_method === 'card' ? 'Carte' : s.payment_method === 'account' ? 'Compte' : s.payment_method === 'free' ? 'Gratuit' : '-'
    ])

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Date', 'Client', 'Place', 'Durée (min)', 'Montant', 'Mode de Paiement']],
      body: sessionData,
      theme: 'striped',
      headStyles: { fillColor: darkColor }
    })

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(9)
        doc.setTextColor(150)
        doc.text(
            `Page ${i} sur ${pageCount} - Généré par Nook OS`,
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

        <button 
          onClick={generatePDF}
          className="w-full h-12 mt-6 rounded-xl bg-accent text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-accent/20"
        >
          <Download size={18} />
          Download Report
        </button>
      </main>

    </div>
  )
}
