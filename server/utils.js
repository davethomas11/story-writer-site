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

module.exports = {
    sanitizeFolderName
};
