const fs = require('fs');
const path = require('path');
const { sanitizeFolderName } = require('./utils');

const STORIES_DIR = path.join(__dirname, 'stories');

function migrate() {
    console.log('Starting migration to V2 storage structure...');

    if (!fs.existsSync(STORIES_DIR)) {
        console.error('Stories directory not found!');
        return;
    }

    const files = fs.readdirSync(STORIES_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f.startsWith('story-'));

    jsonFiles.forEach(jsonFile => {
        const id = jsonFile.replace('.json', '');
        const jsonPath = path.join(STORIES_DIR, jsonFile);
        const mdFile = jsonFile.replace('.json', '.md');
        const mdPath = path.join(STORIES_DIR, mdFile);

        try {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            const folderName = sanitizeFolderName(data.title, id);
            const newStoryDir = path.join(STORIES_DIR, folderName);

            if (!fs.existsSync(newStoryDir)) {
                fs.mkdirSync(newStoryDir, { recursive: true });
            }

            // 1. Create config.json
            const config = {
                id: data.id || id,
                title: data.title || 'Untitled Adventure',
                createdAt: data.createdAt || new Date().toISOString(),
                currentMood: data.currentMood || 'default',
                currentTheme: data.currentTheme || { bg: '#09090b', accent: '#52525b' },
                chapters: ['chapter-1'],
                currentChapter: 'chapter-1'
            };
            fs.writeFileSync(path.join(newStoryDir, 'config.json'), JSON.stringify(config, null, 2));

            // 2. Create chapter-1/
            const chapterDir = path.join(newStoryDir, 'chapter-1');
            if (!fs.existsSync(chapterDir)) {
                fs.mkdirSync(chapterDir);
            }

            // 3. Create interactive.md from data.interactive
            const interactiveContent = (data.interactive || []).map(turn => {
                return `> ${turn.action}\n\n${turn.response}`;
            }).join('\n\n---\n\n');
            fs.writeFileSync(path.join(chapterDir, 'interactive.md'), interactiveContent);

            // 4. Create novel.md from existing .md file
            if (fs.existsSync(mdPath)) {
                fs.copyFileSync(mdPath, path.join(chapterDir, 'novel.md'));
            } else {
                fs.writeFileSync(path.join(chapterDir, 'novel.md'), '');
            }

            // 5. Create messages.json
            const messages = data.messages || [];
            fs.writeFileSync(path.join(chapterDir, 'messages.json'), JSON.stringify(messages, null, 2));

            // 6. Create initial summary.json
            const summary = {
                characters: [],
                locations: [],
                plotPoints: [],
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(path.join(chapterDir, 'summary.json'), JSON.stringify(summary, null, 2));

            console.log(`Migrated: ${data.title} -> ${folderName}`);

            // 7. Cleanup (Archive or delete)
            // For safety, I'll move them to an 'archive' folder
            const archiveDir = path.join(STORIES_DIR, 'archive');
            if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir);
            
            fs.renameSync(jsonPath, path.join(archiveDir, jsonFile));
            if (fs.existsSync(mdPath)) {
                fs.renameSync(mdPath, path.join(archiveDir, mdFile));
            }

        } catch (err) {
            console.error(`Failed to migrate ${jsonFile}:`, err.message);
        }
    });

    console.log('Migration complete.');
}

if (require.main === module) {
    migrate();
}

module.exports = migrate;
