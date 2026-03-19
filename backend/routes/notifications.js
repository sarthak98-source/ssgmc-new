const express = require('express')
const { authenticate } = require('../middleware/auth')
const { getPool } = require('../config/db')
const router = express.Router()

/* ── GET /api/notifications ─────────────────────────── */
router.get('/', authenticate, async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.execute(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    )
    const unread = rows.filter(r => !r.is_read).length
    return res.json({ success: true, notifications: rows, unread })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications' })
  }
})

router.put('/read-all', authenticate, async (req, res) => {
  try {
    const pool = getPool()
    await pool.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id])
    return res.json({ success: true })
  } catch (err) { return res.status(500).json({ success: false }) }
})

router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const pool = getPool()
    await pool.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])
    return res.json({ success: true })
  } catch (err) { return res.status(500).json({ success: false }) }
})

router.delete('/clear', authenticate, async (req, res) => {
  try {
    const pool = getPool()
    await pool.execute('DELETE FROM notifications WHERE user_id = ? AND is_read = 1', [req.user.id])
    return res.json({ success: true })
  } catch (err) { return res.status(500).json({ success: false }) }
})

module.exports = router