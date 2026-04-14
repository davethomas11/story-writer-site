const http = require('http');
const ioClient = require('socket.io-client');
const initSocket = require('./socket');
const fs = require('fs');
const path = require('path');

describe('Socket.io Presence and Sync', () => {
  let httpServer;
  let io;
  let client1, client2;
  const port = 4000;

  beforeAll((done) => {
    httpServer = http.createServer();
    io = initSocket(httpServer);
    httpServer.listen(port, done);
  });

  afterAll((done) => {
    io.close();
    httpServer.close(done);
  });

  beforeEach((done) => {
    client1 = ioClient(`http://localhost:${port}`, { query: { userId: 'user-1' } });
    client2 = ioClient(`http://localhost:${port}`, { query: { userId: 'user-2' } });
    
    let connectedCount = 0;
    const checkConnected = () => {
      connectedCount++;
      if (connectedCount === 2) done();
    };
    
    client1.on('connect', checkConnected);
    client2.on('connect', checkConnected);
  });

  afterEach(() => {
    client1.disconnect();
    client2.disconnect();
  });

  test('should establish session with userId', (done) => {
    // Session is established upon connection, but client1 might have connected 
    // before the listener was attached in the test.
    // Let's use a fresh client for this specific test.
    const tempClient = ioClient(`http://localhost:${port}`, { query: { userId: 'temp-user' } });
    tempClient.on('session_established', (data) => {
      expect(data.userId).toBe('temp-user');
      tempClient.disconnect();
      done();
    });
  });

  test('should broadcast presence when a user updates username', (done) => {
    client2.on('presence_updated', (presenceList) => {
      const user1 = presenceList.find(u => u.userId === 'user-1');
      if (user1 && user1.username === 'NewName') {
        expect(user1.username).toBe('NewName');
        done();
      }
    });

    client1.emit('update_username', { username: 'NewName' });
  });

  test('should sync typing indicator to others in the same story', (done) => {
    const storyId = 'test-story';
    
    client1.emit('join_story', { storyId });
    client2.emit('join_story', { storyId });

    client2.on('user_typing', (data) => {
      expect(data.userId).toBe('user-1');
      done();
    });

    // Need to wait a bit for rooms to be joined
    setTimeout(() => {
      client1.emit('typing', { storyId });
    }, 100);
  });

  test('should not sync typing indicator to others in different stories', (done) => {
    client1.emit('join_story', { storyId: 'story-1' });
    client2.emit('join_story', { storyId: 'story-2' });

    const typingSpy = jest.fn();
    client2.on('user_typing', typingSpy);

    setTimeout(() => {
      client1.emit('typing', { storyId: 'story-1' });
      setTimeout(() => {
        expect(typingSpy).not.toHaveBeenCalled();
        done();
      }, 200);
    }, 100);
  });

  test('should sync narrative updates', (done) => {
    const storyId = 'test-story';
    client1.emit('join_story', { storyId });
    client2.emit('join_story', { storyId });

    client2.on('remote_narrative_update', (data) => {
      expect(data.userId).toBe('user-1');
      expect(data.text).toBe('Streaming content...');
      done();
    });

    setTimeout(() => {
      client1.emit('narrative_update', { storyId, text: 'Streaming content...', isFinal: false });
    }, 100);
  });
});
