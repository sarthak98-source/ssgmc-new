const { getPool } = require('../config/db')

/* ── Helper: parse JSON safely ───────────────────── */
function safeParseJSON(val, fallback) {
  if (!val) return fallback
  if (typeof val === 'object') return val
  try { return JSON.parse(val) } catch { return fallback }
}

/* ── Helper: enrich order items with product images ─
   Fetches current image_url from products table for all items
   so images always show even if stripped from orders.items  */
async function enrichItemImages(pool, orders) {
  // Collect all unique product IDs from all orders
  const productIds = new Set()
  orders.forEach(order => {
    safeParseJSON(order.items, []).forEach(item => {
      if (item.id) productIds.add(Number(item.id))
    })
  })

  if (productIds.size === 0) return orders

  // Fetch image_url for all products in one query
  const ids = [...productIds]
  const placeholders = ids.map(() => '?').join(',')
  const [products] = await pool.execute(
    `SELECT id, image_url FROM products WHERE id IN (${placeholders})`,
    ids
  ).catch(() => [[]])

  // Build id → image_url map
  const imageMap = {}
  products.forEach(p => { imageMap[p.id] = p.image_url || '' })

  // Inject image into each order item
  return orders.map(order => ({
    ...order,
    items: safeParseJSON(order.items, []).map(item => ({
      ...item,
      // Use current product image if item image is empty or base64
      image: (!item.image || item.image.startsWith('data:'))
        ? (imageMap[Number(item.id)] || '')
        : item.image,
    })),
    address: safeParseJSON(order.address, {}),
  }))
}

/* ─── POST /api/orders ───────────────────────────── */
exports.createOrder = async (req, res) => {
  const { items, address, paymentMethod, subtotal, shipping, tax, total } = req.body
  if (!items?.length || !address || !total)
    return res.status(400).json({ success: false, message: 'Missing required order fields' })

  try {
    const pool = getPool()

    // Clean items: strip base64, store sellerId as number
    const safeItems = items.map(i => ({
      id:       Number(i.id)       || 0,
      name:     String(i.name     || ''),
      price:    Number(i.price)    || 0,
      qty:      Number(i.qty)      || 1,
      sellerId: Number(i.sellerId || i.seller_id) || 0,
      category: String(i.category || ''),
      color:    String(i.color    || ''),
      size:     String(i.size     || ''),
      // Store image only if it's a URL (not base64)
      image: (i.image || '').startsWith('data:') ? '' : String(i.image || ''),
    }))

    const [result] = await pool.execute(
      `INSERT INTO orders
         (buyer_id, items, address, payment_method, subtotal, shipping, tax, total, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        req.user.id,
        JSON.stringify(safeItems),
        JSON.stringify(address),
        paymentMethod || 'upi',
        Number(subtotal) || 0,
        Number(shipping) || 0,
        Number(tax)      || 0,
        Number(total),
      ]
    )

    for (const item of safeItems) {
      if (item.id) {
        await pool.execute(
          'UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id = ?',
          [item.qty, item.id]
        ).catch(() => {})
      }
    }

    return res.status(201).json({ success: true, orderId: result.insertId, message: 'Order placed successfully' })
  } catch (err) {
    console.error('Create order error:', err.message)
    return res.status(500).json({ success: false, message: 'Failed to place order: ' + err.message })
  }
}

/* ─── GET /api/orders ────────────────────────────── */
exports.getOrders = async (req, res) => {
  try {
    const pool = getPool()

    // ── Buyer ────────────────────────────────────────
    if (req.user.role === 'buyer') {
      const [rows] = await pool.execute(
        `SELECT id, buyer_id, items, address, payment_method,
                subtotal, shipping, tax, total, status,
                created_at, updated_at
         FROM orders
         WHERE buyer_id = ?
         ORDER BY id DESC`,
        [req.user.id]
      )
      const orders = await enrichItemImages(pool, rows)
      return res.json({ success: true, orders })
    }

    // ── Seller ───────────────────────────────────────
    if (req.user.role === 'seller') {
      const sellerId = Number(req.user.id)

      const [allRows] = await pool.execute(
        `SELECT o.id, o.buyer_id, o.items, o.address, o.payment_method,
                o.subtotal, o.shipping, o.tax, o.total, o.status,
                o.created_at, o.updated_at,
                u.name AS buyer_name
         FROM orders o
         LEFT JOIN users u ON o.buyer_id = u.id`
      )

      const sellerRows = allRows.filter(order => {
        try {
          const its = safeParseJSON(order.items, [])
          return its.some(item =>
            Number(item.sellerId)  === sellerId ||
            Number(item.seller_id) === sellerId
          )
        } catch { return false }
      }).sort((a, b) => b.id - a.id)

      const orders = await enrichItemImages(pool, sellerRows)
      return res.json({ success: true, orders })
    }

    // ── Admin ────────────────────────────────────────
    const [rows] = await pool.execute(
      `SELECT o.id, o.buyer_id, o.items, o.address, o.payment_method,
              o.subtotal, o.shipping, o.tax, o.total, o.status,
              o.created_at, o.updated_at,
              u.name AS buyer_name
       FROM orders o
       LEFT JOIN users u ON o.buyer_id = u.id
       ORDER BY o.id DESC`
    )
    const orders = await enrichItemImages(pool, rows)
    return res.json({ success: true, orders })

  } catch (err) {
    console.error('Orders fetch error:', err.message)
    return res.status(500).json({ success: false, message: 'Failed to fetch orders: ' + err.message })
  }
}

/* ─── GET /api/orders/:id ────────────────────────── */
exports.getOrderById = async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.execute(
      `SELECT o.*, u.name AS buyer_name
       FROM orders o
       LEFT JOIN users u ON o.buyer_id = u.id
       WHERE o.id = ?`,
      [req.params.id]
    )
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Order not found' })
    const order = rows[0]
    if (req.user.role === 'buyer' && order.buyer_id !== req.user.id)
      return res.status(403).json({ success: false, message: 'Access denied' })
    const [enriched] = await enrichItemImages(pool, [order])
    return res.json({ success: true, order: enriched })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch order' })
  }
}

/* ─── PUT /api/orders/:id/status ─────────────────── */
exports.updateOrderStatus = async (req, res) => {
  const { status } = req.body
  const valid = ['pending','confirmed','shipped','delivered','cancelled']
  if (!valid.includes(status))
    return res.status(400).json({ success: false, message: 'Invalid status' })
  try {
    const pool = getPool()
    await pool.execute(
      'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, req.params.id]
    )
    return res.json({ success: true, message: `Order marked as ${status}` })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update status' })
  }
}