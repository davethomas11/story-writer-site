const { sanitizeFolderName } = require('./utils');

describe('sanitizeFolderName', () => {
    test('converts title to lowercase and replaces non-alphanumeric with hyphen', () => {
        expect(sanitizeFolderName('My Epic Adventure', '123')).toBe('my-epic-adventure-123');
    });

    test('handles special characters and multiple spaces', () => {
        expect(sanitizeFolderName('Dragons & Dungeons!!! 2', 'abc')).toBe('dragons-dungeons-2-abc');
    });

    test('trims trailing hyphens', () => {
        expect(sanitizeFolderName('Adventure!!!', '456')).toBe('adventure-456');
    });

    test('defaults to id or story-id if title is empty or non-alphanumeric', () => {
        expect(sanitizeFolderName('', '789')).toBe('789');
        expect(sanitizeFolderName('!!!', 'xyz')).toBe('story-xyz');
    });

    test('handles null or undefined title', () => {
        expect(sanitizeFolderName(null, '999')).toBe('999');
        expect(sanitizeFolderName(undefined, '888')).toBe('888');
    });
});
