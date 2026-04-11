const fs = require('fs');
const path = require('path');

const storiesDir = path.join(__dirname, 'stories');

console.log('Starting story migration...');

// Migrates stories from all JSON format to new multiple file format

fs.readdir(storiesDir, (err, files) => {
    if (err) {
        console.error('Error reading stories directory:', err);
        return;
    }

    files.filter(file => file.endsWith('.json')).forEach(file => {
        const filePath = path.join(storiesDir, file);
        const storyId = file.replace('.json', '');
        const mdFilePath = path.join(storiesDir, `${storyId}.md`);

        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading file ${filePath}:`, err);
                return;
            }

            try {
                const storyData = JSON.parse(data);
                
                // Check if novel data exists and needs migration
                if (storyData.novel) {
                    console.log(`Migrating story: ${storyData.title || storyId}`);
                    
                    // Write Markdown file
                    fs.writeFile(mdFilePath, storyData.novel, 'utf8', (err) => {
                        if (err) {
                            console.error(`Error writing markdown for ${storyId}:`, err);
                        }
                    });

                    // Remove novel from JSON data
                    delete storyData.novel;

                    // Save updated JSON file
                    fs.writeFile(filePath, JSON.stringify(storyData, null, 2), 'utf8', (err) => {
                        if (err) {
                            console.error(`Error writing updated JSON for ${storyId}:`, err);
                        } else {
                            console.log(`Successfully migrated: ${storyId}`);
                        }
                    });
                } else {
                    console.log(`Story ${storyId} already migrated or has no novel text.`);
                }

            } catch (parseErr) {
                console.error(`Error parsing JSON for ${filePath}:`, parseErr);
            }
        });
    });
});
