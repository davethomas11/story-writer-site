import { moodMap } from './config.js';

export function toggleLibrary(e) {
    if (e) e.stopPropagation();
    document.getElementById('library-sidebar').classList.toggle('open');
}

export function closeLibrary() {
    const sidebar = document.getElementById('library-sidebar');
    if (sidebar.classList.contains('open')) sidebar.classList.remove('open');
}

export function switchTab(tab) {
    document.getElementById('view-interactive').classList.toggle('hidden', tab !== 'interactive');
    document.getElementById('view-novel').classList.toggle('hidden', tab !== 'novel');
    document.getElementById('tab-interactive').classList.toggle('tab-active', tab === 'interactive');
    document.getElementById('tab-interactive').classList.toggle('text-zinc-600', tab !== 'interactive');
    document.getElementById('tab-novel').classList.toggle('tab-active', tab === 'novel');
    document.getElementById('tab-novel').classList.toggle('text-zinc-600', tab !== 'novel');
}

export function applyMood(mood, theme) {
    const container = document.getElementById('main-container');
    
    // Remove old mood classes
    Object.values(moodMap).forEach(cls => container.classList.remove(cls));
    
    // Add new mood class
    const moodClass = moodMap[mood] || moodMap['default'];
    container.classList.add(moodClass);

    if (theme) {
        document.documentElement.style.setProperty('--bg-color', theme.bg || '#09090b');
        document.documentElement.style.setProperty('--accent-color', theme.accent || '#52525b');
    }
}

export function updateStatus(msg) {
    document.getElementById('status-msg').textContent = msg;
}

export function updateConnectionStatus(status, isReady) {
    const el = document.getElementById('connection-status');
    el.textContent = `• ${status}`;
    el.className = isReady ? 'text-emerald-900' : 'text-red-900';
}
