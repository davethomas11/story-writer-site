# The Void Echo: Interactive AI Story Scribe

A minimalist, deep-space thriller game powered by local AI. Experience the story in the first person while the game automatically novelizes your journey into a third-person book.

## Architecture

-   **Frontend:** A modern, minimalist UI built with Tailwind CSS.
-   **Middleware:** A Node.js server that proxies requests to Ollama and manages file persistence.
-   **AI Core:** Powered by [Ollama](https://ollama.com/) (running `llama3` by default).

## Prerequisites

1.  **Ollama:** Install Ollama and pull the model you wish to use (e.g., `ollama pull llama3`).
2.  **Node.js:** Ensure you have Node.js installed on your machine.

## Setup

1.  **Start the Middleware Server:**
    ```bash
    cd server
    npm install
    node index.js
    ```
    The server will run on `http://localhost:3000`.

2.  **Launch the Game:**
    Open `index.html` in your favorite web browser.

## How to Play

1.  **Interact:** Type your actions into the input box at the bottom (e.g., "Look for a way out," "Check the terminal").
2.  **Immerse:** The AI will respond in the first person, continuing your story.
3.  **Persist:** Click "Persist to Log" to save the third-person novelization of your adventure to `novel.md`.

## Development

### Running Tests
```bash
cd server
npm test
```
*(Note: Requires `jest` and `supertest` to be installed in the server directory)*
