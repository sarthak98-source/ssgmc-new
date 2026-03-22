import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart, Star, Heart } from 'lucide-react'
import { useCart } from '../../context/CartContext'
import ARTryOnButton from '../ar/ARTryOnButton'

export default function ProductCard({ product, basePath = '/buyer' }) {
  const { addItem } = useCart()
  const [wished, setWished]     = useState(false)
  const [added, setAdded]       = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  const imgSrc        = product.image_url || product.image || ''
  const price         = Number(product.price) || 0
  const originalPrice = Number(product.original_price || product.originalPrice) || 0
  const discount      = originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : null
  const rating        = Number(product.rating) || 0
  const reviews       = Number(product.review_count ?? product.reviews) || 0

  const handleAdd = e => {
    e.preventDefault(); e.stopPropagation()
    addItem(product)
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  const handleWish = e => {
    e.preventDefault(); e.stopPropagation()
    setWished(v => !v)
  }

  return (
    <Link to={`${basePath}/products/${product.id}`} className="card-hover block">
      <div className="relative aspect-square overflow-hidden rounded-t-2xl bg-gray-100">
        {imgSrc && !imgFailed ? (
          <img src={imgSrc} alt={product.name} loading="lazy"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"/>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <span className="text-4xl opacity-30">🛍️</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300"/>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {discount > 0 && <span className="badge bg-brand-500 text-white">-{discount}%</span>}
          {product.badge && <span className="badge-orange">{product.badge}</span>}
        </div>

        {/* Wishlist button */}
        <button onClick={handleWish}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow hover:bg-white transition-all">
          <Heart size={13} className={wished ? 'fill-red-500 text-red-500' : 'text-gray-500'}/>
        </button>

        {/* AR Try-On button (auto-hides for unsupported categories) */}
        <ARTryOnButton product={product} variant="card" />
      </div>

      <div className="p-3">
        <p className="text-xs text-gray-400 capitalize mb-0.5">{product.category}</p>
        <p className="text-sm font-semibold text-gray-800 truncate mb-1">{product.name}</p>
        <div className="flex items-center gap-1 mb-2">
          <Star size={11} className="fill-amber-400 text-amber-400"/>
          <span className="text-xs text-gray-500">{rating} ({reviews})</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span className="font-bold text-gray-900 text-sm">₹{price.toLocaleString('en-IN')}</span>
            {originalPrice > price && (
              <span className="text-xs text-gray-400 line-through ml-1.5">
                ₹{originalPrice.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          <button onClick={handleAdd}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${added ? 'bg-green-500' : 'bg-brand-500 hover:bg-brand-600'}`}>
            <ShoppingCart size={12} className="text-white"/>
          </button>
        </div>
      </div>
    </Link>
  )
}