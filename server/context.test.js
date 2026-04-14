const { buildPrompt } = require('./context');
const chapter = require('./chapter');

jest.mock('./chapter');

describe('Context Module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('buildPrompt should combine system prompt, context, and sliding window', () => {
        chapter.getStoryConfig.mockReturnValue({ summary: 'Global Plot' });
        chapter.getChapterData.mockReturnValue({
            summary: { plotPoints: ['Point A'], characters: ['Alice'], locations: ['Basement'] },
            messages: Array(20).fill({ role: 'user', content: 'hello' })
        });

        const prompt = buildPrompt('123', 'chapter-1');
        
        expect(prompt[0].role).toBe('system'); // Global system
        expect(prompt[1].content).toContain('Global Plot'); // Context
        expect(prompt.length).toBe(12); // system + context + 10 recent
        expect(prompt[prompt.length - 1].content).toBe('hello');
    });
});
