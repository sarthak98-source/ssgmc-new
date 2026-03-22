const mysql = require('mysql2/promise')
require('dotenv').config()

let pool

const getPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host:               process.env.DB_HOST     || 'localhost',
      port:               parseInt(process.env.DB_PORT || '3306'),
      user:               process.env.DB_USER     || 'root',
      password:           process.env.DB_PASSWORD || '',
      database:           process.env.DB_NAME     || 'vivmart ssgmc db',
      waitForConnections: true,
      connectionLimit:    10,
      queueLimit:         0,
      timezone:           '+05:30',
    })
  }
  return pool
}

module.exports = { getPool }
