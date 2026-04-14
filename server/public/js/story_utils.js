/**
 * Robustly extract JSON from AI string that might contain markdown blocks or preamble.
 */
function extractJSON(str) {
    if (!str) return null;
    try {
        // 1. Try direct parse
        return JSON.parse(str);
    } catch (e) {
        try {
            // 2. Try stripping markdown blocks
            let clean = str.replace(/```json|```/g, '').trim();
            return JSON.parse(clean);
        } catch (e2) {
            try {
                // 3. Find first { and last }
                const start = str.indexOf('{');
                const end = str.lastIndexOf('}');
                if (start !== -1 && end !== -1) {
                    const jsonStr = str.substring(start, end + 1);
                    return JSON.parse(jsonStr);
                }
            } catch (e3) {
                console.warn("JSON extraction failed completely", str);
            }
        }
    }
    return null;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { extractJSON };
} else {
    // For browser/ESM
    window.extractJSON = extractJSON;
}
