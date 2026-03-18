import React, { createContext, useContext, useState, useEffect } from 'react'

const CartContext = createContext(null)

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vm_cart') || '[]') } catch { return [] }
  })

  useEffect(() => { localStorage.setItem('vm_cart', JSON.stringify(items)) }, [items])

  const addItem = (product, qty = 1, variant = {}) => {
    setItems(prev => {
      const key = product.id + JSON.stringify(variant)
      const existing = prev.find(i => i._key === key)
      if (existing) return prev.map(i => i._key === key ? { ...i, qty: i.qty + qty } : i)
      return [...prev, { ...product, qty, variant, _key: key }]
    })
  }
  const removeItem = id => setItems(prev => prev.filter(i => i.id !== id))
  const updateQty  = (id, qty) => qty <= 0 ? removeItem(id) : setItems(prev => prev.map(i => i.id === id ? { ...i, qty } : i))
  const clearCart  = () => setItems([])
  const total = items.reduce((s, i) => s + i.price * i.qty, 0)
  const count = items.reduce((s, i) => s + i.qty, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be within CartProvider')
  return ctx
}
