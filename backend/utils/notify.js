const { getPool } = require('../config/db')

const notify = async (userId, type, title, message, data = {}) => {
  try {
    const pool = getPool()
    await pool.execute(
      'INSERT INTO notifications (user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)',
      [userId, type, title, message || '', JSON.stringify(data)]
    )
  } catch (e) {
    console.warn('notify() failed:', e.message)
  }
}

module.exports = { notify }