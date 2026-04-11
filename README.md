# AI Story Scribe: A Dynamic Interactive Narrative Engine

A minimalist, distraction-free interactive storytelling platform powered by local AI. Experience your own custom adventures in the first person while the engine automatically novelizes your journey into a persistent third-person log.

## ✨ Features

-   **🎭 Dual-Narrative Engine:** Engage in an immersive 1st-person interactive story that simultaneously generates a 3rd-person literary novelization.
-   **🔌 Dynamic Core Selection:** Automatically detects and lets you choose from any model installed in your local [Ollama](https://ollama.com/) instance (e.g., `llama3.2`, `mistral`, `qwen2.5-coder`).
-   **📓 Persistent Adventure Logs:** Save your journey at any time to `novel.md` to review your adventure as a formal book.
-   **🌑 Minimalist Aesthetic:** A clean, modern dark-themed UI built with Tailwind CSS, designed for deep focus and immersion.
-   **🛠️ Robust Middleware:** A Node.js/Express backend that handles API orchestration, CORS management, and file persistence.

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
2.  **Interact:** Type your first action or a story prompt (e.g., *"I wake up in a field of neon flowers"*) to begin.
3.  **Persist:** Click "Persist to Log" to save your current adventure to `novel.md`.

## 🧪 Development

### Unit Testing
The middleware includes a suite of tests to ensure API stability:
```bash
npm test
```

---
*Built for local-first AI enthusiasts and storytellers.*
