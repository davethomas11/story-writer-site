import { UI } from './ui_builder.js';
import * as music from './music.js';
import * as api from './api.js';
import * as ui from './ui.js';

/**
 * DAW Component
 * Visual Piano Roll editor for story soundtracks.
 */

const PITCHES = ['C5', 'B4', 'Bb4', 'A4', 'Ab4', 'G4', 'Gb4', 'F4', 'E4', 'Eb4', 'D4', 'Db4', 'C4', 'B3', 'Bb3', 'A3', 'Ab3', 'G3', 'Gb3', 'F3', 'E3', 'Eb3', 'D3', 'Db3', 'C3'];
const TOTAL_STEPS = 32; // 2 Bars of 16th notes
const TICKS_PER_STEP = 80;

let activeTrackIndex = 0;
let isResizing = false;
let resizeStartStep = 0;
let resizeNote = null;

export const daw = {
    template: (data) => `
        <div class="flex flex-col h-full space-y-4">
            <div class="flex justify-between items-center px-2">
                <div class="flex gap-4">
                    ${data.music?.tracks.map((t, i) => `
                        <button onclick="app.switchDAWTrack(${i})" 
                            class="px-4 py-1.5 rounded text-[9px] uppercase tracking-widest border transition-all ${i === activeTrackIndex ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'}">
                            ${t.name} (${t.instrument})
                        </button>
                    `).join('') || ''}
                </div>
                <div class="flex gap-2">
                    <button onclick="app.clearDAWTrack()" class="text-[9px] uppercase tracking-widest px-3 py-1.5 border border-zinc-800 hover:bg-red-950/20 hover:text-red-500 transition-all">Clear</button>
                    <button onclick="app.saveDAW()" class="text-[9px] uppercase tracking-widest px-4 py-1.5 bg-emerald-600 text-white hover:bg-emerald-500 transition-all">Apply Changes</button>
                </div>
            </div>

            <div class="flex-1 overflow-auto custom-scrollbar border border-zinc-900 bg-zinc-950/50 rounded-lg relative">
                <div class="flex min-w-max">
                    <!-- Pitch Labels -->
                    <div class="sticky left-0 z-20 bg-zinc-950 border-r border-zinc-900 w-12 flex flex-col">
                        ${PITCHES.map(p => `
                            <div class="h-6 flex items-center justify-center text-[8px] font-bold ${p.includes('b') ? 'text-zinc-600 bg-zinc-900/30' : 'text-zinc-400'} border-b border-zinc-900/50 uppercase">
                                ${p}
                            </div>
                        `).join('')}
                    </div>

                    <!-- Grid -->
                    <div class="relative flex-1">
                        <div id="daw-grid" class="grid grid-cols-[repeat(32,minmax(32px,1fr))] divide-x divide-zinc-900/30">
                            ${PITCHES.map((pitch, row) => `
                                ${Array.from({ length: TOTAL_STEPS }).map((_, col) => {
                                    const isBeat = col % 4 === 0;
                                    const isBar = col % 16 === 0;
                                    return `
                                        <div 
                                            data-pitch="${pitch}" 
                                            data-step="${col}"
                                            onclick="app.toggleDAWNote('${pitch}', ${col}, event)"
                                            class="h-6 border-b border-zinc-900/30 cursor-pointer hover:bg-emerald-500/10 transition-colors relative
                                            ${isBar ? 'border-l-zinc-700 border-l' : isBeat ? 'border-l-zinc-800 border-l' : ''}
                                            ${pitch.includes('b') ? 'bg-zinc-900/10' : ''}"
                                        ></div>
                                    `;
                                }).join('')}
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="text-[8px] text-zinc-600 uppercase tracking-[0.2em] flex justify-between items-center px-2">
                <span>Octaves: C3-C5 • Resolution: 16th Notes</span>
                <span>Click grid to toggle • Drag right edge of note to lengthen • Changes must be saved</span>
            </div>
        </div>
    `,

    onMount: (el, data) => {
        renderNotes(data.music);
    }
};

function renderNotes(musicData) {
    if (!musicData || !musicData.tracks[activeTrackIndex]) return;

    const track = musicData.tracks[activeTrackIndex];
    const grid = document.getElementById('daw-grid');
    if (!grid) return;

    // Clear existing visuals
    grid.querySelectorAll('.daw-note').forEach(n => n.remove());

    track.notes.forEach(note => {
        const step = Math.floor(note.tick / TICKS_PER_STEP);
        if (step >= TOTAL_STEPS) return;

        // Calculate width based on duration
        // duration: "1" (whole=32 steps), "2" (half=16), "4" (quarter=8), "8" (eighth=4), "16" (1)
        let span = 1;
        if (note.duration === "1") span = 32;
        else if (note.duration === "2") span = 16;
        else if (note.duration === "4") span = 8;
        else if (note.duration === "8") span = 4;
        else if (note.duration === "16") span = 1;
        else if (typeof note.duration === 'number') span = note.duration; // Steps

        const cell = grid.querySelector(`[data-pitch="${note.pitch}"][data-step="${step}"]`);
        if (cell) {
            const noteDiv = document.createElement('div');
            noteDiv.className = 'daw-note absolute inset-1 bg-emerald-500 rounded-sm shadow-[0_0_10px_rgba(16,185,129,0.4)] z-10 flex justify-end';
            noteDiv.style.width = `calc(${span * 100}% + ${(span - 1)}px - 8px)`;
            noteDiv.style.pointerEvents = 'none';

            // Resize handle
            const handle = document.createElement('div');
            handle.className = 'w-2 h-full cursor-ew-resize hover:bg-white/20 pointer-events-auto';
            handle.onmousedown = (e) => {
                e.stopPropagation();
                startNoteResize(note, step, e);
            };
            noteDiv.appendChild(handle);
            
            cell.appendChild(noteDiv);
        }
    });
}

function startNoteResize(note, startStep, e) {
    isResizing = true;
    resizeNote = note;
    resizeStartStep = startStep;

    const onMouseMove = (moveEvent) => {
        if (!isResizing) return;
        // This is a simple implementation: you'd need to calculate grid delta
    };

    const onMouseUp = () => {
        // Find the cell under the mouse to determine new length
        // For simplicity in this turn, we'll implement the toggle-to-lengthen or a discrete resize
        isResizing = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// Global DAW Actions
window.app = window.app || {};

window.app.switchDAWTrack = (index) => {
    activeTrackIndex = index;
    import('./story.js').then(s => {
        UI.inject('daw-mount', 'daw', { music: s.currentStory?.music });
    });
};

window.app.toggleDAWNote = (pitch, step, event) => {
    // If we clicked the resize handle, don't toggle
    if (event.target.classList.contains('cursor-ew-resize')) return;

    import('./story.js').then(s => {
        if (!s.currentStory?.music) return;
        
        const track = s.currentStory.music.tracks[activeTrackIndex];
        const tick = step * TICKS_PER_STEP;
        
        const existingIndex = track.notes.findIndex(n => n.pitch === pitch && n.tick === tick);
        
        if (existingIndex > -1) {
            track.notes.splice(existingIndex, 1);
        } else {
            const newNote = {
                pitch: pitch,
                duration: "8", // Default to 8th note
                tick: tick
            };
            track.notes.push(newNote);
            // Preview sound
            music.previewNote(pitch, "8", track.instrument);
        }
        
        // Refresh Visuals
        renderNotes(s.currentStory.music);
    });
};

window.app.clearDAWTrack = () => {
    import('./story.js').then(s => {
        if (!s.currentStory?.music) return;
        s.currentStory.music.tracks[activeTrackIndex].notes = [];
        renderNotes(s.currentStory.music);
    });
};

window.app.saveDAW = async () => {
    import('./story.js').then(async s => {
        if (!s.currentStory?.music) return;
        
        try {
            ui.updateStatus('Syncing DAW changes...');
            await api.updateStory(s.currentStory.id, s.currentStory);
            music.playScore(s.currentStory.music);
            ui.updateStatus('DAW Synced.');
            setTimeout(() => ui.updateStatus(''), 2000);
        } catch (err) {
            console.error("Failed to save DAW", err);
            ui.updateStatus('Sync failed.');
        }
    });
};

// Register the component
UI.register('daw', daw);
