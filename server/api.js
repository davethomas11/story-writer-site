const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_CHAT_URL = 'http://localhost:11434/api/chat';
const OLLAMA_TAGS_URL = 'http://localhost:11434/api/tags';
const STORIES_DIR = path.join(__dirname, 'stories');
const USERS_DIR = path.join(__dirname, 'users');

// Ensure directories exist
[STORIES_DIR, USERS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

function calculateHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
}

module.exports = (io) => {
    // API PING to verify server status
    router.get('/ping', (req, res) => {
        res.json({ status: 'ok', timestamp: new Date() });
    });

    // Statistics endpoint
    router.get('/stats', (req, res) => {
        try {
            const storyFiles = fs.readdirSync(STORIES_DIR).filter(f => f.endsWith('.json'));
            const userFiles = fs.readdirSync(USERS_DIR).filter(f => f.endsWith('.json'));

            let totalTurns = 0;
            let totalNovelChars = 0;
            let totalMessages = 0;

            storyFiles.forEach(file => {
                const storyData = JSON.parse(fs.readFileSync(path.join(STORIES_DIR, file), 'utf8'));
                totalTurns += (storyData.interactive || []).length;
                totalMessages += (storyData.messages || []).length;

                const mdPath = path.join(STORIES_DIR, file.replace('.json', '.md'));
                if (fs.existsSync(mdPath)) {
                    totalNovelChars += fs.readFileSync(mdPath, 'utf8').length;
                }
            });

            res.json({
                stories: storyFiles.length,
                users: userFiles.length,
                totalTurns,
                totalMessages,
                totalNovelChars,
                uptime: process.uptime()
            });
        } catch (error) {
            console.error('Stats Error:', error.message);
            res.status(500).json({ error: 'Failed to generate statistics' });
        }
    });

    // Health check endpoint (checks Ollama availability too)
    router.get('/health', async (req, res) => {
        const health = {
            server: 'ok',
            ollama: 'checking...',
            timestamp: new Date().toISOString()
        };

        try {
            const response = await axios.get(OLLAMA_TAGS_URL, { timeout: 2000 });
            health.ollama = 'ok';
            health.models = response.data.models ? response.data.models.length : 0;
            res.json(health);
        } catch (error) {
            health.ollama = 'unavailable';
            health.error = error.message;
            res.status(503).json(health);
        }
    });

    // Fetch available models from Ollama
    router.get('/models', async (req, res) => {
        try {
            const response = await axios.get(OLLAMA_TAGS_URL);
            res.json(response.data);
        } catch (error) {
            console.error('Ollama Models Error:', error.message);
            res.status(500).json({ error: 'Failed to fetch models from Ollama' });
        }
    });

    // Proxy for Ollama Chat (Supports Streaming)
    router.post('/chat', async (req, res) => {
        try {
            const { model, messages, stream } = req.body;
            
            if (stream) {
                const response = await axios({
                    method: 'post',
                    url: OLLAMA_CHAT_URL,
                    data: { model, messages, stream: true },
                    responseType: 'stream'
                });

                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');

                response.data.pipe(res);
            } else {
                const response = await axios.post(OLLAMA_CHAT_URL, { model, messages, stream: false });
                res.json(response.data);
            }
        } catch (error) {
            console.error('Ollama Chat Error:', error.message);
            res.status(500).json({ error: 'Failed to communicate with Ollama Chat API' });
        }
    });

    // Proxy for Ollama Story Generation (Legacy Support)
    router.post('/generate', async (req, res) => {
        try {
            const { model, prompt, stream } = req.body;
            const response = await axios.post(OLLAMA_URL, { model, prompt, stream: false });
            res.json(response.data);
        } catch (error) {
            console.error('Ollama Error:', error.message);
            res.status(500).json({ error: 'Failed to communicate with Ollama' });
        }
    });

    // --- USER PROFILE ENDPOINTS ---

    router.get('/profile/:userId', (req, res) => {
        try {
            const userPath = path.join(USERS_DIR, `${req.params.userId}.json`);
            if (fs.existsSync(userPath)) {
                const data = JSON.parse(fs.readFileSync(userPath, 'utf8'));
                res.json(data);
            } else {
                res.json({ userId: req.params.userId, username: `Explorer ${req.params.userId.slice(-4)}` });
            }
        } catch (error) {
            res.status(500).json({ error: 'Failed to load profile' });
        }
    });

    router.post('/profile', (req, res) => {
        try {
            const { userId, username } = req.body;
            if (!userId || !username) return res.status(400).json({ error: 'Missing userId or username' });

            const userPath = path.join(USERS_DIR, `${userId}.json`);
            const data = { userId, username, updatedAt: new Date().toISOString() };
            fs.writeFileSync(userPath, JSON.stringify(data, null, 2));
            
            // Emit event so WebSocket presence can update
            io.emit('profile_updated', data);

            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'Failed to save profile' });
        }
    });

    // --- STORY MANAGEMENT ENDPOINTS (HYBRID STORAGE) ---

    // List all stories (metadata only)
    router.get('/stories', (req, res) => {
        try {
            const files = fs.readdirSync(STORIES_DIR);
            const stories = files.filter(f => f.endsWith('.json')).map(file => {
                const data = JSON.parse(fs.readFileSync(path.join(STORIES_DIR, file), 'utf8'));
                return {
                    id: data.id,
                    title: data.title,
                    createdAt: data.createdAt
                };
            });
            res.json(stories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        } catch (error) {
            res.status(500).json({ error: 'Failed to list stories' });
        }
    });

    // Get a specific story (Merging JSON and MD)
    router.get('/stories/:id', (req, res) => {
        try {
            const jsonPath = path.join(STORIES_DIR, `${req.params.id}.json`);
            const mdPath = path.join(STORIES_DIR, `${req.params.id}.md`);

            if (!fs.existsSync(jsonPath)) return res.status(404).json({ error: 'Story not found' });
            
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            
            // Inject novel text from MD if it exists
            let novel = "";
            if (fs.existsSync(mdPath)) {
                novel = fs.readFileSync(mdPath, 'utf8');
            }
            data.novel = novel || data.novel || ""; 

            // Calculate hash for the frontend to track changes
            const hash = calculateHash(JSON.stringify(data));
            res.json({ story: data, hash });
        } catch (error) {
            res.status(500).json({ error: 'Failed to load story' });
        }
    });

    // Create a new story (Initializing both files)
    router.post('/stories', (req, res) => {
        try {
            const id = `story-${Date.now()}`;
            const newStory = {
                id,
                title: req.body.title || 'Untitled Adventure',
                createdAt: new Date().toISOString(),
                interactive: [],
                messages: [],
                currentMood: 'default',
                currentTheme: { bg: '#09090b', accent: '#52525b' }
            };
            
            // Write JSON (minus novel)
            fs.writeFileSync(path.join(STORIES_DIR, `${id}.json`), JSON.stringify(newStory, null, 2));
            
            // Write empty MD
            fs.writeFileSync(path.join(STORIES_DIR, `${id}.md`), `# ${newStory.title}\n\n`);
            
            // Add back empty novel string for frontend consistency
            newStory.novel = "";

            // Emit WebSocket event
            const initiator = req.headers['x-user-id'];
            io.emit('story_created', { storyId: id, initiator });

            res.status(201).json(newStory);
        } catch (error) {
            res.status(500).json({ error: 'Failed to create story' });
        }
    });

    // Update an existing story (Splitting JSON and MD)
    router.put('/stories/:id', (req, res) => {
        try {
            const jsonPath = path.join(STORIES_DIR, `${req.params.id}.json`);
            const mdPath = path.join(STORIES_DIR, `${req.params.id}.md`);

            if (!fs.existsSync(jsonPath)) return res.status(404).json({ error: 'Story not found' });
            
            const fullData = req.body;
            const novelContent = fullData.novel || "";
            
            // Extract structured data
            const { novel, ...structuredData } = fullData;
            
            // Write Markdown file
            fs.writeFileSync(mdPath, novelContent);
            
            // Write JSON file (without the long novel text)
            fs.writeFileSync(jsonPath, JSON.stringify(structuredData, null, 2));
            
            // Calculate new hash
            const newHash = calculateHash(JSON.stringify(fullData));

            // Emit WebSocket event to specific story room
            const initiator = req.headers['x-user-id'];
            io.to(`story:${req.params.id}`).emit('story_updated', { storyId: req.params.id, newHash, initiator });

            res.json({ story: fullData, hash: newHash });
        } catch (error) {
            res.status(500).json({ error: 'Failed to update story' });
        }
    });

    // Delete a story (Cleanup both files)
    router.delete('/stories/:id', (req, res) => {
        try {
            const jsonPath = path.join(STORIES_DIR, `${req.params.id}.json`);
            const mdPath = path.join(STORIES_DIR, `${req.params.id}.md`);

            if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
            if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);
            
            // Emit WebSocket event
            const initiator = req.headers['x-user-id'];
            io.emit('story_deleted', { storyId: req.params.id, initiator });

            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete story' });
        }
    });

    return router;
};
