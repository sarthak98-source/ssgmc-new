const { getPool } = require('../config/db')
const { notify }  = require('../utils/notify')

function safeParseJSON(val, fallback) {
  if (!val) return fallback
  if (typeof val === 'object') return val
  try { return JSON.parse(val) } catch { return fallback }
}

async function enrichItemImages(pool, orders) {
  const productIds = new Set()
  orders.forEach(order => {
    safeParseJSON(order.items, []).forEach(item => { if (item.id) productIds.add(Number(item.id)) })
  })
  if (!productIds.size) return orders
  const ids = [...productIds]
  const placeholders = ids.map(() => '?').join(',')
  const [products] = await pool.execute(`SELECT id, image_url FROM products WHERE id IN (${placeholders})`, ids).catch(() => [[]])
  const imageMap = {}
  products.forEach(p => { imageMap[p.id] = p.image_url || '' })
  return orders.map(order => ({
    ...order,
    items: safeParseJSON(order.items, []).map(item => ({
      ...item,
      image: (!item.image || item.image.startsWith('data:')) ? (imageMap[Number(item.id)] || '') : item.image,
    })),
    address: safeParseJSON(order.address, {}),
  }))
}

/* ─── POST /api/orders ─────────────────────────────── */
exports.createOrder = async (req, res) => {
  const { items, address, paymentMethod, subtotal, shipping, tax, total } = req.body
  if (!items?.length || !address || !total)
    return res.status(400).json({ success: false, message: 'Missing required order fields' })

  try {
    const pool = getPool()
    const safeItems = items.map(i => ({
      id:       Number(i.id) || 0,
      name:     String(i.name || ''),
      price:    Number(i.price) || 0,
      qty:      Number(i.qty) || 1,
      sellerId: Number(i.sellerId || i.seller_id) || 0,
      category: String(i.category || ''),
      color:    String(i.color || ''),
      size:     String(i.size || ''),
      image:    (i.image || '').startsWith('data:') ? '' : String(i.image || ''),
    }))

    const [result] = await pool.execute(
      `INSERT INTO orders (buyer_id, items, address, payment_method, subtotal, shipping, tax, total, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [req.user.id, JSON.stringify(safeItems), JSON.stringify(address),
       paymentMethod || 'upi', Number(subtotal)||0, Number(shipping)||0, Number(tax)||0, Number(total)]
    )

    for (const item of safeItems) {
      if (item.id) await pool.execute('UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id = ?', [item.qty, item.id]).catch(()=>{})
    }

    const orderId = result.insertId

    // Also store normalized order items (optional but recommended)
    // If the table doesn't exist yet in someone's local DB, we don't want
    // to fail the whole checkout.
    for (const item of safeItems) {
      const productId = Number(item.id)
      if (!productId) continue
      try {
        await pool.execute(
          'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
          [orderId, productId, Number(item.qty) || 1, Number(item.price) || 0]
        )
      } catch (e) {
        // ignore (keeps backward-compat if schema.sql wasn't applied)
      }
    }

    const productNames = safeItems.map(i => i.name).join(', ')

    // Notify buyer
    await notify(req.user.id, 'order_placed', 'Order Placed!',
      `Your order #${orderId} for ${productNames} has been placed successfully.`,
      { orderId })

    // Notify each seller
    const sellerIds = [...new Set(safeItems.map(i => i.sellerId).filter(Boolean))]
    for (const sid of sellerIds) {
      const sellerItems = safeItems.filter(i => i.sellerId === sid).map(i => i.name).join(', ')
      await notify(sid, 'new_order', 'New Order Received!',
        `Buyer placed order #${orderId} for: ${sellerItems}`,
        { orderId, buyerName: req.user.name })
    }

    return res.status(201).json({ success: true, orderId, message: 'Order placed successfully' })
  } catch (err) {
    console.error('Create order error:', err.message)
    return res.status(500).json({ success: false, message: 'Failed to place order: ' + err.message })
  }
}

/* ─── GET /api/orders ──────────────────────────────── */
exports.getOrders = async (req, res) => {
  try {
    const pool = getPool()
    if (req.user.role === 'buyer') {
      const [rows] = await pool.execute(
        `SELECT id, buyer_id, items, address, payment_method, subtotal, shipping, tax, total, status, created_at, updated_at
         FROM orders WHERE buyer_id = ? ORDER BY id DESC`, [req.user.id]
      )
      return res.json({ success: true, orders: await enrichItemImages(pool, rows) })
    }
    if (req.user.role === 'seller') {
      const sid = Number(req.user.id)
      const [all] = await pool.execute(
        `SELECT o.id, o.buyer_id, o.items, o.address, o.payment_method, o.subtotal, o.shipping, o.tax, o.total, o.status, o.created_at, o.updated_at, u.name AS buyer_name
         FROM orders o LEFT JOIN users u ON o.buyer_id = u.id`
      )
      const rows = all.filter(o => {
        try { return safeParseJSON(o.items, []).some(i => Number(i.sellerId) === sid || Number(i.seller_id) === sid) }
        catch { return false }
      }).sort((a,b) => b.id - a.id)
      return res.json({ success: true, orders: await enrichItemImages(pool, rows) })
    }
    const [rows] = await pool.execute(
      `SELECT o.id, o.buyer_id, o.items, o.address, o.payment_method, o.subtotal, o.shipping, o.tax, o.total, o.status, o.created_at, o.updated_at, u.name AS buyer_name
       FROM orders o LEFT JOIN users u ON o.buyer_id = u.id ORDER BY o.id DESC`
    )
    return res.json({ success: true, orders: await enrichItemImages(pool, rows) })
  } catch (err) {
    console.error('Orders fetch error:', err.message)
    return res.status(500).json({ success: false, message: 'Failed to fetch orders: ' + err.message })
  }
}

/* ─── GET /api/orders/:id ──────────────────────────── */
exports.getOrderById = async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.execute(
      `SELECT o.*, u.name AS buyer_name FROM orders o LEFT JOIN users u ON o.buyer_id = u.id WHERE o.id = ?`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ success: false, message: 'Order not found' })
    const order = rows[0]
    if (req.user.role === 'buyer' && order.buyer_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Access denied' })
    const [enriched] = await enrichItemImages(pool, [order])
    return res.json({ success: true, order: enriched })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch order' })
  }
}

/* ─── PUT /api/orders/:id/status ───────────────────── */
exports.updateOrderStatus = async (req, res) => {
  const { status } = req.body
  const valid = ['pending','confirmed','shipped','delivered','cancelled']
  if (!valid.includes(status))
    return res.status(400).json({ success: false, message: 'Invalid status' })
  try {
    const pool = getPool()
    // Get order details for notification
    const [rows] = await pool.execute('SELECT * FROM orders WHERE id = ?', [req.params.id])
    if (!rows.length) return res.status(404).json({ success: false, message: 'Order not found' })
    const order = rows[0]

    await pool.execute('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', [status, req.params.id])

    // Send notification to buyer
    const items = safeParseJSON(order.items, [])
    const productNames = items.slice(0,2).map(i => i.name).join(', ') + (items.length > 2 ? '...' : '')
    const statusMessages = {
      confirmed: { title: 'Order Confirmed!', msg: `Your order #${order.id} (${productNames}) has been confirmed by the seller.` },
      shipped:   { title: 'Order Shipped!',   msg: `Your order #${order.id} (${productNames}) is on its way!` },
      delivered: { title: 'Order Delivered!', msg: `Your order #${order.id} has been delivered. Enjoy!` },
      cancelled: { title: 'Order Cancelled',  msg: `Your order #${order.id} has been cancelled.` },
    }
    if (statusMessages[status]) {
      const { title, msg } = statusMessages[status]
      await notify(order.buyer_id, `order_${status}`, title, msg, { orderId: order.id })
    }

    return res.json({ success: true, message: `Order marked as ${status}` })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update status' })
  }
}