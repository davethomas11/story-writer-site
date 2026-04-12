const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

/**
 * Initializes the Socket.io server with Presence and Live Sync.
 */
function initSocket(server) {
    const io = new Server(server, {
        cors: { origin: "*", methods: ["GET", "POST"] }
    });

    const presence = new Map();

    io.on('connection', (socket) => {
        let userId = socket.handshake.query.userId || `user-${Math.random().toString(36).substr(2, 9)}`;

        const getStoredUsername = (uid) => {
            const userPath = path.join(__dirname, 'users', `${uid}.json`);
            if (fs.existsSync(userPath)) {
                try {
                    return JSON.parse(fs.readFileSync(userPath, 'utf8')).username;
                } catch (e) { return null; }
            }
            return null;
        };

        presence.set(userId, { 
            userId,
            socketId: socket.id, 
            storyId: null,
            username: getStoredUsername(userId) || `Explorer ${userId.slice(-4)}`
        });

        socket.emit('session_established', { userId });

        socket.on('update_username', ({ username }) => {
            const user = presence.get(userId);
            if (user) {
                user.username = username;
                io.emit('presence_updated', Array.from(presence.values()));
            }
        });

        socket.on('join_story', ({ storyId }) => {
            const user = presence.get(userId);
            if (!user) return;
            if (user.storyId) socket.leave(`story:${user.storyId}`);
            user.storyId = storyId;
            socket.join(`story:${storyId}`);
            io.emit('presence_updated', Array.from(presence.values()));
        });

        // --- LIVE SYNC EVENTS ---

        // Sync what the user is currently typing in the input box
        socket.on('action_update', ({ storyId, text }) => {
            socket.to(`story:${storyId}`).emit('remote_action_update', { userId, text });
        });

        // Sync the Ollama stream results
        socket.on('narrative_update', ({ storyId, text, isFinal }) => {
            socket.to(`story:${storyId}`).emit('remote_narrative_update', { userId, text, isFinal });
        });

        socket.on('typing', ({ storyId }) => {
            const user = presence.get(userId);
            if (user && storyId) {
                socket.to(`story:${storyId}`).emit('user_typing', { userId, username: user.username });
            }
        });

        socket.on('stop_typing', ({ storyId }) => {
            if (storyId) {
                socket.to(`story:${storyId}`).emit('user_stop_typing', { userId });
            }
        });

        socket.on('disconnect', () => {
            presence.delete(userId);
            io.emit('presence_updated', Array.from(presence.values()));
        });
    });

    return io;
}

module.exports = initSocket;
