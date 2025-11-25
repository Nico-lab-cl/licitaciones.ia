const express = require('express');
const cors = require('cors');
const { pool, initDb } = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'secret-key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize DB on startup
initDb();

// Middleware for API Key protection on Webhooks
const authenticateWebhook = (req, res, next) => {
    const providedKey = req.headers['x-api-key'];
    if (providedKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
    next();
};

// --- ROUTES ---

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// 1. GET /api/tenders - Fetch all tenders for the Dashboard
app.get('/api/tenders', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tenders ORDER BY ai_score DESC, created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// 2. POST /api/webhooks/tenders - Receive new tender from N8N
app.post('/api/webhooks/tenders', authenticateWebhook, async (req, res) => {
    const { code, title, description, deadline, ai_summary, ai_score } = req.body;

    if (!code || !title) {
        return res.status(400).json({ error: 'Missing required fields (code, title)' });
    }

    try {
        const query = `
      INSERT INTO tenders (code, title, description, deadline, ai_summary, ai_score)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (code) DO UPDATE 
      SET ai_summary = EXCLUDED.ai_summary, ai_score = EXCLUDED.ai_score
      RETURNING *;
    `;
        const values = [code, title, description, deadline, ai_summary, ai_score];
        const result = await pool.query(query, values);

        console.log(`[Webhook] Processed tender: ${code}`);
        res.status(201).json({ message: 'Tender saved', data: result.rows[0] });
    } catch (err) {
        console.error('Error saving tender:', err);
        res.status(500).json({ error: 'Failed to save tender' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
