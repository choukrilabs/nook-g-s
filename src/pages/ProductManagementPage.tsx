import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { 
  ChevronLeft, Plus, ShoppingBag, Trash2, 
  Loader2, Check, Search, Tag, DollarSign,
  Coffee, Pizza, MoreHorizontal, Power, Edit2
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useUIStore } from '../stores/uiStore'
import { useTranslation } from '../i18n'
import { useAudit } from '../hooks/useAudit'
import { Product } from '../types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

export default function ProductManagementPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { cafe } = useAuthStore()
  const addToast = useUIStore((state) => state.addToast)
  const { logAction } = useAudit()

  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)

  // New Product Form
  const [name, setName] = useState('')
  const [price, setPrice] = useState<number>(0)
  const [category, setCategory] = useState('boisson')
  const [active, setActive] = useState(true)

  const loadProducts = async () => {
    if (!cafe) return
    setIsLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('cafe_id', cafe.id)
      .order('sort_order', { ascending: true })
    if (data) setProducts(data)
    setIsLoading(false)
  }

  useEffect(() => {
    loadProducts()
  }, [cafe])

  const openAdd = () => {
    setName('')
    setPrice(0)
    setCategory('boisson')
    setActive(true)
    setEditingProduct(null)
    setShowAdd(true)
  }

  const openEdit = (product: Product) => {
    setName(product.name)
    setPrice(product.price)
    setCategory(product.category)
    setActive(product.active)
    setEditingProduct(product)
    setShowAdd(true)
  }

  const handleSaveProduct = async () => {
    if (!cafe || !name || price < 0) return
    setIsSaving(true)
    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('products' as any)
          .update({
            name,
            price,
            category,
            active
          })
          .eq('id', editingProduct.id)
        
        if (error) throw error
        
        await logAction('product_updated', {
          product_id: editingProduct.id,
          product_name: name,
          price,
          category
        })

        addToast(t('settings.product_updated') || "Produit modifié", "success")
      } else {
        const { error } = await supabase
          .from('products' as any)
          .insert({
            cafe_id: cafe.id,
            name,
            price,
            category,
            active,
            sort_order: products.length
          })
        
        if (error) throw error
        
        await logAction('product_added', {
          product_name: name,
          price,
          category
        })

        addToast(t('settings.product_added'), "success")
      }

      setShowAdd(false)
      loadProducts()
    } catch (error: any) {
      addToast(error.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleProductActive = async (product: Product) => {
    try {
      const { error } = await supabase
        .from('products' as any)
        .update({ active: !product.active })
        .eq('id', product.id)
      
      if (error) throw error
      
      await logAction('product_updated', {
        product_id: product.id,
        product_name: product.name,
        active: !product.active
      })

      loadProducts()
      addToast(product.active ? t('settings.product_deactivated') : t('settings.product_activated'), "success")
    } catch (error: any) {
      addToast(error.message, 'error')
    }
  }

  const handleDeleteProduct = async () => {
    if (!productToDelete) return
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productToDelete.id)
      
      if (error) throw error
      
      await logAction('product_deleted', {
        product_id: productToDelete.id,
        product_name: productToDelete.name
      })

      addToast(t('settings.product_deleted'), "success")
      setProductToDelete(null)
      loadProducts()
    } catch (error: any) {
      addToast(error.message, 'error')
    }
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const categories = [
    { id: 'all', label: t('common.all'), icon: ShoppingBag },
    { id: 'boisson', label: t('cat.boisson'), icon: Coffee },
    { id: 'nourriture', label: t('cat.nourriture'), icon: Pizza },
    { id: 'autre', label: t('cat.autre'), icon: MoreHorizontal },
  ]

  return (
    <div className="min-h-screen bg-bg pb-12">
      <header className="fixed top-0 left-0 right-0 h-14 bg-bg/90 backdrop-blur-xl border-b border-border z-[100] flex items-center justify-between px-4">
        <button onClick={() => navigate(-1)} className="p-2 -ms-2 text-text3 hover:text-text">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-sm font-bold text-text">{t('settings.product_catalog')}</h1>
        <button onClick={openAdd} className="p-2 -me-2 text-accent hover:text-accent2">
          <Plus size={20} />
        </button>
      </header>

      <main className="pt-20 px-4 space-y-6">
        <div className="space-y-4">
          <Input
            placeholder={t('settings.search_product')}
            icon={<Search size={18} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold border flex items-center gap-2 transition-all ${
                  categoryFilter === cat.id 
                    ? 'bg-accent text-white border-accent' 
                    : 'bg-surface2 text-text3 border-border'
                }`}
              >
                <cat.icon size={14} />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          {filteredProducts.map((product) => (
            <div key={product.id} className={`bg-surface border border-border rounded-2xl p-4 flex items-center justify-between transition-opacity ${!product.active ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  product.category === 'boisson' ? 'bg-info/10 text-info' : 
                  product.category === 'nourriture' ? 'bg-warning/10 text-warning' : 'bg-surface2 text-text3'
                }`}>
                  {product.category === 'boisson' ? <Coffee size={20} /> : 
                   product.category === 'nourriture' ? <Pizza size={20} /> : <ShoppingBag size={20} />}
                </div>
                <div>
                  <div className="text-sm font-bold text-text">{product.name}</div>
                  <div className="text-xs font-mono font-bold text-accent2">{product.price.toFixed(2)} DH</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => openEdit(product)}
                  className={`p-2 rounded-lg transition-colors text-text3 hover:bg-surface2`}
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => toggleProductActive(product)}
                  className={`p-2 rounded-lg transition-colors ${product.active ? 'text-success hover:bg-success/10' : 'text-text3 hover:bg-surface2'}`}
                  title={product.active ? "Désactiver" : "Activer"}
                >
                  <Power size={18} />
                </button>
                <button 
                  onClick={() => setProductToDelete(product)}
                  className="p-2 text-text3 hover:text-error transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}

          {filteredProducts.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-text3">
              <ShoppingBag size={40} className="mb-4 opacity-20" />
              <p className="text-sm font-medium">{t('settings.no_products')}</p>
            </div>
          )}
        </div>
      </main>

      <BottomSheet isOpen={showAdd} onClose={() => setShowAdd(false)} title={editingProduct ? "Modifier produit" : t('settings.add_product')}>
        <div className="space-y-6 pt-4">
          <Input
            label={t('settings.product_name')}
            placeholder="ex: Café Noir, Sandwich..."
            icon={<Tag size={18} />}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            label={t('settings.price')}
            type="number"
            placeholder="0.00"
            icon={<DollarSign size={18} />}
            value={price || ''}
            onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
          />

          <div className="space-y-2">
            <label className="text-xs font-bold text-text3 uppercase tracking-widest">{t('settings.category')}</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'boisson', label: t('cat.boisson'), icon: Coffee },
                { id: 'nourriture', label: t('cat.nourriture'), icon: Pizza },
                { id: 'autre', label: t('cat.autre'), icon: MoreHorizontal },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                    category === cat.id ? 'bg-accent-glow border-accent text-accent2' : 'bg-surface2 border-border text-text3'
                  }`}
                >
                  <cat.icon size={18} />
                  <span className="text-[10px] font-bold">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface2 border border-border rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${active ? 'bg-success/10 text-success' : 'bg-text3/10 text-text3'}`}>
                <Power size={16} />
              </div>
              <div className="text-sm font-bold text-text">{t('settings.active_product')}</div>
            </div>
            <button 
              onClick={() => setActive(!active)}
              className={`w-12 h-6 rounded-full relative transition-colors ${active ? 'bg-success' : 'bg-border'}`}
            >
              <motion.div 
                animate={{ x: active ? 26 : 2 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
              />
            </button>
          </div>

          <Button 
            className="w-full h-14" 
            onClick={handleSaveProduct}
            isLoading={isSaving}
            disabled={!name || price < 0}
          >
            {editingProduct ? "Enregistrer" : t('settings.add_to_catalog')}
          </Button>
        </div>
      </BottomSheet>

      <ConfirmDialog
        isOpen={productToDelete !== null}
        onClose={() => setProductToDelete(null)}
        onConfirm={handleDeleteProduct}
        title={t('settings.delete_product')}
        message={`${t('settings.delete_product_confirm')} ${productToDelete?.name} ?`}
        variant="danger"
      />
    </div>
  )
}
