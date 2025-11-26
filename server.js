const express = require('express');
const cors = require('cors');
const { pool, initDb } = require('./db');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'secret-key';

// Passport Config
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            // Check if user exists
            const res = await pool.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);
            let user = res.rows[0];

            if (!user) {
                // Create new user
                const insert = await pool.query(
                    'INSERT INTO users (google_id, email, display_name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *',
                    [profile.id, profile.emails[0].value, profile.displayName, profile.photos[0].value]
                );
                user = insert.rows[0];
            }
            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        done(null, res.rows[0]);
    } catch (err) {
        done(err, null);
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'secret-session-key', // In production use a better secret
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

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

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
};

// --- AUTH ROUTES ---

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        // Successful authentication, redirect home.
        res.redirect('/');
    });

app.get('/auth/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

app.get('/api/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ authenticated: true, user: req.user });
    } else {
        res.json({ authenticated: false });
    }
});

// --- APP ROUTES ---

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// 1. GET /api/tenders - Fetch all tenders for the Dashboard (Protected)
app.get('/api/tenders', isAuthenticated, async (req, res) => {
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
