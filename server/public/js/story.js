import * as api from './api.js';
import * as ui from './ui.js';

export let currentStory = null;
export let selectedModel = '';
export let novelPerspective = '3rd';

export function setSelectedModel(val) { selectedModel = val; }
export function setNovelPerspective(val) { novelPerspective = val; }

export async function loadLibrary() {
    const list = document.getElementById('story-list');
    try {
        const stories = await api.fetchStories();
        list.innerHTML = '';
        stories.forEach(s => {
            const div = document.createElement('div');
            div.className = `group flex justify-between items-center p-3 rounded cursor-pointer transition-colors ${currentStory?.id === s.id ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-900/50'}`;
            div.innerHTML = `
                <div class="flex-1 truncate pr-2" onclick="app.selectStory('${s.id}')">
                    <div class="text-xs truncate font-medium">${s.title}</div>
                    <div class="text-[9px] text-zinc-600 uppercase tracking-tighter">${new Date(s.createdAt).toLocaleDateString()}</div>
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
    const title = prompt("Enter a title for your adventure:", "A New Beginning");
    if (!title) return;
    try {
        const story = await api.createStory(title);
        await selectStory(story.id);
        loadLibrary();
        if (window.innerWidth < 768) ui.toggleLibrary();
    } catch (err) { alert("Failed to create story"); }
}

export async function selectStory(id) {
    try {
        currentStory = await api.fetchStoryById(id);
        document.getElementById('current-story-title').textContent = currentStory.title;
        document.getElementById('input-area').classList.remove('opacity-50', 'pointer-events-none');
        
        // Backwards compatibility for old stories missing messages
        if (!currentStory.messages) currentStory.messages = [];
        
        ui.applyMood(currentStory.currentMood || 'default', currentStory.currentTheme);
        renderStory();
        loadLibrary();
    } catch (err) { alert("Failed to load story"); }
}

export async function deleteStory(id, e) {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to delete this adventure?")) return;
    try {
        await api.deleteStory(id);
        if (currentStory?.id === id) {
            currentStory = null;
            document.getElementById('current-story-title').textContent = 'Select a Story';
            document.getElementById('interactive-content').innerHTML = '<div class="text-zinc-600 italic text-center pt-24">Select a story from the library or create a new one to begin.</div>';
            document.getElementById('input-area').classList.add('opacity-50', 'pointer-events-none');
            ui.applyMood('default');
        }
        loadLibrary();
    } catch (err) { alert("Failed to delete story"); }
}

export function renderStory() {
    if (!currentStory) return;
    
    const iContainer = document.getElementById('interactive-content');
    iContainer.innerHTML = '';
    
    if (currentStory.interactive.length === 0) {
        iContainer.innerHTML = '<div class="text-zinc-600 italic text-center pt-24">The page is blank. Your first action defines the world.</div>';
    }
    
    currentStory.interactive.forEach(turn => {
        appendNarrativeDOM(turn.response, turn.action);
    });

    const nBody = document.getElementById('novel-body');
    if (novelPerspective === '3rd') {
        nBody.innerHTML = currentStory.novel.split('\n\n').map(p => p.trim() ? `<p class="mb-6">${p}</p>` : '').join('');
    } else {
        nBody.innerHTML = currentStory.interactive.map(turn => 
            turn.response.split('\n\n').map(p => `<p class="mb-6">${p}</p>`).join('')
        ).join('');
    }
    iContainer.scrollTo({ top: iContainer.scrollHeight, behavior: 'smooth' });
}

export async function handleAction() {
    const input = document.getElementById('user-action');
    const action = input.value.trim();
    if (!action || !currentStory || !selectedModel) return;

    input.value = '';
    ui.updateStatus('Directing Core...');
    
    // Clear initial prompt if first turn
    if (currentStory.interactive.length === 0) {
        document.getElementById('interactive-content').innerHTML = '';
    }

    // Setup live UI element
    const turnDiv = document.createElement('div');
    turnDiv.className = 'fade-in space-y-4 pt-8 border-t border-zinc-900/50';
    
    const actionEl = document.createElement('div');
    actionEl.className = 'text-[10px] uppercase tracking-widest text-zinc-600 mb-2';
    actionEl.textContent = `> ${action}`;
    turnDiv.appendChild(actionEl);

    const responseContent = document.createElement('div');
    responseContent.className = 'text-zinc-300 font-light leading-relaxed space-y-4';
    turnDiv.appendChild(responseContent);
    
    const iContainer = document.getElementById('interactive-content');
    iContainer.appendChild(turnDiv);

    try {
        // Build Chat Messages
        const systemMessage = {
            role: "system",
            content: `You are an immersive storyteller. Respond in the FIRST PERSON.
            Provide the story response first, followed by the separator ###JSON###, then the mood metadata.
            
            STRICT OUTPUT FORMAT:
            [Narrative Text]
            ###JSON###
            {
                "mood": "eerie|serene|action|mystical|default",
                "theme_colors": { "bg": "#hex", "accent": "#hex" }
            }`
        };

        const userMessage = { role: "user", content: action };
        const messages = [systemMessage, ...currentStory.messages, userMessage];

        let fullStreamedText = "";
        let narrativeText = "";
        let metadataJSON = "";
        let isMetadataMode = false;

        await api.streamChat(selectedModel, messages, (chunk, full) => {
            fullStreamedText = full;
            
            if (fullStreamedText.includes('###JSON###')) {
                const parts = fullStreamedText.split('###JSON###');
                narrativeText = parts[0].trim();
                metadataJSON = parts[1].trim();
                isMetadataMode = true;
            } else {
                narrativeText = fullStreamedText;
            }

            // Update UI live (only narrative part)
            if (!isMetadataMode) {
                // Peek ahead: if the text contains the start of our separator, strip it for display
                let displayable = narrativeText;
                if (displayable.includes('###')) {
                    displayable = displayable.split('###')[0].trim();
                }
                responseContent.innerHTML = displayable.split('\n\n').map(p => `<p>${p}</p>`).join('');
                iContainer.scrollTo({ top: iContainer.scrollHeight, behavior: 'smooth' });
            }
        });

        // Parse Metadata
        let mood = 'default';
        let theme = null;
        try {
            const meta = JSON.parse(metadataJSON);
            mood = meta.mood || 'default';
            theme = meta.theme_colors;
        } catch (e) {
            console.warn("Metadata parse failed", metadataJSON);
        }

        // Background Novelization (Non-streaming for consistency)
        const tpPrompt = [
            { role: "system", content: "Novelize the following event in a STRICT, FORMAL THIRD-PERSON literary style. Respond ONLY with a JSON object: { \"text\": \"...\" }" },
            { role: "user", content: `Action: ${action}\nResult: ${narrativeText}` }
        ];
        const tpResJSON = await (await api.callChat(selectedModel, tpPrompt)).json();
        const tpData = JSON.parse(tpResJSON.message.content);

        // Finalize State
        currentStory.interactive.push({ action, response: narrativeText, mood });
        currentStory.messages.push(userMessage);
        currentStory.messages.push({ role: "assistant", content: fullStreamedText });
        currentStory.novel += `\n\n${tpData.text}`;
        currentStory.currentMood = mood;
        currentStory.currentTheme = theme;

        ui.applyMood(mood, theme);
        await api.updateStory(currentStory.id, currentStory);
        ui.updateStatus('');

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
        actionEl.className = 'text-[10px] uppercase tracking-widest text-zinc-600 mb-2';
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
