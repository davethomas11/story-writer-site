import * as api from './api.js';
import { updateUsername } from './websocket.js';
import { moodMap } from './config.js';

export function editProfile() {
    showModal({
        title: "Update Profile",
        message: "Enter your new explorer name:",
        inputValue: api.username,
        showInput: true
    }).then(newName => {
        if (newName && api.userId) {
            api.updateProfile(api.userId, newName)
                .then(data => {
                    api.setUsername(data.username);
                    updateUsername(data.username); // Sync with WebSocket session
                })
                .catch(err => alert("Failed to update profile"));
        }
    });
}

// --- CUSTOM DIALOGS & OVERLAYS ---

export function showLoading(msg = "Processing...") {
    const overlay = document.getElementById('loading-overlay');
    const msgEl = document.getElementById('loading-message');
    if (overlay && msgEl) {
        msgEl.textContent = msg;
        overlay.classList.add('opacity-100');
        overlay.classList.remove('pointer-events-none');
    }
}

export function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('opacity-100');
        overlay.classList.add('pointer-events-none');
    }
}

let modalResolver = null;

export function showModal({ title = "System Message", message = "", showCancel = false, showInput = false, inputValue = "" }) {
    const modal = document.getElementById('custom-modal');
    const container = document.getElementById('modal-container');
    const titleEl = document.getElementById('modal-title');
    const messageEl = document.getElementById('modal-message');
    const inputContainer = document.getElementById('modal-input-container');
    const inputEl = document.getElementById('modal-input');
    const cancelBtn = document.getElementById('modal-cancel');

    if (!modal) return Promise.reject("Modal not found");

    titleEl.textContent = title;
    messageEl.textContent = message;
    
    if (showInput) {
        inputContainer.classList.remove('hidden');
        inputEl.value = inputValue;
        setTimeout(() => inputEl.focus(), 100);
    } else {
        inputContainer.classList.add('hidden');
    }

    cancelBtn.classList.toggle('hidden', !showCancel);

    modal.classList.add('opacity-100');
    modal.classList.remove('pointer-events-none');
    container.classList.remove('scale-95');

    return new Promise((resolve) => {
        modalResolver = resolve;
        
        inputEl.onkeypress = (e) => {
            if (e.key === 'Enter') handleModalOk();
        };
    });
}

export function handleModalOk() {
    const inputContainer = document.getElementById('modal-input-container');
    const inputEl = document.getElementById('modal-input');
    const isInputVisible = !inputContainer.classList.contains('hidden');
    
    const value = isInputVisible ? inputEl.value : true;
    
    // Capture and clear resolver BEFORE closing so closeModal doesn't resolve with null
    const resolver = modalResolver;
    modalResolver = null;
    
    closeModal();
    
    if (resolver) resolver(value);
}

export function closeModal() {
    const modal = document.getElementById('custom-modal');
    const container = document.getElementById('modal-container');
    if (modal) {
        modal.classList.remove('opacity-100');
        modal.classList.add('pointer-events-none');
        container.classList.add('scale-95');
    }
    
    // Resolve with null only if we haven't already resolved (e.g. backdrop/cancel click)
    const resolver = modalResolver;
    modalResolver = null;
    if (resolver) resolver(null);
}

export function toggleLibrary(e) {
    if (e) e.stopPropagation();
    const sidebar = document.getElementById('library-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    const isOpen = sidebar.classList.toggle('open');
    if (overlay) {
        if (isOpen) overlay.classList.add('visible');
        else if (!document.getElementById('presence-sidebar').classList.contains('open')) {
            overlay.classList.remove('visible');
        }
    }
}

export function togglePresence(show) {
    const sidebar = document.getElementById('presence-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (show) {
        sidebar.classList.add('open');
        if (overlay) overlay.classList.add('visible');
    } else {
        sidebar.classList.remove('open');
        if (overlay && !document.getElementById('library-sidebar').classList.contains('open')) {
            overlay.classList.remove('visible');
        }
    }
}

export function togglePresenceModal(show) {
    const modal = document.getElementById('presence-modal');
    if (!modal) return;
    if (show) {
        modal.classList.add('opacity-100');
        modal.classList.remove('pointer-events-none');
    } else {
        modal.classList.remove('opacity-100');
        modal.classList.add('pointer-events-none');
    }
}

export function closeLibrary() {
    const sidebar = document.getElementById('library-sidebar');
    const pSidebar = document.getElementById('presence-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    sidebar.classList.remove('open');
    pSidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
}

export function switchTab(tab) {
    document.getElementById('view-interactive').classList.toggle('hidden', tab !== 'interactive');
    document.getElementById('view-novel').classList.toggle('hidden', tab !== 'novel');
    document.getElementById('view-music').classList.toggle('hidden', tab !== 'music');
    document.getElementById('view-context').classList.toggle('hidden', tab !== 'context');
    document.getElementById('view-settings').classList.toggle('hidden', tab !== 'settings');
    
    document.getElementById('tab-interactive').classList.toggle('tab-active', tab === 'interactive');
    document.getElementById('tab-interactive').classList.toggle('text-zinc-400', tab !== 'interactive');
    
    document.getElementById('tab-novel').classList.toggle('tab-active', tab === 'novel');
    document.getElementById('tab-novel').classList.toggle('text-zinc-400', tab !== 'novel');

    document.getElementById('tab-music').classList.toggle('tab-active', tab === 'music');
    document.getElementById('tab-music').classList.toggle('text-zinc-400', tab !== 'music');
    
    document.getElementById('tab-context').classList.toggle('tab-active', tab === 'context');
    document.getElementById('tab-context').classList.toggle('text-zinc-400', tab !== 'context');

    document.getElementById('tab-settings').classList.toggle('tab-active', tab === 'settings');
    document.getElementById('tab-settings').classList.toggle('text-zinc-400', tab !== 'settings');

    // Visualizer Lifecycle
    import('./visualizer.js').then(v => {
        if (tab === 'music') {
            v.startVisualizer();
            renderMusicEditor(); // Ensure editor is populated when entering tab
        } else {
            v.stopVisualizer();
        }
    });
}

export function switchMusicSubTab(subTab) {
    const isPlayer = subTab === 'player';
    document.getElementById('music-player-view').classList.toggle('hidden', !isPlayer);
    document.getElementById('music-editor-view').classList.toggle('hidden', isPlayer);
    
    document.getElementById('subtab-music-player').classList.toggle('border-emerald-500', isPlayer);
    document.getElementById('subtab-music-player').classList.toggle('text-emerald-500', isPlayer);
    document.getElementById('subtab-music-player').classList.toggle('border-transparent', !isPlayer);
    document.getElementById('subtab-music-player').classList.toggle('text-zinc-500', !isPlayer);
    
    document.getElementById('subtab-music-editor').classList.toggle('border-emerald-500', !isPlayer);
    document.getElementById('subtab-music-editor').classList.toggle('text-emerald-500', !isPlayer);
    document.getElementById('subtab-music-editor').classList.toggle('border-transparent', isPlayer);
    document.getElementById('subtab-music-editor').classList.toggle('text-zinc-500', isPlayer);

    if (subTab === 'editor') {
        import('./story.js').then(s => {
            import('./ui_builder.js').then(uiBuilder => {
                uiBuilder.UI.inject('daw-mount', 'daw', { music: s.currentStory?.music });
            });
        });
    }
}

export async function renderMusicEditor(musicData) {
    const editor = document.getElementById('music-score-editor');
    if (!editor) return;

    let data = musicData;
    if (!data) {
        const storyModule = await import('./story.js');
        data = storyModule.currentStory?.music;
    }

    if (data) {
        editor.value = JSON.stringify(data, null, 2);
    } else {
        editor.value = "// No soundtrack composed for this chapter yet.";
    }
}

export async function saveMusicEditor() {
    const editor = document.getElementById('music-score-editor');
    if (!editor) return;

    try {
        const musicScore = JSON.parse(editor.value);
        const storyModule = await import('./story.js');
        const musicModule = await import('./music.js');
        
        if (storyModule.currentStory) {
            updateStatus('Updating soundtrack...');
            storyModule.currentStory.music = musicScore;
            
            // Save to server
            await api.updateStory(storyModule.currentStory.id, storyModule.currentStory);
            
            // Replay
            musicModule.playScore(musicScore);
            
            updateStatus('Soundtrack updated.');
            setTimeout(() => updateStatus(''), 2000);
        }
    } catch (err) {
        console.error("Invalid music JSON", err);
        alert("Invalid JSON format. Please check your syntax.");
    }
}

export function updateMusicUI(isPlaying, hasMusic = false) {
    const btnMain = document.getElementById('btn-play-music');
    const btnInt = document.getElementById('btn-play-music-interactive');
    
    // Show/Hide interactive button based on music availability and play state
    if (btnInt) {
        if (hasMusic || isPlaying) {
            btnInt.classList.remove('hidden');
            btnInt.classList.add('flex');
        } else {
            btnInt.classList.remove('flex');
            btnInt.classList.add('hidden');
        }

        const icon = btnInt.querySelector('svg');
        const text = btnInt.querySelector('span');
        if (isPlaying) {
            if (icon) icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>`;
            if (text) text.textContent = 'Pause Music';
        } else {
            if (icon) icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>`;
            if (text) text.textContent = 'Play Music';
        }
    }

    if (btnMain) {
        if (isPlaying) {
            btnMain.innerHTML = `<svg class="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        } else {
            btnMain.innerHTML = `<svg class="w-6 h-6 text-zinc-400 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path></svg>`;
        }
    }
}

export function updateMusicStatus(score) {
    const title = document.getElementById('music-track-title');
    const info = document.getElementById('music-track-info');
    if (title && info) {
        title.textContent = "Original Soundtrack";
        info.textContent = `${score.bpm} BPM • ${score.tracks.length} Tracks • Multi-layered arrangement`;
    }
}

export function updateChapterSelection(config) {
    const container = document.getElementById('chapter-selection');
    const options = document.getElementById('chapter-options');
    const display = document.getElementById('current-chapter-display');
    if (!container || !options || !display) return;

    if (!config || !config.chapters || config.chapters.length === 0) {
        container.classList.add('hidden');
        return;
    }

    const formatChapterName = (name) => {
        const raw = name.replace('chapter-', '');
        if (/^\d+$/.test(raw)) return `Chapter ${raw}`;
        return raw.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    container.classList.remove('hidden');
    display.textContent = formatChapterName(config.currentChapter || 'chapter-1');
    options.innerHTML = '';
    
    config.chapters.forEach(ch => {
        const btn = document.createElement('button');
        const chName = formatChapterName(ch);
        const isSelected = ch === config.currentChapter;
        
        btn.className = `w-full text-left px-4 py-2 text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition-colors ${isSelected ? 'text-emerald-500 font-bold' : 'text-zinc-400'}`;
        btn.textContent = chName;
        
        btn.onclick = () => {
            import('./story.js').then(story => {
                story.switchChapter(ch);
                closeChapterDropdown();
            });
        };
        options.appendChild(btn);
    });
}

export function applyMood(mood, theme) {
    const body = document.body;
    
    // Remove old mood classes
    Object.values(moodMap).forEach(cls => body.classList.remove(cls));
    
    // Add new mood class
    const moodClass = moodMap[mood] || moodMap['default'];
    body.classList.add(moodClass);

    // Apply custom theme colors to the BODY element directly
    // This ensures they override the variables defined in the .mood- class
    if (theme && theme.bg) {
        body.style.setProperty('--bg-base', theme.bg);
    } else {
        body.style.removeProperty('--bg-base');
    }

    if (theme && theme.accent) {
        body.style.setProperty('--accent', theme.accent);
        body.style.setProperty('--accent-glow', `${theme.accent}66`); // 40% opacity
    } else {
        body.style.removeProperty('--accent');
        body.style.removeProperty('--accent-glow');
    }
}

export function toggleDebug() {
    const console = document.getElementById('debug-console');
    if (console) {
        console.classList.toggle('open');
    }
}

export function logToDebug(title, content) {
    const logs = document.getElementById('debug-logs');
    if (!logs) return;

    const entry = document.createElement('div');
    entry.className = 'debug-entry fade-in';
    
    const time = new Date().toLocaleTimeString();
    
    entry.innerHTML = `
        <div class="debug-entry-title">[${time}] ${title}</div>
        <div class="debug-entry-content">${escapeHtml(content)}</div>
    `;
    
    logs.appendChild(entry);
    logs.scrollTo({ top: logs.scrollHeight, behavior: 'smooth' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function updateStatus(msg) {
    const el = document.getElementById('status-msg');
    if (el) el.textContent = msg;
}

// --- CUSTOM DROPDOWNS ---

export function toggleModelDropdown(e) {
    if (e) e.stopPropagation();
    const options = document.getElementById('model-options');
    const icon = document.getElementById('model-dropdown-icon');
    
    const isOpen = !options.classList.contains('pointer-events-none');
    
    if (isOpen) {
        closeModelDropdown();
    } else {
        options.classList.remove('opacity-0', 'translate-y-2', 'pointer-events-none');
        if (icon) icon.classList.add('rotate-180');
        
        // Close on outside click
        const closeHandler = () => {
            closeModelDropdown();
            document.removeEventListener('click', closeHandler);
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 10);
    }
}

export function closeModelDropdown() {
    const options = document.getElementById('model-options');
    const icon = document.getElementById('model-dropdown-icon');
    if (options) {
        options.classList.add('opacity-0', 'translate-y-2', 'pointer-events-none');
    }
    if (icon) icon.classList.remove('rotate-180');
}

export function toggleChapterDropdown(e) {
    if (e) e.stopPropagation();
    const options = document.getElementById('chapter-options');
    const icon = document.getElementById('chapter-dropdown-icon');
    
    const isOpen = !options.classList.contains('pointer-events-none');
    
    if (isOpen) {
        closeChapterDropdown();
    } else {
        options.classList.remove('opacity-0', 'translate-y-2', 'pointer-events-none');
        if (icon) icon.classList.add('rotate-180');
        
        // Close on outside click
        const closeHandler = () => {
            closeChapterDropdown();
            document.removeEventListener('click', closeHandler);
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 10);
    }
}

export function closeChapterDropdown() {
    const options = document.getElementById('chapter-options');
    const icon = document.getElementById('chapter-dropdown-icon');
    if (options) {
        options.classList.add('opacity-0', 'translate-y-2', 'pointer-events-none');
    }
    if (icon) icon.classList.remove('rotate-180');
}

export function populateModelDropdown(models, currentModel, onSelect) {
    const options = document.getElementById('model-options');
    const display = document.getElementById('current-model-display');
    if (!options || !display) return;

    display.textContent = currentModel || 'Select Model';
    options.innerHTML = '';

    models.forEach(m => {
        const btn = document.createElement('button');
        btn.className = `w-full text-left px-4 py-2 text-[10px] uppercase tracking-widest hover:bg-zinc-800 transition-colors ${m.name === currentModel ? 'text-emerald-500 font-bold' : 'text-zinc-400'}`;
        btn.textContent = m.name;
        btn.onclick = () => {
            display.textContent = m.name;
            onSelect(m.name);
            closeModelDropdown();
        };
        options.appendChild(btn);
    });
}

export function updatePresence(presenceList) {
    const countText = document.getElementById('presence-count-text');
    const modalList = document.getElementById('presence-modal-list');
    const drawer = document.getElementById('presence-drawer-content');
    if (!countText || !modalList || !drawer) return;

    // Ensure presenceList is iterable
    const list = Array.isArray(presenceList) ? presenceList : [];
    
    // Update Header Count
    countText.textContent = `${list.length} Online`;

    // Reset lists
    modalList.innerHTML = '';
    drawer.innerHTML = '';
    
    const urlParams = new URLSearchParams(window.location.search);
    const activeStoryId = urlParams.get('storyId');

    // Filter users for the current story to show in drawer
    const localReaders = list.filter(u => u && u.storyId === activeStoryId);

    // Dynamic import to avoid circular dependency
    import('./story.js').then(storyModule => {
        list.forEach(user => {
            if (!user) return;
            const isMe = user.userId === api.userId;
            
            // Populate Modal
            const modalItem = document.createElement('div');
            modalItem.className = 'flex items-center justify-between p-3 rounded bg-zinc-800/30 border border-zinc-800/50';
            
            const storyTitle = user.storyId ? (storyModule.allStories?.get(user.storyId)?.title || 'Exploring...') : 'Browsing Library';
            
            modalItem.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full ${user.storyId ? 'bg-emerald-500' : 'bg-zinc-600'}"></div>
                    <div>
                        <div class="text-xs font-bold text-zinc-100">${user.username} ${isMe ? '<span class="opacity-50 text-[9px]">(You)</span>' : ''}</div>
                        <div class="text-[9px] text-zinc-500 uppercase tracking-tighter">${user.userId}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-[10px] text-zinc-400 font-medium">${storyTitle}</div>
                </div>
            `;
            modalList.innerHTML += modalItem.outerHTML;
        });

        // Populate Right Drawer (Mobile)
        if (localReaders.length > 0) {
            localReaders.forEach(user => {
                const item = document.createElement('div');
                item.className = 'presence-item';
                const isMe = user.userId === api.userId;
                item.innerHTML = `
                    <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <div class="flex-1">
                        <div class="text-xs font-medium text-zinc-100">${user.username} ${isMe ? '<span class="text-[9px] opacity-50 ml-1">(You)</span>' : ''}</div>
                        <div class="text-[9px] text-zinc-600 uppercase tracking-tighter">Exploring this story</div>
                    </div>
                `;
                drawer.appendChild(item);
            });
        } else {
            drawer.innerHTML = '<div class="text-[10px] text-zinc-600 italic text-center py-8">No other explorers in this timeline yet.</div>';
        }
    });

    // Currently Reading List (Story Context Header)
    const readersEl = document.getElementById('current-readers');
    if (readersEl) {
        if (activeStoryId) {
            const readers = localReaders.map(u => u.userId === api.userId ? 'You' : u.username);
            
            if (readers.length > 0) {
                readersEl.textContent = `${readers.length} Reading: ${readers.join(', ')}`;
                readersEl.classList.remove('hidden');
            } else {
                readersEl.classList.add('hidden');
            }
        } else {
            readersEl.classList.add('hidden');
        }
    }
}

export function updateTypingIndicator(username) {
    const el = document.getElementById('typing-indicator');
    const textEl = document.getElementById('typing-text');
    const inputArea = document.getElementById('input-area');
    
    if (username) {
        textEl.textContent = `${username} is directing`;
        el.classList.add('opacity-100');
        // Block input area for others
        inputArea.classList.add('opacity-50', 'pointer-events-none');
    } else {
        el.classList.remove('opacity-100');
        // Restore input area if story is selected and server is ready
        const urlParams = new URLSearchParams(window.location.search);
        const statusEl = document.getElementById('connection-status');
        const isReady = statusEl && statusEl.textContent.includes('Ready');
        if (urlParams.get('storyId') && isReady) {
             inputArea.classList.remove('opacity-50', 'pointer-events-none');
        }
    }
}

export function showStats(stats) {
    const content = document.getElementById('stats-content');
    if (!content) return;

    const uptimeHrs = Math.floor(stats.uptime / 3600);
    const uptimeMins = Math.floor((stats.uptime % 3600) / 60);

    content.innerHTML = `
        <div class="grid grid-cols-2 gap-4">
            <div class="p-3 bg-zinc-800/30 border border-zinc-800 rounded">
                <div class="text-[9px] uppercase tracking-widest text-zinc-500 mb-1">Stories</div>
                <div class="text-xl font-light text-zinc-100">${stats.stories}</div>
            </div>
            <div class="p-3 bg-zinc-800/30 border border-zinc-800 rounded">
                <div class="text-[9px] uppercase tracking-widest text-zinc-500 mb-1">Explorers</div>
                <div class="text-xl font-light text-zinc-100">${stats.users}</div>
            </div>
            <div class="p-3 bg-zinc-800/30 border border-zinc-800 rounded">
                <div class="text-[9px] uppercase tracking-widest text-zinc-500 mb-1">Total Turns</div>
                <div class="text-xl font-light text-zinc-100">${stats.totalTurns}</div>
            </div>
            <div class="p-3 bg-zinc-800/30 border border-zinc-800 rounded">
                <div class="text-[9px] uppercase tracking-widest text-zinc-500 mb-1">Novel Chars</div>
                <div class="text-xl font-light text-zinc-100">${(stats.totalNovelChars / 1000).toFixed(1)}k</div>
            </div>
        </div>
        <div class="pt-2 border-t border-zinc-800">
            <div class="text-[9px] uppercase tracking-widest text-zinc-500 mb-1 text-center">Server Uptime</div>
            <div class="text-xs text-zinc-300 text-center">${uptimeHrs}h ${uptimeMins}m</div>
        </div>
    `;
    
    toggleStatsModal(true);
}

export function toggleStatsModal(show) {
    const el = document.getElementById('stats-modal');
    if (el) {
        if (show) {
            el.classList.remove('pointer-events-none');
            el.classList.add('opacity-100');
        } else {
            el.classList.add('pointer-events-none');
            el.classList.remove('opacity-100');
        }
    }
}

export function updateConnectionStatus(status, isReady) {
    const el = document.getElementById('connection-status');
    if (el) {
        el.textContent = `• ${status}`;
        // emerald-500 for ready, amber-500 for waking/connecting, red-500 for offline
        if (isReady) {
            el.className = 'whitespace-nowrap text-emerald-500';
        } else if (status.includes('...')) {
            el.className = 'whitespace-nowrap text-amber-500';
        } else {
            el.className = 'whitespace-nowrap text-red-500';
        }

        // Enable/Disable input area based on readiness
        const inputArea = document.getElementById('input-area');
        if (inputArea) {
            const urlParams = new URLSearchParams(window.location.search);
            const hasStory = !!urlParams.get('storyId');
            if (isReady && hasStory) {
                inputArea.classList.remove('opacity-50', 'pointer-events-none');
            } else {
                inputArea.classList.add('opacity-50', 'pointer-events-none');
            }
        }
    }
}
