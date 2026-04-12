import { API_BASE } from './config.js';

export let userId = localStorage.getItem('story_scribe_user_id');
export let username = localStorage.getItem('story_scribe_username') || 'Explorer';

export function setUserId(id) {
    userId = id;
    localStorage.setItem('story_scribe_user_id', id);
}

export function setUsername(name) {
    username = name;
    localStorage.setItem('story_scribe_username', name);
    
    // Update UI
    const btn = document.getElementById('btn-profile');
    if (btn) btn.textContent = `Profile: ${name}`;

    const display = document.getElementById('user-name-display');
    if (display) display.textContent = name;
}

const getHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (userId) headers['x-user-id'] = userId;
    return headers;
};

export async function fetchProfile(id) {
    const res = await fetch(`${API_BASE}/profile/${id}`);
    if (!res.ok) throw new Error('Failed to load profile');
    return await res.json();
}

export async function updateProfile(userId, username) {
    const res = await fetch(`${API_BASE}/profile`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userId, username })
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return await res.json();
}

export async function fetchModels() {
    const res = await fetch(`${API_BASE}/models`);
    if (!res.ok) throw new Error('Failed to fetch models');
    return await res.json();
}

export async function fetchStories() {
    const res = await fetch(`${API_BASE}/stories`);
    if (!res.ok) throw new Error('Failed to list stories');
    return await res.json();
}

export async function fetchStoryById(id) {
    const res = await fetch(`${API_BASE}/stories/${id}`);
    if (!res.ok) throw new Error('Failed to load story');
    return await res.json();
}

export async function createStory(title) {
    const res = await fetch(`${API_BASE}/stories`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ title })
    });
    if (!res.ok) throw new Error('Failed to create story');
    return await res.json();
}

export async function updateStory(id, data) {
    const res = await fetch(`${API_BASE}/stories/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update story');
    return await res.json();
}

export async function deleteStory(id) {
    const res = await fetch(`${API_BASE}/stories/${id}`, { 
        method: 'DELETE',
        headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete story');
    return await res.json();
}

export async function callChat(model, messages, stream = false) {
    const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream })
    });
    if (!res.ok) throw new Error('Ollama connection failed');
    return res;
}

export async function streamChat(model, messages, onChunk) {
    const res = await callChat(model, messages, true);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let fullContent = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Ollama sends multiple JSON objects in one stream chunk sometimes
        const lines = chunk.split('\n').filter(l => l.trim());
        for (const line of lines) {
            try {
                const json = JSON.parse(line);
                if (json.message && json.message.content) {
                    fullContent += json.message.content;
                    onChunk(json.message.content, fullContent);
                }
                if (json.done) break;
            } catch (e) {
                console.warn("Failed to parse stream line", line);
            }
        }
    }
    return fullContent;
}

export async function callGenerate(model, prompt) {
    const res = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false })
    });
    if (!res.ok) throw new Error('Ollama connection failed');
    const data = await res.json();
    return data.response;
}
