import { settings } from './settings.js';
import * as ui from './ui.js';
import * as api from './api.js';

export let isStarted = false;
export let currentScore = null;
let currentPart = null;

// Analysis
export const analyser = new Tone.Analyser('fft', 256);
analyser.toDestination(); // Connect analyser to final output

// Synthesizers
const padSynth = new Tone.PolySynth(Tone.Synth).connect(analyser);
padSynth.set({
    oscillator: { type: 'sine' },
    envelope: { attack: 2, decay: 1, sustain: 0.8, release: 3 }
});
padSynth.volume.value = -12;

const leadSynth = new Tone.Synth().connect(analyser);
leadSynth.set({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.8 }
});
leadSynth.volume.value = -18;

// Reverb/Delay for atmosphere
const reverb = new Tone.Reverb(4).connect(analyser);
padSynth.connect(reverb);
leadSynth.connect(reverb);

export async function startEngine() {
    if (isStarted) return;
    await Tone.start();
    isStarted = true;
    console.log("Music Engine Started");
    
    if (currentScore) playScore(currentScore);
}

export function stopEngine() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    isStarted = false;
}

export function toggleMusic() {
    if (!isStarted) {
        startEngine();
        ui.updateMusicUI(true, !!currentScore);
    } else {
        stopEngine();
        ui.updateMusicUI(false, !!currentScore);
    }
}

export function previewNote(pitch, duration, instrument) {
    if (!isStarted) return;
    const toneDuration = duration === '1' ? '1n' : 
                         duration === '2' ? '2n' : 
                         duration === '4' ? '4n' : 
                         duration === '8' ? '8n' : '8n';
                         
    if (instrument === 'pad') {
        padSynth.triggerAttackRelease(pitch, toneDuration);
    } else {
        leadSynth.triggerAttackRelease(pitch, toneDuration);
    }
}

export function playScore(score) {
    currentScore = score;
    if (!settings.musicEnabled) return;
    
    if (!isStarted) {
        ui.updateMusicUI(false, true);
        return;
    }

    stopPlayback();

    Tone.Transport.bpm.value = score.bpm || 80;

    const events = [];
    score.tracks.forEach(track => {
        track.notes.forEach(note => {
            events.push({
                time: note.tick, 
                pitch: note.pitch,
                duration: note.duration === '1' ? '1n' : 
                          note.duration === '2' ? '2n' : 
                          note.duration === '4' ? '4n' : 
                          note.duration === '8' ? '8n' : '8n',
                instrument: track.instrument,
                tick: note.tick
            });
        });
    });

    // Tone.js Part expects events sorted by time if provided in constructor
    events.sort((a, b) => a.time - b.time);

    if (events.length === 0) {
        console.warn("No music events to play");
        return;
    }

    const TICKS_PER_STEP = 80;

    currentPart = new Tone.Part((time, event) => {
        if (event.instrument === 'pad') {
            padSynth.triggerAttackRelease(event.pitch, event.duration, time);
        } else {
            leadSynth.triggerAttackRelease(event.pitch, event.duration, time);
        }
        
        // Notify DAW of current step
        const step = Math.floor(event.tick / TICKS_PER_STEP);
        Tone.Draw.schedule(() => {
            const grid = document.getElementById('daw-grid');
            if (grid) {
                grid.querySelectorAll('.daw-column-highlight').forEach(el => el.classList.remove('daw-column-highlight'));
                grid.querySelectorAll(`[data-step="${step}"]`).forEach(el => el.classList.add('daw-column-highlight'));
            }
        }, time);

    }, events.map(e => ({ ...e, time: e.time / 1280 * Tone.Time('1n').toSeconds() })));

    currentPart.loop = true;
    const maxTick = Math.max(...events.map(e => e.time + 1280));
    currentPart.loopEnd = maxTick / 1280 * Tone.Time('1n').toSeconds();
    currentPart.start(0);
    
    Tone.Transport.start();
    ui.updateMusicStatus(score);
}

export function stopPlayback() {
    if (currentPart) {
        currentPart.stop();
        currentPart.dispose();
        currentPart = null;
    }
    Tone.Transport.stop();
    Tone.Transport.cancel();
    
    // Clear highlights
    const grid = document.getElementById('daw-grid');
    if (grid) {
        grid.querySelectorAll('.daw-column-highlight').forEach(el => el.classList.remove('daw-column-highlight'));
    }
}

export async function generateNewMusic(storyId, mood, summary) {
    try {
        ui.updateStatus('Composing music...');
        
        // Dynamically get the selected model
        const storyModule = await import('./story.js');
        const model = storyModule.selectedModel || 'llama3';
        
        const response = await api.generateMusic(storyId, model, mood, summary);
        if (response.music) {
            playScore(response.music);
            // Save it back to the chapter
            if (storyModule.currentStory) {
                storyModule.currentStory.music = response.music;
                api.updateStory(storyModule.currentStory.id, storyModule.currentStory);
            }
        }
        ui.updateStatus('');
    } catch (err) {
        console.error("Music gen failed", err);
        ui.updateStatus('Music composition failed.');
    }
}
