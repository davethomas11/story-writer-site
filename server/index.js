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
app.use(bodyParser.json({ limit: '10mb' })); // Increase limit for larger story contexts

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

// --- STORY MANAGEMENT ENDPOINTS (HYBRID STORAGE) ---

// List all stories (metadata only)
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

// Get a specific story (Merging JSON and MD)
app.get('/api/stories/:id', (req, res) => {
    try {
        const jsonPath = path.join(STORIES_DIR, `${req.params.id}.json`);
        const mdPath = path.join(STORIES_DIR, `${req.params.id}.md`);

        if (!fs.existsSync(jsonPath)) return res.status(404).json({ error: 'Story not found' });
        
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        
        // Inject novel text from MD if it exists
        if (fs.existsSync(mdPath)) {
            data.novel = fs.readFileSync(mdPath, 'utf8');
        } else {
            data.novel = data.novel || ""; // Fallback
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load story' });
    }
});

// Create a new story (Initializing both files)
app.post('/api/stories', (req, res) => {
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
        res.status(201).json(newStory);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create story' });
    }
});

// Update an existing story (Splitting JSON and MD)
app.put('/api/stories/:id', (req, res) => {
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
        
        res.json(fullData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update story' });
    }
});

// Delete a story (Cleanup both files)
app.delete('/api/stories/:id', (req, res) => {
    try {
        const jsonPath = path.join(STORIES_DIR, `${req.params.id}.json`);
        const mdPath = path.join(STORIES_DIR, `${req.params.id}.md`);

        if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
        if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete story' });
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Middleware server running at http://localhost:${PORT}`);
    });
}

module.exports = app;
