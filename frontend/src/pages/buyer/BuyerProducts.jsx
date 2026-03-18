import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import ProductCard from '../../components/ui/ProductCard'
import api from '../../api'

const CATEGORIES = [
  { id:'', label:'All' },
  { id:'clothing', label:'Clothing' },
  { id:'jewelry', label:'Jewelry' },
  { id:'glasses', label:'Glasses' },
  { id:'hats', label:'Hats' },
  { id:'shoes', label:'Shoes' },
  { id:'furniture', label:'Furniture' },
  { id:'electronics', label:'Electronics' },
  { id:'home-decor', label:'Home Decor' },
]

const AR_MODES = [
  { id:'', label:'All AR' },
  { id:'body', label:'Body Try-On' },
  { id:'face', label:'Face Try-On' },
  { id:'room', label:'Room Placement' },
  { id:'3d', label:'3D Viewer' },
]

export default function BuyerProducts() {
  const [params, setParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(params.get('search') || '')
  const [category, setCategory] = useState(params.get('category') || '')
  const [arMode, setArMode] = useState(params.get('arMode') || '')
  const [page, setPage] = useState(0)
  const LIMIT = 12

  const fetchProducts = useCallback(async (pg = 0) => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (category) q.set('category', category)
      if (arMode) q.set('arMode', arMode)
      if (search) q.set('search', search)
      q.set('limit', LIMIT)
      q.set('offset', pg * LIMIT)
      const { data } = await api.get(`/products?${q}`)
      setProducts(data.products || [])
      setTotal(data.total || 0)
    } catch { setProducts([]) }
    finally { setLoading(false) }
  }, [category, arMode, search])

  useEffect(() => { fetchProducts(0); setPage(0) }, [category, arMode])
  useEffect(() => {
    const t = setTimeout(() => { fetchProducts(0); setPage(0) }, 400)
    return () => clearTimeout(t)
  }, [search])

  const clearFilters = () => { setCategory(''); setArMode(''); setSearch('') }
  const hasFilters = category || arMode || search

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} products available</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input className="input pl-9 pr-10" placeholder="Search products..."
          value={search} onChange={e => setSearch(e.target.value)}/>
        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14}/></button>}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCategory(c.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${category===c.id ? 'bg-brand-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* AR Mode filter */}
      <div className="flex gap-2 flex-wrap">
        <span className="flex items-center gap-1 text-xs text-gray-500 font-semibold"><SlidersHorizontal size={12}/> AR Filter:</span>
        {AR_MODES.map(m => (
          <button key={m.id} onClick={() => setArMode(m.id)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${arMode===m.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {m.label}
          </button>
        ))}
        {hasFilters && <button onClick={clearFilters} className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600 hover:bg-red-200 transition-all">Clear all</button>}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_,i) => (
            <div key={i} className="card animate-pulse">
              <div className="aspect-square bg-gray-200 rounded-t-2xl"/>
              <div className="p-3 space-y-2"><div className="h-3 bg-gray-200 rounded w-3/4"/><div className="h-3 bg-gray-200 rounded w-1/2"/></div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-semibold text-gray-700">No products found</p>
          <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
          {hasFilters && <button onClick={clearFilters} className="btn-primary mt-4 text-sm">Clear Filters</button>}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map(p => <ProductCard key={p.id} product={p}/>)}
        </div>
      )}

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button disabled={page === 0} onClick={() => { setPage(p => p-1); fetchProducts(page-1) }}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold disabled:opacity-40 hover:bg-gray-50">Previous</button>
          <span className="text-sm text-gray-500">{page+1} / {Math.ceil(total/LIMIT)}</span>
          <button disabled={(page+1)*LIMIT >= total} onClick={() => { setPage(p => p+1); fetchProducts(page+1) }}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold disabled:opacity-40 hover:bg-gray-50">Next</button>
        </div>
      )}
    </div>
  )
}