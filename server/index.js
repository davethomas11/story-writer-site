const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const OLLAMA_URL = 'http://localhost:11434/api/generate';

app.use(cors());
app.use(bodyParser.json());

// Proxy for Ollama Story Generation
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

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Middleware server running at http://localhost:${PORT}`);
    });
}

module.exports = app;
