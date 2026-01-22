const express = require('express');
const cors = require('cors');
const usersRoutes = require('../backend/src/routes/users');
const eventsRoutes = require('../backend/src/routes/events');
const carpoolingRoutes = require('../backend/src/routes/carpooling');
const messagesRoutes = require('../backend/src/routes/messages');
const fffRoutes = require('../backend/src/routes/fff');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Global logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Mount routes
app.use('/api/users', usersRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/carpooling', carpoolingRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/fff', fffRoutes);

app.get('/api/health', (req, res) => {
    res.json({
        status: "ok",
        environment: "production",
        supabase_configured: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) && !!(process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY),
        has_standard_vars: !!process.env.SUPABASE_URL,
        has_vite_vars: !!process.env.VITE_SUPABASE_URL,
        node_version: process.version
    });
});

app.get('/api', (req, res) => {
    res.json({ message: "API Football Manager Running on Vercel" });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Global API Error:", err);
    res.status(500).json({
        error: "Internal Server Error",
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

module.exports = app;
