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
