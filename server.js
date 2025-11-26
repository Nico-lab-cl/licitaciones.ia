const express = require('express');
const cors = require('cors');
const { pool, initDb } = require('./db');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'secret-key';

// Nodemailer Config
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Passport Config

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',
    proxy: true
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            const res = await pool.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);
            let user = res.rows[0];

            if (!user) {
                // Check if email exists (linked to manual account?)
                const emailRes = await pool.query('SELECT * FROM users WHERE email = $1', [profile.emails[0].value]);
                if (emailRes.rows.length > 0) {
                    // Link Google to existing account
                    user = emailRes.rows[0];
                    await pool.query('UPDATE users SET google_id = $1, avatar_url = $2 WHERE id = $3',
                        [profile.id, profile.photos[0].value, user.id]);
                } else {
                    // Create new user
                    const insert = await pool.query(
                        'INSERT INTO users (google_id, email, display_name, avatar_url, is_verified) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                        [profile.id, profile.emails[0].value, profile.displayName, profile.photos[0].value, true]
                    );
                    user = insert.rows[0];
                }
            }
            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }
));

// Local Strategy
passport.use(new LocalStrategy({
    usernameField: 'email'
}, async (email, password, done) => {
    try {
        const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = res.rows[0];

        if (!user) {
            return done(null, false, { message: 'Usuario no encontrado' });
        }
        if (!user.password) {
            return done(null, false, { message: 'Usa el inicio de sesión con Google' });
        }
        if (!user.is_verified) {
            return done(null, false, { message: 'Por favor verifica tu correo electrónico' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return done(null, false, { message: 'Contraseña incorrecta' });
        }

        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

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
app.use(express.urlencoded({ extended: true })); // For form data
app.use(express.static('public'));
app.use(session({
    secret: 'secret-session-key',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

initDb();

const authenticateWebhook = (req, res, next) => {
    const providedKey = req.headers['x-api-key'];
    if (providedKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
    next();
};

const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
};

// --- AUTH ROUTES ---

// Google Auth
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => res.redirect('/'));

// Manual Register
app.post('/auth/register', async (req, res) => {
    const { email, password, name } = req.body;
    try {
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: 'El correo ya está registrado' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const token = crypto.randomBytes(20).toString('hex');

        await pool.query(
            'INSERT INTO users (email, password, display_name, verification_token, is_verified) VALUES ($1, $2, $3, $4, $5)',
            [email, hashedPassword, name, token, false]
        );

        const verifyUrl = `https://${req.get('host')}/auth/verify/${token}`;
        await transporter.sendMail({
            to: email,
            subject: 'Verifica tu cuenta - Licitaciones IA',
            html: `<p>Hola ${name},</p><p>Haz clic en el siguiente enlace para verificar tu cuenta:</p><a href="${verifyUrl}">${verifyUrl}</a>`
        });

        res.json({ message: 'Registro exitoso. Revisa tu correo para verificar la cuenta.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error en el registro' });
    }
});

// Verify Email
app.get('/auth/verify/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const result = await pool.query(
            'UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE verification_token = $1 RETURNING *',
            [token]
        );

        if (result.rows.length === 0) {
            return res.send('Token inválido o expirado.');
        }
        res.send('¡Cuenta verificada! Ya puedes iniciar sesión en la aplicación.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error verificando cuenta');
    }
});

// Manual Login
app.post('/auth/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) return res.status(400).json({ error: info.message });
        req.logIn(user, (err) => {
            if (err) return next(err);
            return res.json({ message: 'Login exitoso', user });
        });
    })(req, res, next);
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

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

app.get('/api/tenders', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tenders ORDER BY ai_score DESC, created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/webhooks/tenders', authenticateWebhook, async (req, res) => {
    const { code, title, description, deadline, ai_summary, ai_score } = req.body;
    if (!code || !title) return res.status(400).json({ error: 'Missing required fields' });

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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
