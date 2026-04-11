# AI Story Scribe: A Dynamic Interactive Narrative Engine

A minimalist, distraction-free interactive storytelling platform powered by local AI. Experience your own custom adventures in the first person while the engine automatically novelizes your journey into a persistent third-person log.

## ✨ Features

-   **🎭 Dual-Narrative Engine:** Engage in an immersive 1st-person interactive story that simultaneously generates a 3rd-person literary novelization.
-   **🌊 Real-Time Streaming:** Watch your story unfold word-by-word as the AI generates it, providing an "instant" and fluid narrative experience.
-   **🧠 Deep Conversation Context:** Powered by Ollama's Chat API, the engine maintains a full history of your adventure, allowing for complex plot points and consistent world-building.
-   **🎨 Dynamic Mood Orchestration:** The UI automatically shifts its background, accent colors, and CSS filters (hue/saturation) to match the current atmospheric mood of the story.
-   **🔌 Dynamic Core Selection:** Automatically detects and lets you choose from any model installed in your local [Ollama](https://ollama.com/) instance.
-   **📚 Story Library:** Manage multiple adventures with full CRUD support. Start new journeys, switch between existing ones, or delete old logs.
-   **🏗️ Modular Architecture:** A clean, professional codebase with concerns separated into dedicated CSS and JS modules for easy maintenance and scalability.

## 🚀 Getting Started

### Prerequisites

1.  **Ollama:** Install Ollama and pull at least one model (e.g., `ollama pull llama3.2`).
2.  **Node.js:** Ensure you have Node.js (v18+) installed.

### Setup & Launch

1.  **Install Dependencies:**
    ```bash
    cd server
    npm install
    ```

2.  **Start the Engine:**
    From the root directory:
    ```bash
    npm start
    ```
    
    *For development (includes automatic server restart on code changes):*
    ```bash
    npm run dev
    ```

3.  **Open the Scribe:**
    Navigate to `http://localhost:3000` in your browser.

## 📖 How to Play

1.  **Initialize:** Select your preferred AI model from the "Core" dropdown.
2.  **Library:** Use the sidebar (top-left icon) to create a new adventure or select an existing one.
3.  **Interact:** Type your actions to begin. The UI will stream the response and update the mood dynamically.
4.  **The Novel:** Switch to "The Novel" tab to read your entire adventure as a continuous story, with both 1st and 3rd-person perspective views.

## 🧪 Development

### Unit Testing
The middleware includes a suite of tests to ensure API stability:
```bash
npm test
```

---
*Built for local-first AI enthusiasts and storytellers.*
