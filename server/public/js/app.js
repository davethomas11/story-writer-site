import * as api from './api.js';
import * as ui from './ui.js';
import * as story from './story.js';
import { initWebSocket } from './websocket.js';

// Global exports for inline HTML handlers
window.app = {
    toggleLibrary: ui.toggleLibrary,
    closeLibrary: ui.closeLibrary,
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
    selectStory: story.selectStory,
    deleteStory: story.deleteStory,
    handleAction: story.handleAction,
    editProfile: ui.editProfile,
    togglePresence: ui.togglePresence,
    togglePresenceModal: ui.togglePresenceModal,
    switchNovelPerspective: (mode) => {
        story.setNovelPerspective(mode);
        document.getElementById('btn-1st-person').classList.toggle('perspective-active', mode === '1st');
        document.getElementById('btn-1st-person').classList.toggle('text-zinc-600', mode !== '1st');
        document.getElementById('btn-3rd-person').classList.toggle('perspective-active', mode === '3rd');
        document.getElementById('btn-3rd-person').classList.toggle('text-zinc-600', mode !== '3rd');
        story.renderStory();
    }
};

// Initialize WebSocket connection
initWebSocket();

document.addEventListener('DOMContentLoaded', async () => {
    // Initial UI state
    ui.applyMood('default');
    api.setUsername(api.username); // Set initial button text
    
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const initialStoryId = urlParams.get('storyId');
    const initialTab = urlParams.get('tab') || 'interactive';

    // Apply initial tab
    ui.switchTab(initialTab);

    // Load Models
    try {
        const data = await api.fetchModels();
        const models = data.models || [];
        const select = document.getElementById('model-select');
        
        select.innerHTML = '';

        // Filter for Llama models and sort them by name (descending, assuming newest comes last alphabetically)
        const llamaModels = models
            .filter(m => m.name.toLowerCase().includes('llama'))
            .sort((a, b) => b.name.localeCompare(a.name)); // Sort descending

        let defaultModel = null;

        if (llamaModels.length > 0) {
            defaultModel = llamaModels[0].name; // Default to the newest Llama model
        } else if (models.length > 0) {
            defaultModel = models[0].name; // Fallback to the first model if no Llama models are found
        }

        models.forEach((m, i) => {
            const opt = document.createElement('option');
            opt.value = m.name; opt.textContent = m.name;
            select.appendChild(opt);
            if (m.name === defaultModel) {
                opt.selected = true; // Mark the default model as selected
            }
        });

        if (defaultModel) {
            story.setSelectedModel(defaultModel);
        }

        select.addEventListener('change', (e) => story.setSelectedModel(e.target.value));
        ui.updateConnectionStatus('Ready', true);
    } catch (err) {
        ui.updateConnectionStatus('Offline', false);
    }

    // Load Stories
    await story.loadLibrary();

    // Auto-select story if present in URL
    if (initialStoryId) {
        story.selectStory(initialStoryId);
    }
});
