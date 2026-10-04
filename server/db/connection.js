const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool with sensible defaults
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'portfolio_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

/**
 * Execute parameterized query safely
 * Uses prepared statements to prevent SQL injection
 */
async function query(sql, params = []) {
  const [results] = await pool.execute(sql, params);
  return results;
}

module.exports = {
  pool,
  query,
};
