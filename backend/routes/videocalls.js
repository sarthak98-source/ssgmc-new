const express = require('express')
const { authenticate, authorize } = require('../middleware/auth')
const { getPool } = require('../config/db')
const { notify }  = require('../utils/notify')
const router = express.Router()

router.post('/request', authenticate, authorize('buyer'), async (req, res) => {
  const { sellerId, productId, productName, message } = req.body
  if (!sellerId) return res.status(400).json({ success: false, message: 'Seller ID required' })
  try {
    const pool = getPool()
    const roomId = `call_${req.user.id}_${sellerId}_${Date.now()}`
    const [result] = await pool.execute(
      `INSERT INTO video_call_requests (buyer_id, seller_id, product_id, buyer_name, product_name, message, status, room_id)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [req.user.id, sellerId, productId||null, req.user.name, productName||'', message||'', roomId]
    )
    // Notify seller
    await notify(sellerId, 'call_request', 'Incoming Video Call Request',
      `${req.user.name} wants to video call you about "${productName || 'a product'}"`,
      { requestId: result.insertId, buyerName: req.user.name, productName }
    )
    return res.json({ success: true, requestId: result.insertId, roomId })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to send request' })
  }
})

router.get('/requests', authenticate, authorize('seller'), async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.execute(
      `SELECT r.*, u.name AS buyer_name, p.name AS product_name, p.image_url AS product_image
       FROM video_call_requests r
       LEFT JOIN users u ON r.buyer_id = u.id
       LEFT JOIN products p ON r.product_id = p.id
       WHERE r.seller_id = ? AND r.status = 'pending'
       ORDER BY r.created_at DESC`,
      [req.user.id]
    )
    return res.json({ success: true, requests: rows })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch requests' })
  }
})

router.put('/:id/accept', authenticate, authorize('seller'), async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.execute('SELECT * FROM video_call_requests WHERE id = ? AND seller_id = ?', [req.params.id, req.user.id])
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' })
    await pool.execute("UPDATE video_call_requests SET status = 'accepted' WHERE id = ?", [req.params.id])
    // Notify buyer
    await notify(rows[0].buyer_id, 'call_accepted', 'Call Request Accepted!',
      `${req.user.name} accepted your video call request. Starting call now...`,
      { requestId: req.params.id, roomId: rows[0].room_id }
    )
    return res.json({ success: true, roomId: rows[0].room_id })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to accept' })
  }
})

router.put('/:id/reject', authenticate, authorize('seller'), async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.execute('SELECT * FROM video_call_requests WHERE id = ?', [req.params.id])
    await pool.execute("UPDATE video_call_requests SET status = 'rejected' WHERE id = ?", [req.params.id])
    if (rows.length) {
      await notify(rows[0].buyer_id, 'call_rejected', 'Call Request Declined',
        `The seller is currently unavailable. Please try again later.`,
        { requestId: req.params.id }
      )
    }
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to reject' })
  }
})

router.put('/:id/end', authenticate, async (req, res) => {
  try {
    const pool = getPool()
    await pool.execute("UPDATE video_call_requests SET status = 'ended' WHERE id = ?", [req.params.id])
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to end call' })
  }
})

router.get('/status/:requestId', authenticate, async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.execute('SELECT * FROM video_call_requests WHERE id = ?', [req.params.requestId])
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' })
    return res.json({ success: true, request: rows[0] })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed' })
  }
})

module.exports = router