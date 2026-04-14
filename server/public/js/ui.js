import * as api from './api.js';
import { updateUsername } from './websocket.js';
import { moodMap } from './config.js';

export function editProfile() {
    const newName = prompt("Enter your new explorer name:", api.username);
    if (newName && api.userId) {
        api.updateProfile(api.userId, newName)
            .then(data => {
                api.setUsername(data.username);
                updateUsername(data.username); // Sync with WebSocket session
            })
            .catch(err => alert("Failed to update profile"));
    }
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
    document.getElementById('tab-interactive').classList.toggle('tab-active', tab === 'interactive');
    document.getElementById('tab-interactive').classList.toggle('text-zinc-600', tab !== 'interactive');
    document.getElementById('tab-novel').classList.toggle('tab-active', tab === 'novel');
    document.getElementById('tab-novel').classList.toggle('text-zinc-600', tab !== 'novel');
}

export function updateChapterSelection(config) {
    const container = document.getElementById('chapter-selection');
    const select = document.getElementById('chapter-select');
    if (!container || !select) return;

    if (!config || !config.chapters || config.chapters.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    select.innerHTML = '';
    
    config.chapters.forEach(ch => {
        const opt = document.createElement('option');
        opt.value = ch;
        opt.textContent = ch.replace('chapter-', '');
        if (ch === config.currentChapter) opt.selected = true;
        select.appendChild(opt);
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
