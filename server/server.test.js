const request = require('supertest');
const app = require('./index');
const fs = require('fs');
const path = require('path');

describe('Middleware Server Endpoints', () => {
  test('POST /api/save-novel should append content to novel.md', async () => {
    const testContent = "Test third-person entry";
    const novelPath = path.join(__dirname, '..', 'novel.md');
    
    // Save original content for restoration
    const originalContent = fs.readFileSync(novelPath, 'utf8');

    const response = await request(app)
      .post('/api/save-novel')
      .send({ content: testContent });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Successfully saved to novel.md');

    const updatedContent = fs.readFileSync(novelPath, 'utf8');
    expect(updatedContent).toContain(testContent);

    // Restore original content
    fs.writeFileSync(novelPath, originalContent);
  });
});
