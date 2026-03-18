import React from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, ShoppingBag } from 'lucide-react'
import { useCart } from '../../context/CartContext'

export default function BuyerCart() {
  const { items, removeItem, updateQty, total, clearCart } = useCart()
  const shipping = total > 999 ? 0 : 99
  const tax = Math.round(total * 0.18)
  const grand = total + shipping + tax

  if (items.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <ShoppingBag size={32} className="text-gray-400"/>
      </div>
      <h2 className="font-display text-xl font-bold text-gray-800 mb-2">Your cart is empty</h2>
      <p className="text-gray-500 text-sm mb-6">Add some amazing products to get started</p>
      <Link to="/buyer/products" className="btn-primary">Browse Products</Link>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">My Cart</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={clearCart} className="text-sm text-red-500 hover:text-red-600 font-semibold">Clear all</button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map(item => {
            const image = item.image_url || item.image
            const discount = item.original_price ? Math.round((1 - item.price / item.original_price) * 100) : null
            return (
              <div key={item._key || item.id} className="card p-4 flex gap-4">
                <Link to={`/buyer/products/${item.id}`}>
                  <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={image} alt={item.name} className="w-full h-full object-cover"/>
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-800 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400 capitalize mt-0.5">{item.category}</p>
                      {item.variant?.color && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="w-3 h-3 rounded-full border border-gray-200" style={{backgroundColor:item.variant.color}}/>
                          {item.variant.size && <span className="text-xs text-gray-500">{item.variant.size}</span>}
                        </div>
                      )}
                    </div>
                    <button onClick={() => removeItem(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                      <button onClick={() => updateQty(item.id, item.qty - 1)} className="px-2.5 py-1.5 hover:bg-gray-50 text-gray-500"><Minus size={12}/></button>
                      <span className="px-3 py-1.5 text-sm font-semibold">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, item.qty + 1)} className="px-2.5 py-1.5 hover:bg-gray-50 text-gray-500"><Plus size={12}/></button>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">₹{(item.price * item.qty).toLocaleString('en-IN')}</p>
                      {discount && <p className="text-xs text-green-600">{discount}% off</p>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="card p-5 h-fit sticky top-4 space-y-4">
          <h2 className="font-display text-lg font-bold text-gray-900">Order Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>₹{total.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Shipping</span>
              <span>{shipping === 0 ? <span className="text-green-600 font-semibold">FREE</span> : `₹${shipping}`}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax (18% GST)</span>
              <span>₹{tax.toLocaleString('en-IN')}</span>
            </div>
            {shipping === 0 && <p className="text-xs text-green-600 bg-green-50 p-2 rounded-lg">🎉 You saved ₹99 on shipping!</p>}
            <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900">
              <span>Total</span>
              <span>₹{grand.toLocaleString('en-IN')}</span>
            </div>
          </div>
          <Link to="/buyer/checkout" state={{ subtotal:total, shipping, tax, total:grand }} className="btn-primary w-full justify-center py-3 text-base">
            Proceed to Checkout <ArrowRight size={16}/>
          </Link>
          <Link to="/buyer/products" className="block text-center text-sm text-brand-600 hover:underline font-semibold">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  )
}