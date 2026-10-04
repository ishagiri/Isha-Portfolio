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

  try {
    // 1. Try to connect to MySQL server (without selecting DB first) to ensure database exists
    const rootConn = await mysql.createConnection({
      host,
      port,
      user,
      password,
    });

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await rootConn.end();

    // 2. Create tables using the pool
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

    // 3. Seed default admin if table is empty and credentials are provided in .env
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM admins');
    if (rows[0].count === 0 && process.env.ADMIN_PASSWORD) {
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
    console.log(`[Database] Connected successfully to MySQL database "${database}".`);
    return true;
  } catch (error) {
    dbReady = false;
    console.warn('--------------------------------------------------');
    console.warn('[Database Notice] Could not connect to MySQL.');
    console.warn(`Reason: ${error.message}`);
    console.warn('Check your DB_USER, DB_PASSWORD, and DB_NAME in .env');
    console.warn('Make sure MySQL80 service is running.');
    console.warn('--------------------------------------------------');
    return false;
  }
}

function isDatabaseReady() {
  return dbReady;
}

module.exports = {
  initDatabase,
  isDatabaseReady,
};
