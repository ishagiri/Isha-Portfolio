const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { pool } = require('./connection');
require('dotenv').config();

let dbReady = false;

async function initDatabase() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'portfolio_db';
  const isRemoteHost = host && host !== 'localhost' && host !== '127.0.0.1';

  try {
    // 1. In local dev only, ensure database exists (cloud databases like TiDB already have portfolio_db pre-created)
    if (!isRemoteHost) {
      try {
        const rootConn = await mysql.createConnection({
          host,
          port,
          user,
          password,
        });

        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await rootConn.end();
      } catch (rootErr) {
        // Non-fatal for local setup
      }
    }

    // 2. Ensure tables exist (safe and non-destructive: IF NOT EXISTS preserves all existing data)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at),
        INDEX idx_is_read (is_read)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Seed initial admin only if table is completely empty and ADMIN_PASSWORD is provided in .env
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM admins');
    const adminCount = rows && rows.length > 0 ? Number(rows[0].count) : 0;

    if (adminCount === 0 && process.env.ADMIN_PASSWORD) {
      const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
      const defaultEmail = process.env.ADMIN_EMAIL || 'admin@portfolio.com';
      const defaultPassword = process.env.ADMIN_PASSWORD;

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(defaultPassword, salt);

      await pool.execute(
        'INSERT INTO admins (username, email, password_hash) VALUES (?, ?, ?)',
        [defaultUsername, defaultEmail, hashedPassword]
      );

      console.log(`[Database] Initial admin created: "${defaultUsername}" (${defaultEmail})`);
    }

    dbReady = true;
    console.log(`[Database] Connected successfully to database "${database}".`);
    return true;
  } catch (error) {
    dbReady = false;
    console.warn('--------------------------------------------------');
    console.warn('[Database Notice] Could not connect to database.');
    console.warn(`Reason: ${error.message}`);
    console.warn('Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, and DB_SSL in environment variables.');
    console.warn('--------------------------------------------------');
    return false;
  }
}

function isDatabaseReady() {
  return dbReady;
}

let initPromise = null;

async function ensureDatabaseReady() {
  if (dbReady) return true;
  if (!initPromise) {
    initPromise = initDatabase().finally(() => {
      // allow retry on failure
      if (!dbReady) {
        setTimeout(() => { initPromise = null; }, 5000);
      }
    });
  }
  return initPromise;
}

module.exports = {
  initDatabase,
  ensureDatabaseReady,
  isDatabaseReady,
};
