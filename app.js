import express, { urlencoded } from 'express';
import session from 'express-session';
import { compare } from 'bcrypt';
import { createConnection } from 'mysql2';
import { CONFIG } from './config';

// Config
const config = {
    port: 3000,
    db: {
        host: CONFIG.db.host,
        user: CONFIG.db.user,
        password: CONFIG.db.password,
        database: CONFIG.db.database
    },
    session: {
        secret: 'secret_key',
        cookie: {
            httpOnly: true,
            secure: false,
            maxAge: 3600000
        }
    }
};

// Database setup
const setupDatabase = () => {
    const db = createConnection(config.db);
    db.connect((err) => {
        if (err) throw new Error('Database connection failed');
        console.log('Database connected');
    });
    return db;
};

// Middleware setup
const setupMiddleware = (app) => {
    app.set('view engine', 'ejs');
    app.use(urlencoded({ extended: true }));
    app.use(session({
        ...config.session,
        resave: false,
        saveUninitialized: true
    }));
};

// Auth controllers
const authController = (db) => ({
    login: async (req, res) => {
        const { username, password } = req.body;
        
        try {
            const [users] = await db.promise().query('SELECT * FROM users WHERE username = ?', [username]);
            
            if (users.length && await compare(password, users[0].password)) {
                req.session.isLoggedIn = true;
                req.session.username = username;
                return res.redirect('/dashboard');
            }
            
            res.render('login', { error: 'Invalid username or password' });
        } catch (err) {
            console.error(err);
            res.render('login', { error: 'Something went wrong. Please try again.' });
        }
    },

    logout: (req, res) => {
        req.session.destroy((err) => {
            if (err) console.error(err);
            res.redirect('/');
        });
    }
});

// Auth middleware
const requireAuth = (req, res, next) => {
    if (!req.session.isLoggedIn) return res.redirect('/');
    next();
};

// Routes setup
const setupRoutes = (app, auth) => {
    app.get('/', (req, res) => res.render('login', { error: null }));
    app.post('/login', auth.login);
    app.get('/logout', auth.logout);
    app.get('/dashboard', requireAuth, (req, res) => {
        res.render('dashboard', { username: req.session.username });
    });
};

// Main app initialization
const initializeApp = () => {
    const app = express();
    const db = setupDatabase();
    const auth = authController(db);

    setupMiddleware(app);
    setupRoutes(app, auth);

    app.listen(config.port, () => {
        console.log(`Server running at http://localhost:${config.port}`);
    });
};

initializeApp();
