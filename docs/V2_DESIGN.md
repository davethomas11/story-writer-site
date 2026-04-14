# Design Document: Story Scribe V2 - Context & Structure Overhaul

## 1. Background & Motivation
The current "Interactive AI Story Scribe" handles stories as single JSON files. As stories grow, the performance degrades, and the AI's "memory" (context window) becomes saturated. Additionally, the distinction between 1st-person (interactive) and 3rd-person (novel) narratives is currently weak, leading to formatting issues and loss of tone.

## 2. Scope & Impact
- **Storage Migration:** Transition from single-file JSON/MD to a structured folder hierarchy.
- **Chapter System:** Introduce chapters to compartmentalize narratives and manage token usage.
- **Context Management:** Implement a sliding window for recent dialogue and a structured "Story Summary" for long-term memory.
- **Narrative Improvements:** AI-driven rewriting of user inputs into a 1st-person narrative and strictly enforced 3rd-person novelization.
- **Backward Compatibility:** A migration script to port V1 stories to the V2 structure.

## 3. Proposed Solution

### A. New Storage Schema
Each story will now reside in its own folder under `server/stories/`:
```text
server/stories/<sanitized-title>-<id>/
├── config.json (Global metadata, overall summary, model choice)
├── chapter-1/
│   ├── summary.json (Characters, locations, plot summary for this chapter)
│   ├── interactive.md (AI-rewritten 1st person narrative)
│   ├── novel.md (Formal 3rd person narrative)
│   └── messages.json (Recent message history for sliding window)
└── chapter-2/ (New chapters as the story grows)
```

### B. The Context Builder
A new module will construct the AI prompt by combining:
1.  **System Prompt:** Core instructions (Role, Tone, Formatting).
2.  **Global Summary:** High-level overview from `config.json`.
3.  **Chapter Summary:** Structured context from `chapter-X/summary.json`.
4.  **Sliding Window:** The last ~10 turns from `messages.json`.

### C. Narrative Workflow
1.  **User Input:** "I open the chest."
2.  **AI Step 1 (Narrative Update):** Rewrite input into 1st person ("I cautiously lift the heavy lid...") and describe the result.
3.  **AI Step 2 (Novelization):** Explicitly prompt the AI to write the event in 3rd person ("He reached for the lid, his heart pounding...").
4.  **AI Step 3 (Summary Maintenance):** Periodically update the `summary.json` with new characters or plot points.

### D. New UI Features
- **Chapter Browser:** Navigate between different chapters.
- **"Recompose" Button:** Re-trigger the AI to rewrite a section of the narrative.
- **Chapter Wrap-up:** A UI notification when a chapter reaches its "token budget," suggesting the user start a new one.

## 4. Alternatives Considered
- **Vector DB RAG:** Too complex for a local-first, minimalist app.
- **Simple Rolling Summary:** Too prone to losing details (like character names). A structured JSON summary is more reliable.

## 5. Phased Implementation Plan

### Phase 0: Documentation
-   **Store Design Document:** Save this markdown document to `docs/V2_DESIGN.md` in the repository for permanent reference.

### Phase 1: Foundation & Migration
-   Create a sanitization utility for folder names.
-   Write `server/migrate_stories.js` to convert `.json` files into the new folder structure.
-   Update `server/api.js` to use the new folder paths.

### Phase 2: API & Storage Refactor
-   Implement `config.json` and chapter subfolders.
-   Add endpoints for chapter management (`POST /stories/:id/chapters`, `GET /stories/:id/chapters/:num`).
-   Transition the frontend to handle folder-based story loading.

### Phase 3: Context & Summary Logic
-   Develop the "Sliding Window" utility.
-   Add an "Auto-Summarize" background task that triggers every N turns.
-   Refine the AI prompts for 1st-person and 3rd-person separation.

### Phase 4: UI/UX Enhancements
-   Add "Recompose" button to the UI.
-   Add "New Chapter" button and notification system.
-   Update the "The Novel" view to support multi-chapter reading.

## 6. Verification & Testing
- **Migration Test:** Run migration and verify all old stories load correctly in the new UI.
- **Sliding Window Test:** Ensure prompts sent to Ollama (visible in the Debug Console) are trimmed as expected.
- **Chapter Test:** Verify that starting a new chapter resets the "sliding window" while retaining the "Global Summary."


### Reference to user's original request:

AI Story Platform: Narrative & Architecture Overhaul
1. Narrative Consistency & Injection Strategy
   First-Person Narrative: The current implementation of first-person perspective is inconsistent. We should transition to a system where user prompts are captured, refined by the AI for tone/style, and then appended to the narrative.

Markdown Transition: All first-person narratives must be migrated to Markdown (.md) files to maintain consistency with the rest of the project’s storage logic.

Third-Person Enforcement: We need to update the system prompts to explicitly enforce a third-person perspective when that mode is active, as the model currently drifts between perspectives.

2. Retroactive Refinement Tools
   Recompose/Refactor Feature: To ensure backwards compatibility with older story segments, we need a "Recompose" button. This will trigger the AI to rewrite an entire existing narrative block to align with new style guidelines or structural updates.

3. Context & Summary Management
   Hierarchical Summaries: To prevent context window bloat, we need to implement structured summaries. These should be programmatically generated and include:

Character Profiles: Ongoing state, motivations, and current location.

World Building: Places of interest and established lore.

Scope: Summaries will exist at both the Chapter level (specific plot points) and the Global level (the "Book" summary) to give the AI a compressed but comprehensive view of the story.

4. Structural & File System Optimization
   File Organization: Move away from a flat file structure. Each story will reside in its own directory, named using a "slugified" version of the story title (sanitized for filesystem compatibility).

Chaptering: Introduce a formal chapter system where each chapter is stored in its own sub-folder. This allows for modular "recomposing" without having to process the entire story file at once.

5. Token Management & User UX
   Context Thresholds: We need to monitor token usage actively. When a chapter’s narrative and summary context reach a specific threshold (approaching the model's effective limit), the system should:

Calculate the total token weight.

Prompt the user to "Wrap Chapter" and bridge into a new file to maintain performance and focus.