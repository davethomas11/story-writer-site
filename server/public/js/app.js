import * as api from './api.js';
import * as ui from './ui.js';
import * as story from './story.js';
import { initWebSocket } from './websocket.js';

// Global exports for inline HTML handlers
window.app = {
    toggleLibrary: ui.toggleLibrary,
    closeLibrary: ui.closeLibrary,
    toggleDebug: ui.toggleDebug,
    switchTab: (tab) => {
        ui.switchTab(tab);
        if (tab === 'novel') story.renderStory();
        
        // Update URL state
        const url = new URL(window.location);
        url.searchParams.set('tab', tab);
        window.history.pushState({}, '', url);
    },
    createNewStory: story.createNewStory,
    renameStory: story.renameStory,
    switchChapter: story.switchChapter,
    renameChapter: story.renameChapter,
    createNewChapter: story.createNewChapter,
    recomposeChapter: story.recomposeChapter,
    selectStory: story.selectStory,
    deleteStory: story.deleteStory,
    handleAction: story.handleAction,
    editProfile: ui.editProfile,
    togglePresence: ui.togglePresence,
    togglePresenceModal: ui.togglePresenceModal,
    showStats: async () => {
        try {
            const stats = await api.fetchStats();
            ui.showStats(stats);
        } catch (err) {
            console.error("Failed to load stats", err);
            alert("Failed to load statistics from the server.");
        }
    },
    toggleStatsModal: ui.toggleStatsModal,
    switchNovelPerspective: (mode) => {
        story.setNovelPerspective(mode);
        document.getElementById('btn-1st-person').classList.toggle('perspective-active', mode === '1st');
        document.getElementById('btn-1st-person').classList.toggle('text-zinc-400', mode !== '1st');
        document.getElementById('btn-3rd-person').classList.toggle('perspective-active', mode === '3rd');
        document.getElementById('btn-3rd-person').classList.toggle('text-zinc-400', mode !== '3rd');
        story.renderStory();
    }
};

// Initialize WebSocket connection
initWebSocket();

async function initApp() {
    ui.updateConnectionStatus('Checking AI...', false);

    let health = null;
    let attempts = 0;
    const maxAttempts = 15; // ~30 seconds total

    while (attempts < maxAttempts) {
        try {
            health = await api.checkHealth();
            if (health.server === 'ok' && health.ollama === 'ok') break;
            ui.updateConnectionStatus(`Waking AI (${attempts + 1}/${maxAttempts})...`, false);
        } catch (e) {
            ui.updateConnectionStatus(`Connecting (${attempts + 1}/${maxAttempts})...`, false);
        }
        attempts++;
        await new Promise(r => setTimeout(r, 2000));
    }

    if (!health || health.ollama !== 'ok') {
        ui.updateConnectionStatus('AI Core Offline', false);
        // We still load stories if possible, as user might want to read old ones
    }

    // Load Models
    try {
        const data = await api.fetchModels();
        const models = data.models || [];
        const select = document.getElementById('model-select');
        
        select.innerHTML = '';

        const llamaModels = models
            .filter(m => m.name.toLowerCase().includes('llama'))
            .sort((a, b) => b.name.localeCompare(a.name));

        let defaultModel = null;

        if (llamaModels.length > 0) {
            defaultModel = llamaModels[0].name;
        } else if (models.length > 0) {
            defaultModel = models[0].name;
        }

        models.forEach((m, i) => {
            const opt = document.createElement('option');
            opt.value = m.name; opt.textContent = m.name;
            select.appendChild(opt);
            if (m.name === defaultModel) {
                opt.selected = true;
            }
        });

        if (defaultModel) {
            story.setSelectedModel(defaultModel);
        }

        select.addEventListener('change', (e) => story.setSelectedModel(e.target.value));
        if (health && health.ollama === 'ok') {
            ui.updateConnectionStatus('Ready', true);
        }
    } catch (err) {
        console.error("Failed to load models", err);
    }

    // Load Stories
    try {
        await story.loadLibrary();
    } catch (err) {
        console.error("Failed to load library", err);
    }

    // Auto-select story if present in URL
    const urlParams = new URLSearchParams(window.location.search);
    const initialStoryId = urlParams.get('storyId');
    if (initialStoryId) {
        story.selectStory(initialStoryId);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initial UI state
    ui.applyMood('default');
    api.setUsername(api.username); // Set initial button text
    
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab') || 'interactive';

    // Apply initial tab
    ui.switchTab(initialTab);

    // Start initialization process
    initApp();
});
