# AI Story Scribe: A Dynamic Interactive Narrative Engine

A minimalist, distraction-free interactive storytelling platform powered by local AI. Experience your own custom adventures in the first person while the engine automatically novelizes your journey into a persistent third-person log.

## ✨ Features

-   **🎭 Dual-Narrative Engine:** Engage in an immersive 1st-person interactive story that simultaneously generates a 3rd-person literary novelization.
-   **🤝 Real-Time Collaboration:** Powered by WebSockets (Socket.io), multiple users can explore the same story together. See what others are typing and watch AI responses stream across all devices simultaneously.
-   **👤 Persistent Explorer Profiles:** Create your unique explorer identity. Usernames and IDs are persisted both on the server and locally, ensuring you're recognized across sessions.
-   **📍 Presence & Activity Tracking:** See who else is online and which adventure they are currently exploring with real-time indicators and a detailed "Active Explorers" modal.
-   **⌨️ Narrative Turn Locking:** Animated typing indicators prevent narrative collisions by showing who is currently "directing" the story and temporarily locking input for others.
-   **🌊 Real-Time Streaming:** Watch your story unfold word-by-word as the AI generates it, mirrored instantly to all connected explorers.
-   **🎨 Surface & Layer Design System:** A robust high-contrast UI that automatically shifts backgrounds and accents to match the story's mood while maintaining perfect readability.
-   **🔗 Deep Linking:** Story and tab states are synced to the URL, allowing for easy sharing and persistence across page refreshes.
-   **🏗️ Refactored Modular Architecture:** Clean separation of concerns with dedicated modules for API communication, WebSocket logic, UI orchestration, and story state management.

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

1.  **Identity:** Click the **Profile** button in the header to set your Explorer name.
2.  **Initialize:** Select your preferred AI model from the "Core" dropdown.
3.  **Library:** Use the sidebar (top-left icon) to create a new adventure, select an existing one, or rename your journey.
4.  **Collaboration:** See the "Online" indicator in the header to view other active users and the stories they are reading.
5.  **Interact:** Type your actions. If another user is already typing, your input will be temporarily locked to maintain narrative flow.
6.  **The Novel:** Switch to "The Novel" tab to read your journey as a continuous literary work.

## 🛠️ Architecture

-   **Frontend:** Vanilla JS (ES Modules), Tailwind CSS, Socket.io Client.
-   **Backend:** Node.js, Express 5, Socket.io Server.
-   **AI Core:** Local Ollama instance (required).
-   **Persistence:** Hybrid JSON/Markdown storage for stories; JSON for user profiles.

---
*Built for local-first AI enthusiasts and collaborative storytellers.*
