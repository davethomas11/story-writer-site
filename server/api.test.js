const request = require('supertest');
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Mock axios
jest.mock('axios');

// We need a way to get the app without starting the server, 
// but server/index.js exports the server.
// Let's see if we can just require the router and test it in isolation if possible,
// or use the exported server (Supertest can handle it).
// Set NODE_ENV to test to avoid server starting on require
process.env.NODE_ENV = 'test';

const server = require('./index');

describe('API Endpoints', () => {
  beforeAll((done) => {
    if (!server.listening) {
        server.listen(0, done);
    } else {
        done();
    }
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('GET /api/ping', () => {
    test('should return status ok', async () => {
      const response = await request(server).get('/api/ping');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/stats', () => {
    test('should return statistics', async () => {
      const response = await request(server).get('/api/stats');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('stories');
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('totalTurns');
      expect(response.body).toHaveProperty('totalMessages');
      expect(response.body).toHaveProperty('totalNovelChars');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('GET /api/health', () => {
    test('should return health ok when Ollama is available', async () => {
      axios.get.mockResolvedValue({ data: { models: [{ name: 'llama3' }] } });
      
      const response = await request(server).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body.server).toBe('ok');
      expect(response.body.ollama).toBe('ok');
      expect(response.body.models).toBe(1);
    });

    test('should return 503 when Ollama is unavailable', async () => {
      axios.get.mockRejectedValue(new Error('Connection refused'));
      
      const response = await request(server).get('/api/health');
      expect(response.status).toBe(503);
      expect(response.body.ollama).toBe('unavailable');
    });
  });

  describe('GET /api/models', () => {
    test('should return models from Ollama', async () => {
      const mockModels = { models: [{ name: 'llama3' }, { name: 'mistral' }] };
      axios.get.mockResolvedValue({ data: mockModels });
      
      const response = await request(server).get('/api/models');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockModels);
    });

    test('should return 500 when Ollama fails', async () => {
      axios.get.mockRejectedValue(new Error('Ollama error'));
      
      const response = await request(server).get('/api/models');
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch models from Ollama');
    });
  });

  describe('User Profiles', () => {
    const testUserId = 'test-user-123';
    const userPath = path.join(__dirname, 'users', `${testUserId}.json`);

    afterEach(() => {
      if (fs.existsSync(userPath)) {
        fs.unlinkSync(userPath);
      }
    });

    test('POST /api/profile should create a new profile', async () => {
      const profileData = { userId: testUserId, username: 'TestExplorer' };
      const response = await request(server)
        .post('/api/profile')
        .send(profileData);
      
      expect(response.status).toBe(200);
      expect(response.body.userId).toBe(testUserId);
      expect(response.body.username).toBe('TestExplorer');
      expect(fs.existsSync(userPath)).toBe(true);
    });

    test('GET /api/profile/:userId should return profile if exists', async () => {
      const profileData = { userId: testUserId, username: 'ExistingUser' };
      fs.writeFileSync(userPath, JSON.stringify(profileData));

      const response = await request(server).get(`/api/profile/${testUserId}`);
      expect(response.status).toBe(200);
      expect(response.body.username).toBe('ExistingUser');
    });

    test('GET /api/profile/:userId should return default if not exists', async () => {
      const response = await request(server).get('/api/profile/non-existent');
      expect(response.status).toBe(200);
      expect(response.body.username).toContain('Explorer');
    });
  });

  describe('Story Management', () => {
    let createdStoryId;
    const STORIES_DIR = path.join(__dirname, 'stories');

    afterAll(() => {
      if (createdStoryId) {
        const jsonPath = path.join(STORIES_DIR, `${createdStoryId}.json`);
        const mdPath = path.join(STORIES_DIR, `${createdStoryId}.md`);
        if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
        if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);
      }
    });

    test('POST /api/stories should create a new story', async () => {
      const response = await request(server)
        .post('/api/stories')
        .send({ title: 'Test Adventure' });
      
      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Test Adventure');
      expect(response.body).toHaveProperty('id');
      createdStoryId = response.body.id;
    });

    test('GET /api/stories should list stories', async () => {
      const response = await request(server).get('/api/stories');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some(s => s.id === createdStoryId)).toBe(true);
    });

    test('GET /api/stories/:id should return story details', async () => {
      const response = await request(server).get(`/api/stories/${createdStoryId}`);
      expect(response.status).toBe(200);
      expect(response.body.story.id).toBe(createdStoryId);
      expect(response.body).toHaveProperty('hash');
    });

    test('PUT /api/stories/:id should update story', async () => {
      const updatedData = { 
        id: createdStoryId, 
        title: 'Updated Title',
        novel: 'Once upon a time...'
      };
      const response = await request(server)
        .put(`/api/stories/${createdStoryId}`)
        .send(updatedData);
      
      expect(response.status).toBe(200);
      expect(response.body.story.title).toBe('Updated Title');
      
      // Verify MD file was updated
      const mdContent = fs.readFileSync(path.join(STORIES_DIR, `${createdStoryId}.md`), 'utf8');
      expect(mdContent).toBe('Once upon a time...');
    });

    test('DELETE /api/stories/:id should remove story', async () => {
      const response = await request(server).delete(`/api/stories/${createdStoryId}`);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      expect(fs.existsSync(path.join(STORIES_DIR, `${createdStoryId}.json`))).toBe(false);
      createdStoryId = null; // Prevent afterAll from failing
    });
  });

  describe('AI Proxy Endpoints', () => {
    test('POST /api/chat should proxy to Ollama', async () => {
      const mockResponse = { message: { content: 'Hello explorer!' } };
      axios.post.mockResolvedValue({ data: mockResponse });

      const response = await request(server)
        .post('/api/chat')
        .send({ model: 'llama3', messages: [{ role: 'user', content: 'Hi' }], stream: false });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat'),
        expect.objectContaining({ model: 'llama3', stream: false })
      );
    });

    test('POST /api/generate should proxy to Ollama', async () => {
      const mockResponse = { response: 'Story content' };
      axios.post.mockResolvedValue({ data: mockResponse });

      const response = await request(server)
        .post('/api/generate')
        .send({ model: 'llama3', prompt: 'Once upon a time', stream: false });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({ model: 'llama3', prompt: 'Once upon a time' })
      );
    });

    test('POST /api/chat should return 500 when Ollama fails', async () => {
      axios.post.mockRejectedValue(new Error('Ollama connection error'));

      const response = await request(server)
        .post('/api/chat')
        .send({ model: 'llama3', messages: [] });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to communicate with Ollama Chat API');
    });
  });
});
