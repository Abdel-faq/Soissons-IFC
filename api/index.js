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

// Use Routes
const mountRoutes = (basePath) => {
    app.use(`${basePath}/users`, usersRoutes);
    app.use(`${basePath}/events`, eventsRoutes);
    app.use(`${basePath}/carpooling`, carpoolingRoutes);
    app.use(`${basePath}/messages`, messagesRoutes);
};

// Mount both with and without /api prefix for maximum compatibility
mountRoutes('/api');
mountRoutes('');

app.get('/health', (req, res) => {
    res.json({ status: "ok", environment: "production" });
});

app.get('/', (req, res) => {
    res.json({ message: "API Football Manager Running on Vercel" });
});

module.exports = app;
