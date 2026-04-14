const fs = require('fs');
const path = require('path');
const { getStoryDir, getStoryConfig, getChapterData, saveChapterData } = require('./chapter');

jest.mock('fs');

describe('Chapter Module', () => {
    const mockStoriesDir = path.join(__dirname, 'stories');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('getStoryDir should find a directory ending with storyId', () => {
        fs.readdirSync.mockReturnValue(['some-story-123', 'other-456']);
        fs.statSync.mockReturnValue({ isDirectory: () => true });

        const dir = getStoryDir('123');
        expect(dir).toContain('some-story-123');
    });

    test('getStoryConfig should read and parse config.json', () => {
        fs.readdirSync.mockReturnValue(['some-story-123']);
        fs.statSync.mockReturnValue({ isDirectory: () => true });
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(JSON.stringify({ title: 'Test Story' }));

        const config = getStoryConfig('123');
        expect(config.title).toBe('Test Story');
    });

    test('getChapterData should read chapter files', () => {
        fs.readdirSync.mockReturnValue(['some-story-123']);
        fs.statSync.mockReturnValue({ isDirectory: () => true });
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockImplementation((filePath) => {
            if (filePath.endsWith('interactive.md')) return 'Interactive Content';
            if (filePath.endsWith('novel.md')) return 'Novel Content';
            if (filePath.endsWith('messages.json')) return JSON.stringify([{ role: 'user', content: 'hi' }]);
            if (filePath.endsWith('summary.json')) return JSON.stringify({ characters: [] });
            return '';
        });

        const data = getChapterData('123', 'chapter-1');
        expect(data.interactive).toBe('Interactive Content');
        expect(data.novel).toBe('Novel Content');
        expect(data.messages[0].content).toBe('hi');
    });

    test('saveChapterData should write chapter files', () => {
        fs.readdirSync.mockReturnValue(['some-story-123']);
        fs.statSync.mockReturnValue({ isDirectory: () => true });
        fs.existsSync.mockReturnValue(true);

        saveChapterData('123', 'chapter-1', {
            interactive: 'New Interactive',
            messages: [{ role: 'assistant', content: 'hello' }]
        });

        expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('interactive.md'), 'New Interactive');
        expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('messages.json'), expect.stringContaining('hello'));
    });
});
