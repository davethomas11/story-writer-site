const MidiWriter = require('midi-writer-js');
const fs = require('fs');
const path = require('path');

function sanitizeFolderName(title, id) {
    if (!title) return id;
    
    // Convert to lowercase, replace non-alphanumeric with hyphen
    const clean = title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    
    const base = clean || 'story';
    // If the clean title is exactly the same as id (or empty), just use id
    if (base === id) return id;
    
    return `${base}-${id}`;
}

/**
 * Converts a JSON music score into a MIDI file.
 * @param {Object} score - { bpm: number, tracks: [{ instrument: string, notes: [{ pitch: string, duration: string, time: string }] }] }
 * @param {string} outputPath - Full path to save the .mid file
 */
function generateMidi(score, outputPath) {
    if (!score || !score.tracks) return;

    const tracks = [];

    score.tracks.forEach(t => {
        const track = new MidiWriter.Track();
        track.setTempo(score.bpm || 120);
        track.addTrackName(t.name || 'Track');
        
        // midi-writer-js handles note events
        t.notes.forEach(note => {
            track.addEvent(new MidiWriter.NoteEvent({
                pitch: note.pitch,
                duration: note.duration,
                startTick: note.tick // We'll use ticks for precise timing if provided
            }));
        });
        
        tracks.push(track);
    });

    const write = new MidiWriter.Writer(tracks);
    fs.writeFileSync(outputPath, write.buildFile());
}

module.exports = {
    sanitizeFolderName,
    generateMidi
};
