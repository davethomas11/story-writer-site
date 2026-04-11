import * as api from './api.js';
import * as ui from './ui.js';
import * as story from './story.js';

// Global exports for inline HTML handlers
window.app = {
    toggleLibrary: ui.toggleLibrary,
    closeLibrary: ui.closeLibrary,
    switchTab: (tab) => {
        ui.switchTab(tab);
        if (tab === 'novel') story.renderStory();
    },
    createNewStory: story.createNewStory,
    selectStory: story.selectStory,
    deleteStory: story.deleteStory,
    handleAction: story.handleAction,
    switchNovelPerspective: (mode) => {
        story.setNovelPerspective(mode);
        document.getElementById('btn-1st-person').classList.toggle('perspective-active', mode === '1st');
        document.getElementById('btn-1st-person').classList.toggle('text-zinc-600', mode !== '1st');
        document.getElementById('btn-3rd-person').classList.toggle('perspective-active', mode === '3rd');
        document.getElementById('btn-3rd-person').classList.toggle('text-zinc-600', mode !== '3rd');
        story.renderStory();
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    // Initial UI state
    ui.applyMood('default');
    
    // Load Models
    try {
        const data = await api.fetchModels();
        const models = data.models || [];
        const select = document.getElementById('model-select');
        
        select.innerHTML = '';
        models.forEach((m, i) => {
            const opt = document.createElement('option');
            opt.value = m.name; opt.textContent = m.name;
            select.appendChild(opt);
            if (i === 0) story.setSelectedModel(m.name);
        });

        select.addEventListener('change', (e) => story.setSelectedModel(e.target.value));
        ui.updateConnectionStatus('Ready', true);
    } catch (err) {
        ui.updateConnectionStatus('Offline', false);
    }

    // Load Stories
    story.loadLibrary();
});
