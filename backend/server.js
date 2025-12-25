require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Global logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Routes
const usersRoutes = require('./src/routes/users');
const eventsRoutes = require('./src/routes/events');
const carpoolingRoutes = require('./src/routes/carpooling');
const messagesRoutes = require('./src/routes/messages');

// Use Routes
// Note: We might want some public routes, but mostly protected.
// The routes files themselves apply 'requireAuth' where needed.
app.use('/api/users', usersRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/carpooling', carpoolingRoutes);
app.use('/api/messages', messagesRoutes);

app.get('/', (req, res) => {
    res.json({ message: "API Football Manager Running" });
});

// Export for Vercel
module.exports = app;

// Only listen if run directly
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}
