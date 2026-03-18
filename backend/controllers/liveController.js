const { getPool } = require('../config/db')

/* ─── GET /api/live/sessions ──────────────────────── */
exports.getSessions = async (req, res) => {
  try {
    const pool   = getPool()
    // Deduplicate: only the LATEST active session per seller
    const [rows] = await pool.execute(
      `SELECT ls.*, u.name AS seller_name
       FROM live_sessions ls
       INNER JOIN (
         SELECT seller_id, MAX(id) AS max_id
         FROM live_sessions
         WHERE status = 'active'
         GROUP BY seller_id
       ) latest ON ls.id = latest.max_id
       LEFT JOIN users u ON ls.seller_id = u.id
       ORDER BY ls.viewers DESC, ls.started_at DESC`
    )
    return res.json({ success: true, sessions: rows })
  } catch (err) {
    return res.json({ success: true, sessions: [] })
  }
}

/* ─── POST /api/live/start  (seller) ─────────────── */
exports.startSession = async (req, res) => {
  const { title, productIds } = req.body
  try {
    const pool = getPool()

    // End any existing active sessions for this seller first
    await pool.execute(
      "UPDATE live_sessions SET status = 'ended', ended_at = NOW() WHERE seller_id = ? AND status = 'active'",
      [req.user.id]
    )

    const channel = `vivmart_${req.user.id}_${Date.now()}`
    const [result] = await pool.execute(
      "INSERT INTO live_sessions (seller_id, title, channel, product_ids, status, viewers) VALUES (?, ?, ?, ?, 'active', 0)",
      [req.user.id, title || 'Live Shopping', channel, JSON.stringify(productIds || [])]
    )

    return res.json({
      success:    true,
      sessionId:  result.insertId,
      channel,
      agoraAppId: process.env.AGORA_APP_ID || '',
      token:      null,
    })
  } catch (err) {
    console.error('Start live error:', err)
    return res.status(500).json({ success: false, message: 'Failed to start session' })
  }
}

/* ─── POST /api/live/end/:sessionId  (seller) ──────── */
exports.endSession = async (req, res) => {
  try {
    const pool = getPool()
    await pool.execute(
      "UPDATE live_sessions SET status = 'ended', ended_at = NOW() WHERE id = ? AND seller_id = ?",
      [req.params.sessionId, req.user.id]
    )
    return res.json({ success: true, message: 'Session ended' })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to end session' })
  }
}

/* ─── PUT /api/live/:sessionId/viewers ─────────────── */
exports.updateViewers = async (req, res) => {
  const { action } = req.body
  try {
    const pool  = getPool()
    const delta = action === 'join' ? 1 : -1
    await pool.execute(
      'UPDATE live_sessions SET viewers = GREATEST(0, viewers + ?) WHERE id = ?',
      [delta, req.params.sessionId]
    )
    return res.json({ success: true })
  } catch (err) {
    return res.json({ success: true })
  }
}