const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_CHAT_URL = 'http://localhost:11434/api/chat';
const OLLAMA_TAGS_URL = 'http://localhost:11434/api/tags';
const STORIES_DIR = path.join(__dirname, 'stories');

// Ensure stories directory exists
if (!fs.existsSync(STORIES_DIR)) {
    fs.mkdirSync(STORIES_DIR);
}

app.use(cors());
app.use(bodyParser.json());

// API PING to verify server status
app.get('/api/ping', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Fetch available models from Ollama
app.get('/api/models', async (req, res) => {
    try {
        const response = await axios.get(OLLAMA_TAGS_URL);
        res.json(response.data);
    } catch (error) {
        console.error('Ollama Models Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch models from Ollama' });
    }
});

// Proxy for Ollama Chat (Supports Streaming)
app.post('/api/chat', async (req, res) => {
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
app.post('/api/generate', async (req, res) => {
    try {
        const { model, prompt, stream } = req.body;
        const response = await axios.post(OLLAMA_URL, { model, prompt, stream: false });
        res.json(response.data);
    } catch (error) {
        console.error('Ollama Error:', error.message);
        res.status(500).json({ error: 'Failed to communicate with Ollama' });
    }
});

// --- STORY MANAGEMENT ENDPOINTS ---

app.get('/api/stories', (req, res) => {
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

app.get('/api/stories/:id', (req, res) => {
    try {
        const storyPath = path.join(STORIES_DIR, `${req.params.id}.json`);
        if (!fs.existsSync(storyPath)) return res.status(404).json({ error: 'Story not found' });
        const data = fs.readFileSync(storyPath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: 'Failed to load story' });
    }
});

app.post('/api/stories', (req, res) => {
    try {
        const id = `story-${Date.now()}`;
        const newStory = {
            id,
            title: req.body.title || 'Untitled Adventure',
            createdAt: new Date().toISOString(),
            interactive: [],
            messages: [], // Chat context
            novel: "",
            currentMood: 'default',
            currentTheme: { bg: '#09090b', accent: '#52525b' }
        };
        fs.writeFileSync(path.join(STORIES_DIR, `${id}.json`), JSON.stringify(newStory, null, 2));
        res.status(201).json(newStory);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create story' });
    }
});

app.put('/api/stories/:id', (req, res) => {
    try {
        const storyPath = path.join(STORIES_DIR, `${req.params.id}.json`);
        if (!fs.existsSync(storyPath)) return res.status(404).json({ error: 'Story not found' });
        fs.writeFileSync(storyPath, JSON.stringify(req.body, null, 2));
        res.json(req.body);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update story' });
    }
});

app.delete('/api/stories/:id', (req, res) => {
    try {
        const storyPath = path.join(STORIES_DIR, `${req.params.id}.json`);
        if (fs.existsSync(storyPath)) fs.unlinkSync(storyPath);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete story' });
    }
});

app.use(express.static(path.join(__dirname, 'public')));

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Middleware server running at http://localhost:${PORT}`);
    });
}

module.exports = app;
