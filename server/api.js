const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { sanitizeFolderName } = require('./utils');
const chapter = require('./chapter');

const context = require('./context');

const router = express.Router();

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_CHAT_URL = 'http://localhost:11434/api/chat';
const OLLAMA_TAGS_URL = 'http://localhost:11434/api/tags';
const STORIES_DIR = path.join(__dirname, 'stories');
const USERS_DIR = path.join(__dirname, 'users');

// Ensure directories exist
[STORIES_DIR, USERS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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
            const folders = fs.readdirSync(STORIES_DIR).filter(f => {
                const p = path.join(STORIES_DIR, f);
                return fs.statSync(p).isDirectory() && f !== 'archive';
            });
            const userFiles = fs.readdirSync(USERS_DIR).filter(f => f.endsWith('.json'));

            let totalTurns = 0;
            let totalNovelChars = 0;
            let totalMessages = 0;

            folders.forEach(folder => {
                const storyDir = path.join(STORIES_DIR, folder);
                const configPath = path.join(storyDir, 'config.json');
                if (!fs.existsSync(configPath)) return;

                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                
                (config.chapters || []).forEach(ch => {
                    const chDir = path.join(storyDir, ch);
                    const messagesPath = path.join(chDir, 'messages.json');
                    const novelPath = path.join(chDir, 'novel.md');
                    
                    if (fs.existsSync(messagesPath)) {
                        const msgs = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
                        totalMessages += msgs.length;
                        totalTurns += Math.floor(msgs.length / 2); // Approximation
                    }
                    if (fs.existsSync(novelPath)) {
                        totalNovelChars += fs.readFileSync(novelPath, 'utf8').length;
                    }
                });
            });

            res.json({
                stories: folders.length,
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

    // Story-specific Chat (Context-aware)
    router.post('/stories/:id/chat', async (req, res) => {
        try {
            const { model, action, stream } = req.body;
            const storyId = req.params.id;
            
            const config = chapter.getStoryConfig(storyId);
            if (!config) return res.status(404).json({ error: 'Story not found' });
            
            const currentChapter = config.currentChapter || 'chapter-1';
            
            // 1. Build context-aware prompt
            const messages = context.buildPrompt(storyId, currentChapter);
            
            // 2. Add the new user action
            messages.push({ role: "user", content: action });

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
                
                // We'll handle state updates on the frontend for now (saving back to server)
                // or we could listen to the stream here and update state on 'done'
            } else {
                const response = await axios.post(OLLAMA_CHAT_URL, { model, messages, stream: false });
                
                // Auto-summarize check
                const chData = chapter.getChapterData(storyId, currentChapter);
                if (context.shouldSummarize(chData)) {
                    // Run in background
                    context.updateSummary(storyId, currentChapter, model);
                }
                
                res.json(response.data);
            }
        } catch (error) {
            console.error('Story Chat Error:', error.message);
            res.status(500).json({ error: 'Failed to communicate with AI' });
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

    // --- STORY MANAGEMENT ENDPOINTS (V2 FOLDER STORAGE) ---

    function parseInteractive(md) {
        if (!md) return [];
        return md.split('\n\n---\n\n').filter(t => t.trim()).map(turnMd => {
            const lines = turnMd.split('\n\n');
            const action = lines[0].startsWith('> ') ? lines[0].replace(/^> /, '').trim() : 'Beginning';
            const response = lines.slice(1).join('\n\n').trim();
            return { action, response, mood: 'default' };
        });
    }

    // List all stories (metadata only)
    router.get('/stories', (req, res) => {
        try {
            const folders = fs.readdirSync(STORIES_DIR).filter(f => {
                const p = path.join(STORIES_DIR, f);
                return fs.statSync(p).isDirectory() && f !== 'archive';
            });
            
            const stories = folders.map(folder => {
                const configPath = path.join(STORIES_DIR, folder, 'config.json');
                if (!fs.existsSync(configPath)) return null;
                const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                return {
                    id: data.id,
                    title: data.title,
                    createdAt: data.createdAt
                };
            }).filter(s => s !== null);
            
            res.json(stories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        } catch (error) {
            console.error('List Stories Error:', error.message);
            res.status(500).json({ error: 'Failed to list stories' });
        }
    });

    // Get a specific story
    router.get('/stories/:id', (req, res) => {
        try {
            const config = chapter.getStoryConfig(req.params.id);
            if (!config) return res.status(404).json({ error: 'Story not found' });

            const chData = chapter.getChapterData(req.params.id, config.currentChapter || 'chapter-1');
            
            // Construct the story object for the frontend
            const story = {
                ...config,
                interactive: parseInteractive(chData.interactive),
                novel: chData.novel,
                messages: chData.messages,
                summary: chData.summary
            };

            const hash = calculateHash(JSON.stringify(story));
            res.json({ story, hash });
        } catch (error) {
            console.error('Load Story Error:', error.message);
            res.status(500).json({ error: 'Failed to load story' });
        }
    });

    // Create a new story
    router.post('/stories', (req, res) => {
        try {
            const id = `story-${Date.now()}`;
            const title = req.body.title || 'Untitled Adventure';
            const folderName = sanitizeFolderName(title, id);
            const storyDir = path.join(STORIES_DIR, folderName);

            if (!fs.existsSync(storyDir)) fs.mkdirSync(storyDir, { recursive: true });

            const config = {
                id,
                title,
                createdAt: new Date().toISOString(),
                currentMood: 'default',
                currentTheme: { bg: '#09090b', accent: '#52525b' },
                chapters: ['chapter-1'],
                currentChapter: 'chapter-1'
            };

            fs.writeFileSync(path.join(storyDir, 'config.json'), JSON.stringify(config, null, 2));

            // Initialize first chapter
            chapter.saveChapterData(id, 'chapter-1', {
                interactive: '',
                novel: '',
                messages: [],
                summary: { characters: [], locations: [], plotPoints: [], lastUpdated: new Date().toISOString() }
            });

            // Emit WebSocket event
            const initiator = req.headers['x-user-id'];
            io.emit('story_created', { storyId: id, initiator });

            res.status(201).json({ ...config, interactive: [], novel: '', messages: [] });
        } catch (error) {
            console.error('Create Story Error:', error.message);
            res.status(500).json({ error: 'Failed to create story' });
        }
    });

    // Update an existing story
    router.put('/stories/:id', (req, res) => {
        try {
            const config = chapter.getStoryConfig(req.params.id);
            if (!config) return res.status(404).json({ error: 'Story not found' });

            const fullData = req.body;
            const { interactive, novel, messages, summary, ...newConfig } = fullData;

            // Update config.json
            chapter.saveStoryConfig(req.params.id, newConfig);

            // Update current chapter data
            // Convert interactive array back to MD if it's provided as an array
            let interactiveMd = '';
            if (Array.isArray(interactive)) {
                interactiveMd = interactive.map(turn => `> ${turn.action}\n\n${turn.response}`).join('\n\n---\n\n');
            } else {
                interactiveMd = interactive || '';
            }

            chapter.saveChapterData(req.params.id, config.currentChapter || 'chapter-1', {
                interactive: interactiveMd,
                novel,
                messages,
                summary
            });

            const newHash = calculateHash(JSON.stringify(fullData));

            // Emit WebSocket event to specific story room
            const initiator = req.headers['x-user-id'];
            io.to(`story:${req.params.id}`).emit('story_updated', { storyId: req.params.id, newHash, initiator });

            res.json({ story: fullData, hash: newHash });
        } catch (error) {
            console.error('Update Story Error:', error.message);
            res.status(500).json({ error: 'Failed to update story' });
        }
    });

    // --- CHAPTER MANAGEMENT ENDPOINTS ---

    router.post('/stories/:id/chapters', (req, res) => {
        try {
            const newChapter = chapter.createNewChapter(req.params.id);
            res.status(201).json({ chapter: newChapter });
        } catch (error) {
            console.error('Create Chapter Error:', error.message);
            res.status(500).json({ error: 'Failed to create new chapter' });
        }
    });

    router.post('/stories/:id/chapters/switch', (req, res) => {
        try {
            const { chapterName } = req.body;
            const config = chapter.getStoryConfig(req.params.id);
            if (!config) return res.status(404).json({ error: 'Story not found' });
            
            if (!config.chapters.includes(chapterName)) {
                return res.status(400).json({ error: 'Chapter not found' });
            }

            config.currentChapter = chapterName;
            chapter.saveStoryConfig(req.params.id, config);
            
            res.json({ success: true, currentChapter: chapterName });
        } catch (error) {
            console.error('Switch Chapter Error:', error.message);
            res.status(500).json({ error: 'Failed to switch chapter' });
        }
    });

    router.post('/stories/:id/chapters/recompose', async (req, res) => {
        try {
            const { model } = req.body;
            const storyId = req.params.id;
            const config = chapter.getStoryConfig(storyId);
            if (!config) return res.status(404).json({ error: 'Story not found' });
            
            const currentChapter = config.currentChapter || 'chapter-1';
            const chData = chapter.getChapterData(storyId, currentChapter);
            
            const recomposePrompt = [
                {
                    role: "system",
                    content: `You are a master novelist. Rewrite the following interactive story chapter into a continuous, immersive FIRST-PERSON narrative.
                    Keep all major plot points and characters.
                    The transcript provided is a series of actions and responses.
                    Integrate them into a seamless story.
                    Respond ONLY with the rewritten narrative text.`
                },
                {
                    role: "user",
                    content: `Chapter Context: ${JSON.stringify(chData.summary)}\n\nTranscript:\n${chData.interactive}`
                }
            ];

            const response = await axios.post(OLLAMA_CHAT_URL, { model, messages: recomposePrompt, stream: false });
            const newInteractiveMd = response.data.message.content;
            
            // Save back as a single block (or we could try to re-parse it, but a single block is what 'recompose' implies)
            chapter.saveChapterData(storyId, currentChapter, { interactive: newInteractiveMd });
            
            res.json({ success: true, interactive: newInteractiveMd });
        } catch (error) {
            console.error('Recompose Chapter Error:', error.message);
            res.status(500).json({ error: 'Failed to recompose chapter' });
        }
    });

    // Delete a story
    router.delete('/stories/:id', (req, res) => {
        try {
            const storyDir = chapter.getStoryDir(req.params.id);
            if (!storyDir) return res.status(404).json({ error: 'Story not found' });

            // Move to archive instead of deleting
            const archiveDir = path.join(STORIES_DIR, 'archive');
            if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir);
            
            const folderName = path.basename(storyDir);
            fs.renameSync(storyDir, path.join(archiveDir, folderName));

            // Emit WebSocket event
            const initiator = req.headers['x-user-id'];
            io.emit('story_deleted', { storyId: req.params.id, initiator });

            res.json({ success: true });
        } catch (error) {
            console.error('Delete Story Error:', error.message);
            res.status(500).json({ error: 'Failed to delete story' });
        }
    });

    return router;
};
