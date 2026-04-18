// Global exports for inline HTML handlers
window.app = window.app || {};

import * as api from './api.js';
import * as ui from './ui.js';
import * as story from './story.js';
import { initWebSocket } from './websocket.js';
import * as music from './music.js';
import { settings, updateSetting, loadSettingsToUI } from './settings.js';
import { UI } from './ui_builder.js';
import './daw.js';

Object.assign(window.app, {
    toggleLibrary: ui.toggleLibrary,
    closeLibrary: ui.closeLibrary,
    toggleDebug: ui.toggleDebug,
    switchTab: (tab) => {
        ui.switchTab(tab);
        if (tab === 'novel') story.renderStory();
        if (tab === 'context') story.renderStoryContext();
        if (tab === 'music') {
            import('./story.js').then(s => {
                UI.inject('daw-mount', 'daw', { music: s.currentStory?.music });
            });
        }
        
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
    saveStoryContext: story.saveStoryContext,
    generateStoryContext: story.generateStoryContext,
    selectStory: story.selectStory,
    deleteStory: story.deleteStory,
    handleAction: story.handleAction,
    editProfile: ui.editProfile,
    togglePresence: ui.togglePresence,
    togglePresenceModal: ui.togglePresenceModal,
    closeModal: ui.closeModal,
    handleModalOk: ui.handleModalOk,
    toggleModelDropdown: ui.toggleModelDropdown,
    toggleChapterDropdown: ui.toggleChapterDropdown,
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
    },
    // Music Engine methods
    toggleMusic: music.toggleMusic,
    regenerateMusic: () => {
        if (story.currentStory) {
            const mood = story.currentStory.currentMood || 'default';
            // We'll use the last summary as prompt context
            const summaryText = story.currentStory.summary?.plotPoints?.join(' ') || 'A new adventure begins.';
            music.generateNewMusic(story.currentStory.id, mood, summaryText);
        }
    },
    switchMusicSubTab: ui.switchMusicSubTab,
    saveMusicEditor: ui.saveMusicEditor,
    updateSetting: updateSetting
});

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
        
        const llamaModels = models
            .filter(m => m.name.toLowerCase().includes('llama'))
            .sort((a, b) => b.name.localeCompare(a.name));

        let defaultModel = null;

        if (llamaModels.length > 0) {
            defaultModel = llamaModels[0].name;
        } else if (models.length > 0) {
            defaultModel = models[0].name;
        }

        if (defaultModel) {
            story.setSelectedModel(defaultModel);
        }

        ui.populateModelDropdown(models, defaultModel, (val) => {
            story.setSelectedModel(val);
        });

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
    loadSettingsToUI();
    
    // Initialize Visualizer
    const visualizerCanvas = document.getElementById('music-visualizer');
    if (visualizerCanvas) {
        import('./visualizer.js').then(v => {
            v.initVisualizer(visualizerCanvas, music.analyser);
        });
    }
    
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab') || 'interactive';

    // Apply initial tab
    ui.switchTab(initialTab);

    // Start initialization process
    initApp();

    // Browser Auto-play workaround: Resume AudioContext on first interaction
    const resumeAudio = () => {
        if (settings.musicEnabled && !music.isStarted) {
            music.startEngine();
        }
        document.removeEventListener('click', resumeAudio);
        document.removeEventListener('keydown', resumeAudio);
    };
    document.addEventListener('click', resumeAudio);
    document.addEventListener('keydown', resumeAudio);
});
