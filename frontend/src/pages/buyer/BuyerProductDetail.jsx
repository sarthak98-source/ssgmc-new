import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ShoppingCart, Sparkles, Star, ArrowLeft, Package, Truck, Shield, Heart, Share2 } from 'lucide-react'
import { useCart } from '../../context/CartContext'
import api from '../../api'

export default function BuyerProductDetail() {
  const { id } = useParams()
  const { addItem } = useCart()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedColor, setSelectedColor] = useState(null)
  const [selectedSize, setSelectedSize] = useState(null)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [wished, setWished] = useState(false)
  const [relatedProducts, setRelatedProducts] = useState([])

  useEffect(() => {
    setLoading(true)
    api.get(`/products/${id}`)
      .then(r => {
        const p = r.data.product
        setProduct(p)
        setSelectedColor(p.colors?.[0] || null)
        setSelectedSize(p.sizes?.[0] || null)
        // Fetch related
        return api.get(`/products?category=${p.category}&limit=4`)
      })
      .then(r => setRelatedProducts((r.data.products || []).filter(p => p.id !== parseInt(id))))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false))
  }, [id])

  const handleAdd = () => {
    addItem(product, qty, { color: selectedColor, size: selectedSize })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const discount = product?.original_price ? Math.round((1 - product.price / product.original_price) * 100) : null

  if (loading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-32"/>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="aspect-square bg-gray-200 rounded-2xl"/>
        <div className="space-y-4"><div className="h-8 bg-gray-200 rounded w-3/4"/><div className="h-5 bg-gray-200 rounded w-1/2"/></div>
      </div>
    </div>
  )

  if (!product) return (
    <div className="text-center py-20">
      <p className="text-4xl mb-3">😕</p>
      <p className="font-semibold text-gray-700">Product not found</p>
      <Link to="/buyer/products" className="btn-primary mt-4 text-sm">Back to Products</Link>
    </div>
  )

  return (
    <div className="space-y-8">
      <Link to="/buyer/products" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-600 transition-colors">
        <ArrowLeft size={16}/> Back to Products
      </Link>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Image */}
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden aspect-square bg-gray-100">
            <img src={product.image_url || product.image} alt={product.name} className="w-full h-full object-cover"/>
            <div className="absolute top-3 left-3 flex flex-col gap-2">
              {discount && <span className="badge bg-brand-500 text-white">-{discount}%</span>}
              {product.badge && <span className="badge-orange">{product.badge}</span>}
            </div>
            <button onClick={() => setWished(v=>!v)} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-transform">
              <Heart size={16} className={wished ? 'fill-red-500 text-red-500' : 'text-gray-400'}/>
            </button>
          </div>

          {/* AR Try-On button */}
          <Link to={`/buyer/ar/${product.id}`}
            className="w-full btn-secondary justify-center py-3 text-base font-bold gap-2">
            <Sparkles size={18} className="text-brand-500"/>
            Try with AR
            <span className="badge-orange text-xs">{product.ar_mode?.toUpperCase()}</span>
          </Link>
        </div>

        {/* Details */}
        <div className="space-y-5">
          <div>
            <p className="text-sm text-gray-400 capitalize mb-1">{product.category} · by {product.seller_name}</p>
            <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_,i) => (
                  <Star key={i} size={14} className={i < Math.floor(product.rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}/>
                ))}
              </div>
              <span className="text-sm font-semibold text-gray-700">{product.rating}</span>
              <span className="text-sm text-gray-400">({product.review_count} reviews)</span>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="font-display text-3xl font-bold text-gray-900">₹{product.price?.toLocaleString('en-IN')}</span>
            {product.original_price && <span className="text-lg text-gray-400 line-through">₹{product.original_price?.toLocaleString('en-IN')}</span>}
            {discount && <span className="badge bg-green-100 text-green-700">{discount}% OFF</span>}
          </div>

          {/* Colors */}
          {product.colors?.length > 0 && (
            <div>
              <p className="label">Color</p>
              <div className="flex gap-2 flex-wrap">
                {product.colors.map(c => (
                  <button key={c} onClick={() => setSelectedColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColor===c ? 'border-brand-500 scale-110 shadow-md' : 'border-gray-200 hover:scale-105'}`}/>
                ))}
              </div>
            </div>
          )}

          {/* Sizes */}
          {product.sizes?.length > 0 && (
            <div>
              <p className="label">Size</p>
              <div className="flex gap-2 flex-wrap">
                {product.sizes.map(s => (
                  <button key={s} onClick={() => setSelectedSize(s)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${selectedSize===s ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Qty + Cart */}
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setQty(q => Math.max(1, q-1))} className="px-3 py-2.5 text-gray-500 hover:bg-gray-50 font-bold">−</button>
              <span className="px-4 py-2.5 text-sm font-semibold">{qty}</span>
              <button onClick={() => setQty(q => q+1)} className="px-3 py-2.5 text-gray-500 hover:bg-gray-50 font-bold">+</button>
            </div>
            <button onClick={handleAdd} className={`flex-1 btn-primary justify-center py-3 text-base transition-all ${added ? 'bg-green-500 hover:bg-green-500' : ''}`}>
              <ShoppingCart size={18}/>
              {added ? '✓ Added to Cart!' : 'Add to Cart'}
            </button>
          </div>

          {product.description && (
            <p className="text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4">{product.description}</p>
          )}

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { icon:Package,  label:'Free Delivery', sub:'Orders over ₹999' },
              { icon:Truck,    label:'Fast Shipping',  sub:'2-3 business days' },
              { icon:Shield,   label:'Secure Payment', sub:'100% protected' },
            ].map(b => (
              <div key={b.label} className="text-center p-3 bg-gray-50 rounded-xl">
                <b.icon size={16} className="mx-auto mb-1 text-brand-500"/>
                <p className="text-xs font-semibold text-gray-700">{b.label}</p>
                <p className="text-xs text-gray-400">{b.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Related products */}
      {relatedProducts.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-bold text-gray-900 mb-4">Related Products</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {relatedProducts.slice(0,4).map(p => {
              const np = p
              return (
                <Link key={np.id} to={`/buyer/products/${np.id}`}
                  className="card-hover overflow-hidden">
                  <div className="aspect-square bg-gray-100 overflow-hidden rounded-t-2xl">
                    <img src={np.image_url || np.image} alt={np.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"/>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-800 truncate">{np.name}</p>
                    <p className="text-sm font-bold text-brand-600">₹{Number(np.price).toLocaleString('en-IN')}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}