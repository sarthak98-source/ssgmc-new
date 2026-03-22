import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, Info } from 'lucide-react'
import ARTryOnAdvanced from '../../components/ar/ARTryOnAdvanced'
import api from '../../api'

const AR_INFO = {
  body:  { label:'Body Try-On',      desc:'Stand 1.5-2m from camera with good lighting',   color:'bg-orange-500' },
  face:  { label:'Face Try-On',      desc:'Look directly at camera, ensure good lighting',  color:'bg-purple-500' },
  room:  { label:'Room Placement',   desc:'Drag to orbit, scroll to zoom, see in your space', color:'bg-blue-500' },
  '3d':  { label:'3D Product View',  desc:'Drag to rotate, scroll to zoom around product',  color:'bg-green-500' },
  shoes: { label:'Shoe Try-On',      desc:'Body Try-On mode for shoes',                     color:'bg-red-500' },
}

export default function BuyerARTryOn() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [arActive, setArActive] = useState(false)
  const [products, setProducts] = useState([])

  const resolveBackendAssetUrl = (maybeUrl) => {
    if (!maybeUrl) return ''
    const s = String(maybeUrl)
    if (/^(https?:)?\/\//i.test(s) || /^data:/i.test(s) || /^blob:/i.test(s)) return s

    const apiBase = String(api?.defaults?.baseURL || '').replace(/\/+$/, '')
    const backendOrigin = apiBase.replace(/\/api$/i, '')
    if (!backendOrigin) return s

    if (s.startsWith('/')) return `${backendOrigin}${s}`
    return `${backendOrigin}/${s}`
  }

  useEffect(() => {
    setLoading(true)
    api.get(`/products/${id}`)
      .then(r => {
        const p = r.data.product
        setProduct(p)
        return api.get(`/products?category=${p.category}&limit=8`)
      })
      .then(r => setProducts((r.data.products || []).filter(p => p.id !== parseInt(id))))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false))
  }, [id])

  const renderAR = () => {
    if (!product) return null

    const initialMode =
      product.ar_mode === 'face'
        ? 'glasses'
        : product.ar_mode === 'body' || product.ar_mode === 'shoes'
          ? 'clothes'
          : 'clothes'

    const overlaySrc = resolveBackendAssetUrl(product.ar_overlay)

    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <button onClick={() => setArActive(false)} className="btn-outline text-sm">
            Close
          </button>
        </div>
        <ARTryOnAdvanced initialMode={initialMode} {...(overlaySrc ? { tshirtSrc: overlaySrc } : {})} />
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  if (!product) return (
    <div className="text-center py-20">
      <p className="text-4xl mb-3">😕</p>
      <p className="font-semibold text-gray-700">Product not found</p>
      <Link to="/buyer/products" className="btn-primary mt-4 text-sm">Back to Products</Link>
    </div>
  )

  const arInfo = AR_INFO[product.ar_mode] || AR_INFO['3d']

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Link to={`/buyer/products/${product.id}`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-600">
        <ArrowLeft size={16}/> Back to Product
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
          <Sparkles size={20} className="text-brand-500"/>
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-gray-900">{arInfo.label}</h1>
          <p className="text-sm text-gray-500">{product.name}</p>
        </div>
        <span className={`ml-auto badge text-white ${arInfo.color}`}>{product.ar_mode?.toUpperCase() || 'AR'}</span>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
        <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5"/>
        <p className="text-sm text-blue-700">{arInfo.desc}</p>
      </div>

      {/* AR Component or launch button */}
      {arActive ? (
        <div className="card p-4">{renderAR()}</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="relative aspect-square bg-gray-100">
            <img src={product.image_url || product.image} alt={product.name} className="w-full h-full object-cover"/>
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <button onClick={() => setArActive(true)}
                className="bg-white text-brand-600 font-bold px-8 py-4 rounded-2xl text-lg shadow-2xl hover:scale-105 transition-transform flex items-center gap-3">
                <Sparkles size={24}/> Launch AR
              </button>
            </div>
          </div>
          <div className="p-4">
            <p className="font-semibold text-gray-800">{product.name}</p>
            <p className="text-brand-600 font-bold">₹{product.price?.toLocaleString('en-IN')}</p>
          </div>
        </div>
      )}

      {/* Switch product for AR */}
      {products.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-600 mb-3">Try other products in AR</p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {products.map(p => (
              <button key={p.id} onClick={() => navigate(`/buyer/ar/${p.id}`)}
                className="flex-shrink-0 w-20 card-hover overflow-hidden text-left">
                <div className="aspect-square bg-gray-100 overflow-hidden rounded-t-lg">
                  <img src={p.image_url || p.image} alt={p.name} className="w-full h-full object-cover hover:scale-105 transition-transform"/>
                </div>
                <div className="p-1.5">
                  <p className="text-xs font-semibold text-gray-700 truncate">{p.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}