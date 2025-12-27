const express = require('express');
const cors = require('cors');
const usersRoutes = require('../backend/src/routes/users');
const eventsRoutes = require('../backend/src/routes/events');
const carpoolingRoutes = require('../backend/src/routes/carpooling');
const messagesRoutes = require('../backend/src/routes/messages');

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

app.get('/api/health', (req, res) => {
    res.json({ status: "ok", environment: "production" });
});

app.get('/api', (req, res) => {
    res.json({ message: "API Football Manager Running on Vercel" });
});

module.exports = app;
