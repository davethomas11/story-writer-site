const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const initSocket = require('./socket');
const createApiRouter = require('./api');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize WebSocket
const io = initSocket(server);

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Attach io to the app instance for access in routes if needed
app.set('io', io);

// Routes
app.use('/api', createApiRouter(io));

// Serve SPA - Fallback to index.html for any unknown routes
app.get('.*path', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
if (require.main === module) {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Middleware server running at http://localhost:${PORT}`);
    });
}

module.exports = server;
