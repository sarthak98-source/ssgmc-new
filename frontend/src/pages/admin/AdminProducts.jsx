import React, { useEffect, useState } from 'react'
import { Search, Trash2, Eye, EyeOff } from 'lucide-react'
import api from '../../api'

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [updating, setUpdating] = useState(null)

  const fetchProducts = () => {
    const q = new URLSearchParams()
    if (category) q.set('category', category)
    if (search) q.set('search', search)
    q.set('limit', '100')
    api.get(`/products?${q}`).then(r => setProducts((r.data.products||[]))).finally(() => setLoading(false))
  }

  useEffect(fetchProducts, [category])
  useEffect(() => { const t = setTimeout(fetchProducts, 400); return () => clearTimeout(t) }, [search])

  const toggleActive = async (p) => {
    setUpdating(p.id)
    try { await api.put(`/products/${p.id}`, { ...p, price:p.price, active: !p.active }); fetchProducts() }
    catch { alert('Failed to update') }
    finally { setUpdating(null) }
  }

  const deleteProduct = async (id) => {
    if (!confirm('Remove this product from the platform?')) return
    setUpdating(id)
    try { await api.delete(`/products/${id}`); fetchProducts() }
    catch { alert('Failed to remove product') }
    finally { setUpdating(null) }
  }

  const CATS = ['','clothing','jewelry','glasses','hats','shoes','furniture','electronics','home-decor']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Products</h1>
        <p className="text-sm text-gray-500 mt-0.5">{products.length} active products</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="input pl-8 text-sm" placeholder="Search products..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="input w-auto text-sm" value={category} onChange={e=>setCategory(e.target.value)}>
          {CATS.map(c => <option key={c} value={c}>{c || 'All Categories'}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_,i) => <div key={i} className="card h-56 animate-pulse"/>)}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No products found</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map(p => (
            <div key={p.id} className="card overflow-hidden">
              <div className="aspect-square bg-gray-100 overflow-hidden relative">
                <img src={p.image_url || p.image} alt={p.name} className="w-full h-full object-cover"/>
                <div className="absolute top-2 right-2 flex gap-1">
                  <span className="badge-blue text-xs">{p.ar_mode}</span>
                  {!p.active && <span className="badge-red text-xs">Hidden</span>}
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                <p className="text-xs text-gray-400 capitalize mb-1">{p.category} · by {p.seller_name}</p>
                <p className="text-sm font-bold text-gray-900 mb-2">₹{parseFloat(p.price).toLocaleString('en-IN')}</p>
                <div className="flex gap-2">
                  <button onClick={() => toggleActive(p)} disabled={updating===p.id}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${p.active ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                    {p.active ? <><EyeOff size={12}/> Hide</> : <><Eye size={12}/> Show</>}
                  </button>
                  <button onClick={() => deleteProduct(p.id)} disabled={updating===p.id}
                    className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}