export const settings = {
    musicEnabled: localStorage.getItem('setting_music_enabled') !== 'false',
    autoMusic: localStorage.getItem('setting_auto_music') !== 'false'
};

export function updateSetting(key, value) {
    settings[key] = value;
    localStorage.setItem(`setting_${key.replace(/([A-Z])/g, '_$1').toLowerCase()}`, value);
    
    // Trigger side effects
    if (key === 'musicEnabled') {
        import('./music.js').then(m => {
            if (value) m.startEngine();
            else m.stopEngine();
        });
    }
}

export function loadSettingsToUI() {
    document.getElementById('setting-music-enabled').checked = settings.musicEnabled;
    document.getElementById('setting-auto-music').checked = settings.autoMusic;
}
