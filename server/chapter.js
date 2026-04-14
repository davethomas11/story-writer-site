const fs = require('fs');
const path = require('path');

const STORIES_DIR = path.join(__dirname, 'stories');

function getStoryDir(storyId) {
    // We need to find the folder that ends with the storyId
    const folders = fs.readdirSync(STORIES_DIR);
    const folder = folders.find(f => f.endsWith(storyId) && fs.statSync(path.join(STORIES_DIR, f)).isDirectory());
    return folder ? path.join(STORIES_DIR, folder) : null;
}

function getChapterDir(storyDir, chapterName) {
    return path.join(storyDir, chapterName);
}

function getStoryConfig(storyId) {
    const storyDir = getStoryDir(storyId);
    if (!storyDir) return null;
    const configPath = path.join(storyDir, 'config.json');
    if (!fs.existsSync(configPath)) return null;
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function saveStoryConfig(storyId, config) {
    const storyDir = getStoryDir(storyId);
    if (!storyDir) throw new Error('Story directory not found');
    fs.writeFileSync(path.join(storyDir, 'config.json'), JSON.stringify(config, null, 2));
}

function getChapterData(storyId, chapterName) {
    const storyDir = getStoryDir(storyId);
    if (!storyDir) return null;
    const chapterDir = getChapterDir(storyDir, chapterName);
    if (!fs.existsSync(chapterDir)) return null;

    const interactivePath = path.join(chapterDir, 'interactive.md');
    const novelPath = path.join(chapterDir, 'novel.md');
    const messagesPath = path.join(chapterDir, 'messages.json');
    const summaryPath = path.join(chapterDir, 'summary.json');

    return {
        interactive: fs.existsSync(interactivePath) ? fs.readFileSync(interactivePath, 'utf8') : '',
        novel: fs.existsSync(novelPath) ? fs.readFileSync(novelPath, 'utf8') : '',
        messages: fs.existsSync(messagesPath) ? JSON.parse(fs.readFileSync(messagesPath, 'utf8')) : [],
        summary: fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, 'utf8')) : {}
    };
}

function saveChapterData(storyId, chapterName, data) {
    const storyDir = getStoryDir(storyId);
    if (!storyDir) throw new Error('Story directory not found');
    const chapterDir = getChapterDir(storyDir, chapterName);
    if (!fs.existsSync(chapterDir)) fs.mkdirSync(chapterDir, { recursive: true });

    if (data.interactive !== undefined) {
        fs.writeFileSync(path.join(chapterDir, 'interactive.md'), data.interactive);
    }
    if (data.novel !== undefined) {
        fs.writeFileSync(path.join(chapterDir, 'novel.md'), data.novel);
    }
    if (data.messages !== undefined) {
        fs.writeFileSync(path.join(chapterDir, 'messages.json'), JSON.stringify(data.messages, null, 2));
    }
    if (data.summary !== undefined) {
        fs.writeFileSync(path.join(chapterDir, 'summary.json'), JSON.stringify(data.summary, null, 2));
    }
}

function createNewChapter(storyId) {
    const config = getStoryConfig(storyId);
    if (!config) throw new Error('Story not found');

    const lastChapterNum = config.chapters.length;
    const newChapterName = `chapter-${lastChapterNum + 1}`;
    
    // Initialize new chapter folder
    const storyDir = getStoryDir(storyId);
    const chapterDir = getChapterDir(storyDir, newChapterName);
    if (!fs.existsSync(chapterDir)) fs.mkdirSync(chapterDir);

    // Initial chapter files
    saveChapterData(storyId, newChapterName, {
        interactive: '',
        novel: '',
        messages: [],
        summary: { 
            characters: [], // Could inherit from previous chapter
            locations: [],
            plotPoints: [],
            lastUpdated: new Date().toISOString()
        }
    });

    // Update config
    config.chapters.push(newChapterName);
    config.currentChapter = newChapterName;
    saveStoryConfig(storyId, config);

    return newChapterName;
}

module.exports = {
    getStoryDir,
    getChapterDir,
    getStoryConfig,
    saveStoryConfig,
    getChapterData,
    saveChapterData,
    createNewChapter
};
