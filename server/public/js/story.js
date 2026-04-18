import * as api from './api.js';
import * as ui from './ui.js';
import { joinStoryRoom, notifyTyping, notifyStopTyping, sendActionUpdate, sendNarrativeUpdate } from './websocket.js';
import * as music from './music.js';
import { settings } from './settings.js';

export let currentStory = null;
export let currentStoryHash = null;
export let selectedModel = '';
export let novelPerspective = '3rd';
export let presenceData = [];
export const allStories = new Map(); // id -> { title, createdAt }

let typingTimeout = null;
const remoteTurnElements = new Map(); // userId -> { container, actionEl, responseEl }

export function setSelectedModel(val) { selectedModel = val; }
export function setNovelPerspective(val) { novelPerspective = val; }
export function setCurrentStory(val) { currentStory = val; }
export function setCurrentStoryHash(val) { currentStoryHash = val; }
export function setPresenceData(val) { 
    presenceData = val; 
    loadLibrary(); 
}

const { extractJSON } = window;

// Typing Notification Logic
function handleUserTyping(e) {
    if (!currentStory) return;
    
    // Notify server we are typing
    notifyTyping(currentStory.id);
    sendActionUpdate(currentStory.id, e.target.value);
    
    // Clear existing timeout
    if (typingTimeout) clearTimeout(typingTimeout);
    
    // Set timeout to stop typing after 3 seconds of inactivity
    typingTimeout = setTimeout(() => {
        if (currentStory) notifyStopTyping(currentStory.id);
        typingTimeout = null;
    }, 3000);
}

// --- REMOTE SYNC HANDLERS ---

export function handleRemoteActionUpdate(userId, text) {
    let elements = remoteTurnElements.get(userId);
    
    if (!elements) {
        const turnDiv = document.createElement('div');
        turnDiv.className = 'fade-in space-y-4 pt-8 border-t border-zinc-900/50 italic opacity-70';
        
        const actionEl = document.createElement('div');
        actionEl.className = 'text-[10px] uppercase tracking-widest text-zinc-500 mb-2';
        
        const responseEl = document.createElement('div');
        responseEl.className = 'text-zinc-400 font-light leading-relaxed space-y-4';
        
        turnDiv.appendChild(actionEl);
        turnDiv.appendChild(responseEl);
        document.getElementById('interactive-content').appendChild(turnDiv);
        
        elements = { container: turnDiv, actionEl, responseEl };
        remoteTurnElements.set(userId, elements);
    }

    elements.actionEl.textContent = text ? `> ${text}` : '> ...';
    const container = document.getElementById('interactive-content');
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
}

export function handleRemoteNarrativeUpdate(userId, text, isFinal) {
    const elements = remoteTurnElements.get(userId);
    if (!elements) return;

    // Strip JSON metadata if it leaks into the stream
    let displayable = text;
    if (displayable.includes('###')) {
        displayable = displayable.split('###')[0].trim();
    }

    elements.responseEl.innerHTML = displayable.split('\n\n').map(p => `<p>${p}</p>`).join('');
    
    if (isFinal) {
        elements.container.classList.remove('italic', 'opacity-70');
        remoteTurnElements.delete(userId);
    }

    const container = document.getElementById('interactive-content');
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
}

export async function loadLibrary() {
    const list = document.getElementById('story-list');
    try {
        const stories = await api.fetchStories();
        list.innerHTML = '';
        allStories.clear(); // Refresh local cache

        stories.forEach(s => {
            allStories.set(s.id, s); // Cache for other components

            const readers = presenceData.filter(u => u.storyId === s.id);
            const readerNames = readers.map(r => r.username).join(', ');

            const div = document.createElement('div');
            div.className = `group flex justify-between items-center p-3 rounded cursor-pointer transition-colors ${currentStory?.id === s.id ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-900/50'}`;
            div.innerHTML = `
                <div class="flex-1 truncate pr-2" onclick="app.selectStory('${s.id}')">
                    <div class="flex items-center gap-2">
                        <div class="text-xs truncate font-medium">${s.title}</div>
                        ${readers.length > 0 ? `<div class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Active Readers: ${readerNames}"></div>` : ''}
                    </div>
                    <div class="flex justify-between items-center mt-1">
                        <div class="text-[9px] text-zinc-500 uppercase tracking-tighter">${new Date(s.createdAt).toLocaleDateString()}</div>
                        ${readers.length > 0 ? `<div class="text-[8px] text-emerald-600/70 font-semibold uppercase tracking-widest">${readers.length} Online</div>` : ''}
                    </div>
                </div>
                <button onclick="app.deleteStory('${s.id}', event)" class="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-900 transition-opacity">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            `;
            list.appendChild(div);
        });
    } catch (err) { console.error('Library error:', err); }
}

export async function createNewStory() {
    ui.showModal({
        title: "New Adventure",
        message: "Enter a title for your adventure:",
        inputValue: "A New Beginning",
        showInput: true,
        showCancel: true
    }).then(async (title) => {
        if (!title) return;
        try {
            ui.showLoading("Creating world...");
            const story = await api.createStory(title);
            await selectStory(story.id);
            loadLibrary();
            if (window.innerWidth < 768) ui.toggleLibrary();
        } catch (err) { 
            ui.showModal({ title: "Error", message: "Failed to create story" });
        } finally {
            ui.hideLoading();
        }
    });
}

export async function renameStory() {
    if (!currentStory) return;
    
    ui.showModal({
        title: "Rename Adventure",
        message: "Enter a new title for this adventure:",
        inputValue: currentStory.title,
        showInput: true,
        showCancel: true
    }).then(async (newTitle) => {
        if (!newTitle || newTitle === currentStory.title) return;

        try {
            currentStory.title = newTitle;
            const response = await api.updateStory(currentStory.id, currentStory);
            if (response?.hash) setCurrentStoryHash(response.hash);
            
            document.getElementById('current-story-title').textContent = currentStory.title;
            loadLibrary();
        } catch (err) {
            ui.showModal({ title: "Error", message: "Failed to rename story" });
        }
    });
}

export async function selectStory(id) {
    try {
        const response = await api.fetchStoryById(id);
        currentStory = response.story;
        currentStoryHash = response.hash;
        
        document.getElementById('current-story-title').textContent = currentStory.title;
        document.getElementById('input-area').classList.remove('opacity-50', 'pointer-events-none');
        
        // Show rename button
        const renameBtn = document.getElementById('btn-rename-story');
        if (renameBtn) renameBtn.classList.remove('hidden');

        const input = document.getElementById('user-action');
        input.removeEventListener('input', handleUserTyping);
        input.addEventListener('input', handleUserTyping);
        
        // Add novel editor listener
        const nBody = document.getElementById('novel-body');
        nBody.removeEventListener('input', handleNovelInput);
        nBody.addEventListener('input', handleNovelInput);
        
        nBody.removeEventListener('blur', saveNovel);
        nBody.addEventListener('blur', saveNovel);
        
        if (!currentStory.messages) currentStory.messages = [];
        
        ui.updateChapterSelection(currentStory);
        ui.applyMood(currentStory.currentMood || 'default', currentStory.currentTheme);
        renderStory();
        loadLibrary();

        // Update URL state
        const url = new URL(window.location);
        url.searchParams.set('storyId', id);
        window.history.pushState({}, '', url);

        // Join the WebSocket room for this story
        joinStoryRoom(id);

        // Load Story Context
        loadStoryContext(id);

        // Music Engine Integration
        if (currentStory.music) {
            music.playScore(currentStory.music);
            ui.renderMusicEditor(currentStory.music);
            if (settings.musicEnabled && music.isStarted) {
                // Already started, playScore will handle it
            }
        }
    } catch (err) { 
        console.error("Failed to load story:", err);
        ui.showModal({ title: "Error", message: "Failed to load story" });
    }
}

// --- STORY CONTEXT MANAGEMENT ---

let currentContext = null;

export async function loadStoryContext(storyId) {
    try {
        const response = await api.fetchStoryContext(storyId);
        currentContext = response.context;
        renderStoryContext();
    } catch (err) {
        console.error("Failed to load story context", err);
    }
}

export function renderStoryContext() {
    if (!currentContext) return;
    
    document.getElementById('ctx-characters').value = currentContext.characters || '';
    document.getElementById('ctx-locations').value = currentContext.locations || '';
    document.getElementById('ctx-plot').value = currentContext.plot || '';
    document.getElementById('ctx-lore').value = currentContext.lore || '';
}

export async function saveStoryContext() {
    if (!currentStory) return;
    
    const context = {
        characters: document.getElementById('ctx-characters').value,
        locations: document.getElementById('ctx-locations').value,
        plot: document.getElementById('ctx-plot').value,
        lore: document.getElementById('ctx-lore').value
    };

    try {
        ui.updateStatus('Saving context...');
        await api.saveStoryContext(currentStory.id, context);
        currentContext = context;
        ui.updateStatus('Context saved.');
        setTimeout(() => ui.updateStatus(''), 2000);
    } catch (err) {
        ui.showModal({ title: "Error", message: "Failed to save story context" });
    }
}

export async function generateStoryContext(category = null) {
    if (!currentStory || !selectedModel) return;

    const title = category ? `Regenerate ${category.charAt(0).toUpperCase() + category.slice(1)}` : "Generate Story Bible";
    const msg = category 
        ? `Ask the AI to analyze the story and update the ${category} section? This will overwrite your current unsaved changes in this field.`
        : "Ask the AI to analyze the entire story so far and fill out all context fields? This will overwrite your current unsaved changes in the context editor.";

    ui.showModal({
        title,
        message: msg,
        showCancel: true
    }).then(async (confirmed) => {
        if (!confirmed) return;

        try {
            ui.showLoading(category ? `Analyzing ${category}...` : "Analyzing story history...");
            const response = await api.generateStoryContext(currentStory.id, selectedModel, category);
            
            if (category) {
                currentContext[category] = response.context[category];
            } else {
                currentContext = response.context;
            }
            
            renderStoryContext();
            ui.updateStatus(category ? `${category} updated.` : 'Context generated.');
            setTimeout(() => ui.updateStatus(''), 2000);
        } catch (err) {
            console.error(err);
            ui.showModal({ title: "Error", message: `Failed to generate ${category || 'context'}` });
        } finally {
            ui.hideLoading();
        }
    });
}

export async function switchChapter(chapterName) {
    if (!currentStory) return;
    try {
        ui.updateStatus('Switching chapter...');
        await api.switchChapter(currentStory.id, chapterName);
        await selectStory(currentStory.id);
        ui.updateStatus('');
    } catch (err) {
        ui.showModal({ title: "Error", message: "Failed to switch chapter" });
    }
}

export async function renameChapter() {
    if (!currentStory || !currentStory.currentChapter) return;

    const currentName = currentStory.currentChapter.replace('chapter-', '');
    
    ui.showModal({
        title: "Rename Chapter",
        message: "Enter a new name for this chapter:",
        inputValue: currentName,
        showInput: true,
        showCancel: true
    }).then(async (newName) => {
        if (!newName || newName === currentName) return;

        try {
            ui.updateStatus('Renaming chapter...');
            const newChapterId = `chapter-${newName.trim().toLowerCase().replace(/\s+/g, '-')}`;
            await api.renameChapter(currentStory.id, currentStory.currentChapter, newChapterId);

            await selectStory(currentStory.id);
            ui.updateStatus('');
        } catch (err) {
            console.error(err);
            ui.showModal({ title: "Error", message: err.message || "Failed to rename chapter" });
        }
    });
}

export async function createNewChapter() {
    if (!currentStory) return;
    
    ui.showModal({
        title: "New Chapter",
        message: "Start a new chapter? This will clear the immediate AI memory but keep the overall story context.",
        showCancel: true
    }).then(async (confirmed) => {
        if (!confirmed) return;
        try {
            ui.showLoading("Drafting new chapter...");
            ui.updateStatus('Creating new chapter...');
            await api.createChapter(currentStory.id);
            await selectStory(currentStory.id);
            ui.updateStatus('');
        } catch (err) {
            ui.showModal({ title: "Error", message: "Failed to create chapter" });
        } finally {
            ui.hideLoading();
        }
    });
}

export async function recomposeChapter() {
    if (!currentStory || !selectedModel) return;
    
    // Determine which perspective we are recomposing based on current view
    const isInteractiveView = !document.getElementById('view-interactive').classList.contains('hidden');
    const perspective = isInteractiveView ? '1st' : novelPerspective;

    ui.showModal({
        title: "Recompose Narrative",
        message: `Ask the AI to rewrite the current chapter as a seamless ${perspective === '1st' ? 'FIRST-PERSON' : 'THIRD-PERSON'} narrative? This will replace the current ${perspective === '1st' ? 'interactive' : 'novel'} content for this chapter.`,
        showCancel: true
    }).then(async (confirmed) => {
        if (!confirmed) return;

        try {
            ui.showLoading(`Recomposing ${perspective === '1st' ? 'Interactive' : 'Novel'}...`);
            ui.updateStatus('Recomposing chapter...');
            const data = await api.recomposeChapter(currentStory.id, selectedModel, perspective);
            if (data.success) {
                await selectStory(currentStory.id);
            }
            ui.updateStatus('');
        } catch (err) {
            console.error(err);
            ui.showModal({ title: "Error", message: "Failed to recompose chapter" });
        } finally {
            ui.hideLoading();
        }
    });
}

export async function deleteStory(id, e) {
    if (e) e.stopPropagation();
    
    ui.showModal({
        title: "Delete Adventure",
        message: "Are you sure you want to delete this adventure? This cannot be easily undone.",
        showCancel: true
    }).then(async (confirmed) => {
        if (!confirmed) return;
        try {
            await api.deleteStory(id);
            if (currentStory?.id === id) {
                currentStory = null;
                document.getElementById('current-story-title').textContent = 'Select a Story';
                document.getElementById('interactive-content').innerHTML = `<div class="text-zinc-500 italic text-center pt-24 flex flex-col items-center gap-4">
                        Select a story from the library or create a new one to begin.
                        <button onclick="app.createNewStory()" class="text-[10px] uppercase tracking-widest border border-zinc-800 px-4 py-2 hover:bg-zinc-900 transition-colors">
                            + New Adventure
                        </button>
                    </div>`;
                document.getElementById('input-area').classList.add('opacity-50', 'pointer-events-none');
                ui.applyMood('default');
                
                // Clear storyId from URL
                const url = new URL(window.location);
                url.searchParams.delete('storyId');
                window.history.pushState({}, '', url);
            }
            loadLibrary();
        } catch (err) { 
            ui.showModal({ title: "Error", message: "Failed to delete story" });
        }
    });
}

// --- NOVEL EDITOR LOGIC ---

let novelSaveTimeout = null;

function handleNovelInput() {
    if (!currentStory) return;
    
    ui.updateStatus('Changes detected...');
    
    if (novelSaveTimeout) clearTimeout(novelSaveTimeout);
    
    novelSaveTimeout = setTimeout(async () => {
        await saveNovel();
        novelSaveTimeout = null;
    }, 2000);
}

async function saveNovel() {
    if (!currentStory) return;
    
    const nBody = document.getElementById('novel-body');
    // We use innerText to get the plain text with line breaks preserved
    const content = nBody.innerText.trim();
    
    ui.updateStatus('Saving novel...');
    
    try {
        if (novelPerspective === '3rd') {
            currentStory.novel = content;
        } else {
            // For 1st person, we'll save it as a string. 
            // Note: This replaces the structured interactive array with a flat string.
            // The backend parseInteractive will turn this into a single 'Beginning' turn
            // unless the user manually adds "> Action" and "---" separators.
            currentStory.interactive = content;
        }
        
        const response = await api.updateStory(currentStory.id, currentStory);
        if (response?.hash) setCurrentStoryHash(response.hash);
        ui.updateStatus('Novel saved.');
        setTimeout(() => {
            const statusEl = document.getElementById('status-msg');
            if (statusEl && statusEl.textContent === 'Novel saved.') {
                ui.updateStatus('');
            }
        }, 2000);
    } catch (err) {
        console.error("Failed to save novel", err);
        ui.updateStatus('Failed to save novel.');
    }
}

export function renderStory() {
    if (!currentStory) return;
    
    const iContainer = document.getElementById('interactive-content');
    iContainer.innerHTML = '';
    
    if (currentStory.interactive.length === 0) {
        iContainer.innerHTML = '<div class="text-zinc-500 italic text-center pt-24">The page is blank. Your first action defines the world.</div>';
    }
    
    // Always render interactive as objects for the interactive tab
    const interactiveArray = Array.isArray(currentStory.interactive) 
        ? currentStory.interactive 
        : [{ action: 'Beginning', response: currentStory.interactive }];

    interactiveArray.forEach(turn => {
        appendNarrativeDOM(turn.response, turn.action);
    });

    const nBody = document.getElementById('novel-body');
    
    // Don't overwrite if the user is currently typing in the novel editor
    if (document.activeElement === nBody) return;

    if (novelPerspective === '3rd') {
        nBody.innerHTML = currentStory.novel.split('\n\n').map(p => p.trim() ? `<p class="mb-6">${p}</p>` : '').join('');
    } else {
        // If it's 1st person perspective in the novel tab, show the responses only (like a book)
        nBody.innerHTML = interactiveArray.map(turn => 
            turn.response.split('\n\n').map(p => `<p class="mb-6">${p}</p>`).join('')
        ).join('');
    }
    iContainer.scrollTo({ top: iContainer.scrollHeight, behavior: 'smooth' });
}

export async function handleAction() {
    const input = document.getElementById('user-action');
    const action = input.value.trim();
    if (!action || !currentStory || !selectedModel) return;

    // Stop typing notification
    if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
    }
    notifyStopTyping(currentStory.id);

    input.value = '';
    ui.updateStatus('Thinking...');
    
    // Clear initial prompt if first turn
    if (currentStory.interactive.length === 0) {
        document.getElementById('interactive-content').innerHTML = '';
    }

    // Setup live UI element
    const turnDiv = document.createElement('div');
    turnDiv.className = 'fade-in space-y-4 pt-8 border-t border-zinc-900/50';
    
    const actionEl = document.createElement('div');
    actionEl.className = 'text-[10px] uppercase tracking-widest text-zinc-500 mb-2';
    actionEl.textContent = `> ${action}`;
    turnDiv.appendChild(actionEl);

    const responseContent = document.createElement('div');
    responseContent.className = 'text-zinc-300 font-light leading-relaxed space-y-4';
    turnDiv.appendChild(responseContent);
    
    const iContainer = document.getElementById('interactive-content');
    iContainer.appendChild(turnDiv);

    try {
        const response = await api.storyChat(currentStory.id, selectedModel, action, true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let fullStreamedText = "";
        let narrativeText = "";
        let metadataJSON = "";
        let isMetadataMode = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(l => l.trim());

            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.message && data.message.content) {
                        fullStreamedText += data.message.content;
                        
                        if (fullStreamedText.includes('###JSON###')) {
                            const parts = fullStreamedText.split('###JSON###');
                            narrativeText = parts[0].trim();
                            metadataJSON = parts[1].trim();
                            isMetadataMode = true;
                        } else {
                            narrativeText = fullStreamedText;
                        }

                        if (!isMetadataMode) {
                            let displayable = narrativeText;
                            if (displayable.includes('###')) {
                                displayable = displayable.split('###')[0].trim();
                            }
                            responseContent.innerHTML = displayable.split('\n\n').map(p => `<p>${p}</p>`).join('');
                            iContainer.scrollTo({ top: iContainer.scrollHeight, behavior: 'smooth' });
                            sendNarrativeUpdate(currentStory.id, displayable, false);
                        }
                    }
                } catch (e) {
                    console.warn("Failed to parse stream line", line);
                }
            }
        }

        // Parse Metadata
        let mood = 'default';
        let theme = null;
        const meta = extractJSON(metadataJSON);
        if (meta) {
            mood = meta.mood || 'default';
            theme = meta.theme_colors;
        }

        // Background Novelization
        const tpPrompt = [
            { role: "system", content: "Novelize the following event in a STRICT, FORMAL THIRD-PERSON literary style. Respond ONLY with a JSON object: { \"text\": \"...\" }" },
            { role: "user", content: `Action: ${action}\nResult: ${narrativeText}` }
        ];
        
        ui.logToDebug('AI Prompt (Novelization)', JSON.stringify(tpPrompt, null, 2));

        let tpData = { text: narrativeText };
        try {
            const tpRes = await api.callChat(selectedModel, tpPrompt);
            const tpResJSON = await tpRes.json();
            const extracted = extractJSON(tpResJSON.message.content);
            if (extracted && extracted.text) tpData = extracted;
        } catch (e) {
            console.warn("Novelization parse failed");
        }

        // Finalize State
        currentStory.interactive.push({ action, response: narrativeText, mood });
        currentStory.messages.push({ role: "user", content: action });
        currentStory.messages.push({ role: "assistant", content: fullStreamedText });
        currentStory.novel += `\n\n${tpData.text}`;
        currentStory.currentMood = mood;
        currentStory.currentTheme = theme;

        ui.applyMood(mood, theme);

        // Music Generation Trigger
        const forceRegen = document.getElementById('toggle-regen-music')?.checked;
        const moodChanged = currentStory.currentMood !== mood;
        
        if (settings.musicEnabled && (forceRegen || (settings.autoMusic && moodChanged))) {
            const summaryText = currentStory.summary?.plotPoints?.join(' ') || narrativeText;
            music.generateNewMusic(currentStory.id, mood, summaryText);
        }

        const updateResponse = await api.updateStory(currentStory.id, currentStory);
        if (updateResponse && updateResponse.hash) {
            setCurrentStoryHash(updateResponse.hash);
        }
        
        sendNarrativeUpdate(currentStory.id, narrativeText, true);
        ui.updateStatus('');

        // 5. Chapter Length Check
        if (currentStory.interactive.length >= 20) {
            ui.updateStatus('Tip: This chapter is getting long. Consider starting a new chapter to keep the AI focused.');
        }

    } catch (err) {
        console.error(err);
        ui.updateStatus('SYSTEM ERROR: Link fragmented.');
    }
}

function appendNarrativeDOM(text, action) {
    const container = document.getElementById('interactive-content');
    const div = document.createElement('div');
    div.className = 'fade-in space-y-4 pt-8 border-t border-zinc-900/50';
    
    if (action) {
        const actionEl = document.createElement('div');
        actionEl.className = 'text-[10px] uppercase tracking-widest text-zinc-500 mb-2';
        actionEl.textContent = `> ${action}`;
        div.appendChild(actionEl);
    }

    text.split('\n\n').forEach(p => {
        const el = document.createElement('p');
        el.className = 'text-zinc-300 font-light leading-relaxed';
        el.textContent = p;
        div.appendChild(el);
    });
    container.appendChild(div);
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
}
