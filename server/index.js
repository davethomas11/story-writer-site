const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_TAGS_URL = 'http://localhost:11434/api/tags';

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

// Proxy for Ollama Story Generation
app.post('/api/generate', async (req, res) => {
    try {
        const { model, prompt, stream } = req.body;
        console.log(`Generating with model: ${model}...`);
        const response = await axios.post(OLLAMA_URL, { model, prompt, stream: false });
        res.json(response.data);
    } catch (error) {
        console.error('Ollama Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ 
            error: 'Failed to communicate with Ollama',
            details: error.response ? error.response.data : error.message 
        });
    }
});

// Save to novel.md
app.post('/api/save-novel', (req, res) => {
    const { content } = req.body;
    const novelPath = path.join(__dirname, '..', 'novel.md');

    fs.appendFile(novelPath, `\n\n${content}`, (err) => {
        if (err) {
            console.error('FS Error:', err);
            return res.status(500).json({ error: 'Failed to save to novel.md' });
        }
        res.json({ message: 'Successfully saved to novel.md' });
    });
});

// Serve static files AFTER API routes
app.use(express.static(path.join(__dirname, 'public')));

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Middleware server running at http://localhost:${PORT}`);
    });
}

module.exports = app;
