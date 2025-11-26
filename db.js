const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize Database Schema
const initDb = async () => {
  const client = await pool.connect();
  try {
    console.log('Checking database schema...');

    // Create Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_id VARCHAR(255) UNIQUE,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        display_name VARCHAR(255),
        avatar_url TEXT,
        verification_token VARCHAR(255),
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration for existing users table (idempotent)
    try {
      await client.query(`ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;`);
      await client.query(`ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);`);
    } catch (e) {
      // Ignore errors if columns/constraints already exist
      console.log('Migration note:', e.message);
    }

    // Create Tenders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenders (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        deadline TIMESTAMP,
        ai_summary TEXT,
        ai_score INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Database schema initialized successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
  }
};

module.exports = { pool, initDb };
