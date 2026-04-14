const chapter = require('./chapter');

const axios = require('axios');
const OLLAMA_CHAT_URL = 'http://localhost:11434/api/chat';

const SLIDING_WINDOW_SIZE = 10; // Last 10 messages

function buildPrompt(storyId, chapterName) {
    const config = chapter.getStoryConfig(storyId);
    const chData = chapter.getChapterData(storyId, chapterName);
    
    if (!config || !chData) return null;

    // 1. System Prompt
    const systemPrompt = {
        role: "system",
        content: `You are an immersive storyteller. Respond in the FIRST PERSON.
        Integrate the user's action seamlessly into your narrative response.
        Provide the story response first, followed by the separator ###JSON###, then the mood metadata.
        
        STRICT OUTPUT FORMAT:
        [Narrative Text]
        ###JSON###
        {
            "mood": "eerie|serene|action|mystical|default",
            "theme_colors": { "bg": "#hex", "accent": "#hex" }
        }`
    };

    // 2. Global & Chapter Summary as Context
    const contextContent = `
    Global Story Summary: ${config.summary || 'Starting a new adventure.'}
    Current Chapter Summary: ${(chData.summary && chData.summary.plotPoints) ? chData.summary.plotPoints.join(', ') : 'No major events yet.'}
    Characters: ${(chData.summary && chData.summary.characters) ? chData.summary.characters.join(', ') : ''}
    Locations: ${(chData.summary && chData.summary.locations) ? chData.summary.locations.join(', ') : ''}
    `.trim();

    const contextMessage = {
        role: "system",
        content: `Current Context:\n${contextContent}`
    };

    // 3. Sliding Window of recent messages
    const recentMessages = chData.messages.slice(-SLIDING_WINDOW_SIZE);

    return [systemPrompt, contextMessage, ...recentMessages];
}

async function updateSummary(storyId, chapterName, model) {
    const config = chapter.getStoryConfig(storyId);
    const chData = chapter.getChapterData(storyId, chapterName);
    
    if (!config || !chData) return;

    // Use the last 20 messages for summarization context
    const recent = chData.messages.slice(-20);
    
    const summarizePrompt = [
        {
            role: "system",
            content: `You are an assistant that extracts structural elements of a story.
            Given a transcript of an interactive story, update the list of characters, locations, and major plot points.
            Respond ONLY with a JSON object: { \"characters\": [\"Name1\", \"Name2\"], \"locations\": [\"Place1\", \"Place2\"], \"plotPoints\": [\"Description1\", \"Description2\"] }`
        },
        {
            role: "user",
            content: `Current Summary:\n${JSON.stringify(chData.summary, null, 2)}\n\nRecent Transcript:\n${JSON.stringify(recent, null, 2)}`
        }
    ];

    try {
        const response = await axios.post(OLLAMA_CHAT_URL, { model, messages: summarizePrompt, stream: false });
        const content = response.data.message.content;
        
        // Robust JSON extraction
        const start = content.indexOf('{');
        const end = content.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            const jsonStr = content.substring(start, end + 1);
            const newSummary = JSON.parse(jsonStr);
            
            newSummary.lastUpdated = new Date().toISOString();
            
            // Save updated summary
            chapter.saveChapterData(storyId, chapterName, { summary: newSummary });
        }
    } catch (e) {
        console.error("Auto-summarization failed", e.message);
    }
}

function shouldSummarize(chData) {
    // Summarize every 5 user actions (10 messages total)
    return chData.messages.length > 0 && chData.messages.length % 10 === 0;
}

module.exports = {
    buildPrompt,
    updateSummary,
    shouldSummarize
};
