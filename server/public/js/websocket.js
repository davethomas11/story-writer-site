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
            // Sync current username with socket session
            updateUsername(api.username);
        });

        socket.on('connect', () => {
            // Only update status to Connected if we aren't in the middle of a "Waking" status from app.js
            const el = document.getElementById('connection-status');
            if (el && !el.textContent.includes('Waking')) {
                ui.updateConnectionStatus('Connected', true);
            }
            
            // Check URL for active story to auto-join room
            const urlParams = new URLSearchParams(window.location.search);
            const storyId = urlParams.get('storyId');
            if (storyId) joinStoryRoom(storyId);
        });

        socket.on('disconnect', () => {
            ui.updateConnectionStatus('Offline', false);
        });

        socket.on('presence_updated', (presenceList) => {
            ui.updatePresence(presenceList);
            // Lazy load story module to avoid circular dependency issues
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
                    if (story.currentStoryHash !== data.newHash) {
                        try {
                            const response = await api.fetchStoryById(data.storyId); 
                            const updatedStory = response.story;
                            
                            story.setCurrentStory(updatedStory);
                            story.setCurrentStoryHash(response.hash); 
                            story.renderStory(); 
                            
                            // SYNC MOOD AND THEME
                            ui.applyMood(updatedStory.currentMood || 'default', updatedStory.currentTheme);
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
