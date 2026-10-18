const mysql = require('mysql2/promise');
require('dotenv').config();

// SSL configuration for Cloud MySQL (e.g., TiDB Cloud, Aiven, Railway, etc.)
const isRemoteHost = process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1';
const useSSL = process.env.DB_SSL === 'true' || (process.env.NODE_ENV === 'production' && isRemoteHost);
const sslOptions = useSSL ? {
  rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
} : undefined;

// Create connection pool with sensible defaults for serverless & local
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'portfolio_db',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '5', 10),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  ...(sslOptions ? { ssl: sslOptions } : {}),
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
