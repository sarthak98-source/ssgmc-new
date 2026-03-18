const bcrypt = require('bcryptjs')
const jwt    = require('jsonwebtoken')
const { validationResult } = require('express-validator')
const { getPool } = require('../config/db')

const JWT_SECRET  = process.env.JWT_SECRET  || 'vivmart_secret'
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d'

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  )

/* ─── Register ─────────────────────────────────────── */
exports.register = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, message: errors.array()[0].msg })

  const { name, email, password, role = 'buyer' } = req.body

  try {
    const pool = getPool()
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email])
    if (existing.length)
      return res.status(409).json({ success: false, message: 'Email already registered' })

    const hashedPw = await bcrypt.hash(password, 12)
    const safeRole = role === 'admin' ? 'buyer' : role

    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPw, safeRole]
    )

    const user  = { id: result.insertId, name, email, role: safeRole }
    const token = signToken(user)
    return res.status(201).json({ success: true, user, token })
  } catch (err) {
    console.error('Register error:', err)
    return res.status(500).json({ success: false, message: 'Registration failed' })
  }
}

/* ─── Login ────────────────────────────────────────── */
exports.login = async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, message: errors.array()[0].msg })

  const { email, password } = req.body

  try {
    const pool   = getPool()
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email])
    if (!rows.length)
      return res.status(401).json({ success: false, message: 'Invalid email or password' })

    const dbUser = rows[0]
    const valid  = await bcrypt.compare(password, dbUser.password)
    if (!valid)
      return res.status(401).json({ success: false, message: 'Invalid email or password' })

    if (dbUser.status === 'suspended')
      return res.status(403).json({ success: false, message: 'Account suspended. Contact support.' })

    const user  = { id: dbUser.id, name: dbUser.name, email: dbUser.email, role: dbUser.role }
    const token = signToken(user)

    await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [dbUser.id])
    return res.json({ success: true, user, token })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({ success: false, message: 'Login failed' })
  }
}

/* ─── Get Profile ──────────────────────────────────── */
exports.getProfile = async (req, res) => {
  try {
    const pool   = getPool()
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, phone, avatar_url, created_at, last_login FROM users WHERE id = ?',
      [req.user.id]
    )
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'User not found' })
    return res.json({ success: true, user: rows[0] })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch profile' })
  }
}

/* ─── Update Profile ───────────────────────────────── */
exports.updateProfile = async (req, res) => {
  const { name, phone } = req.body
  try {
    const pool = getPool()
    await pool.execute(
      'UPDATE users SET name = ?, phone = ?, updated_at = NOW() WHERE id = ?',
      [name, phone, req.user.id]
    )
    return res.json({ success: true, message: 'Profile updated' })
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update profile' })
  }
}
