import * as api from './api.js';
import * as ui from './ui.js';

let socket;

/**
 * Initializes the WebSocket connection and sets up event listeners.
 */
export function initWebSocket(url = window.location.origin) {
    try {
        if (typeof io === 'undefined') return;

        const query = api.userId ? { userId: api.userId } : {};
        socket = io(url, { query });

        socket.on('session_established', (data) => {
            api.setUserId(data.userId);
            updateUsername(api.username);
        });

        socket.on('connect', () => {
            ui.updateConnectionStatus('Connected', true);
            const urlParams = new URLSearchParams(window.location.search);
            const storyId = urlParams.get('storyId');
            if (storyId) joinStoryRoom(storyId);
        });

        socket.on('disconnect', () => {
            ui.updateConnectionStatus('Offline', false);
        });

        socket.on('presence_updated', (presenceList) => {
            ui.updatePresence(presenceList);
            import('./story.js').then(story => story.setPresenceData(presenceList));
        });

        socket.on('user_typing', (data) => {
            ui.updateTypingIndicator(data.username);
        });

        socket.on('user_stop_typing', () => {
            ui.updateTypingIndicator(null);
        });

        // --- LIVE SYNC HANDLERS ---

        socket.on('remote_action_update', (data) => {
            import('./story.js').then(story => story.handleRemoteActionUpdate(data.userId, data.text));
        });

        socket.on('remote_narrative_update', (data) => {
            import('./story.js').then(story => story.handleRemoteNarrativeUpdate(data.userId, data.text, data.isFinal));
        });

        // --- STORY LIFECYCLE ---

        socket.on('story_created', (data) => {
            if (data.initiator !== api.userId) {
                import('./story.js').then(story => story.loadLibrary());
            }
        });

        socket.on('story_deleted', (data) => {
            if (data.initiator === api.userId) return;
            import('./story.js').then(story => {
                if (story.currentStory?.id === data.storyId) {
                    story.setCurrentStory(null);
                    story.setCurrentStoryHash(null);
                    document.getElementById('current-story-title').textContent = 'Select a Story';
                    document.getElementById('interactive-content').innerHTML = '<div class="text-zinc-600 italic text-center pt-24">Story deleted by another user.</div>';
                    document.getElementById('input-area').classList.add('opacity-50', 'pointer-events-none');
                    ui.applyMood('default');
                }
                story.loadLibrary();
            });
        });

        socket.on('story_updated', async (data) => {
            if (data.initiator === api.userId) return;
            import('./story.js').then(async (story) => {
                if (story.currentStory?.id === data.storyId) {
                    // Hash mismatch check is still valuable to ensure full state parity
                    if (story.currentStoryHash !== data.newHash) {
                        try {
                            const response = await api.fetchStoryById(data.storyId); 
                            story.setCurrentStory(response.story);
                            story.setCurrentStoryHash(response.hash); 
                            story.renderStory(); 
                        } catch (e) { story.loadLibrary(); }
                    }
                } else {
                    story.loadLibrary();
                }
            });
        });

    } catch (error) {
        console.error("WS Error:", error);
        ui.updateConnectionStatus('WS Error', false);
    }
}

export function joinStoryRoom(storyId) {
    if (socket && socket.connected) {
        socket.emit('join_story', { storyId });
    }
}

export function updateUsername(username) {
    if (socket && socket.connected) {
        socket.emit('update_username', { username });
    }
}

export function sendActionUpdate(storyId, text) {
    if (socket && socket.connected) {
        socket.emit('action_update', { storyId, text });
    }
}

export function sendNarrativeUpdate(storyId, text, isFinal = false) {
    if (socket && socket.connected) {
        socket.emit('narrative_update', { storyId, text, isFinal });
    }
}

export function notifyTyping(storyId) {
    if (socket && socket.connected && storyId) {
        socket.emit('typing', { storyId });
    }
}

export function notifyStopTyping(storyId) {
    if (socket && socket.connected && storyId) {
        socket.emit('stop_typing', { storyId });
    }
}
