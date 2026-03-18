const jwt = require('jsonwebtoken')

/**
 * Verify JWT token and attach user to req.user
 */
const authenticate = (req, res, next) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' })
  }
  const token = auth.split(' ')[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vivmart_secret')
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' })
  }
}

/**
 * Restrict to specific roles
 * Usage: authorize('admin') or authorize('buyer', 'seller')
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' })
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: `Access denied. Required role: ${roles.join(' or ')}` })
  }
  next()
}

module.exports = { authenticate, authorize }
