const { extractJSON } = require('./public/js/story_utils.js');

describe('extractJSON', () => {
  test('should parse direct JSON', () => {
    const input = '{"mood": "eerie", "theme": {"bg": "black"}}';
    expect(extractJSON(input)).toEqual({ mood: 'eerie', theme: { bg: 'black' } });
  });

  test('should parse JSON inside markdown blocks', () => {
    const input = '```json\n{"mood": "serene"}\n```';
    expect(extractJSON(input)).toEqual({ mood: 'serene' });
  });

  test('should parse JSON with preamble', () => {
    const input = 'Here is the response: {"mood": "action"}';
    expect(extractJSON(input)).toEqual({ mood: 'action' });
  });

  test('should return null for invalid JSON', () => {
    const input = 'Not a JSON at all';
    expect(extractJSON(input)).toBeNull();
  });
});
