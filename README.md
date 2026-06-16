# Tartan Scotty 🏴󠁧󠁢󠁳󠁣󠁴󠁿

**Tartan Scotty** is an AI-powered student assistant for Carnegie Mellon University in Qatar (CMU-Q). Students can ask questions about academics, campus life, registration, and more — and get answers grounded in official CMU-Q information.

---

## Features

- **Q&A Mode** — Ask anything about CMU-Q policies, registration, minors, scholarships, and student services. Answers come from an official knowledge base, not hallucinated facts.
- **Campus Guide Mode** — Interactive map navigator for finding rooms, offices, and buildings on campus.
- **Chat Mode** — Casual conversation with Scotty, still grounded in CMU-Q knowledge.
- **Tutor Mode** — Step-by-step academic tutoring. Scotty guides you toward answers rather than just giving them away.
- **Conversation History** — All chats are saved locally and organized into projects.
- **Claude-powered replies** — Uses Anthropic Claude for natural, grounded responses.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Create React App |
| Backend | Node.js, Express |
| AI Provider | Anthropic Claude API |
| Knowledge Retrieval | Custom RAG pipeline (keyword matching with fuzzy correction and alias expansion) |
| Avatar (optional) | LiveAvatar API |

---

## Project Structure

```
tartan-scotty/
├── src/                    # React frontend
│   ├── components/         # UI components (ChatInterface, MapNavigator, SideMenu, etc.)
│   ├── hooks/              # useConversations — chat history & project management
│   └── App.js              # Main app shell, mode switching, API calls
├── server/
│   ├── server.js           # Express API server (/api/chat, /api/liveavatar-token)
│   └── knowledgeBase.js    # Document loading, retrieval scoring, context building
├── knowledge-base/         # Official CMU-Q content (.txt files)
│   ├── studies/            # Registration, courses, minors, academic calendar
│   ├── life/               # Campus life, student services
│   └── help/               # StuCo, student forms, resources
└── scripts/                # Data processing utilities (map data, OCR)
```

---

## Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Anthropic API key — see Configuration below

---

## Setup & Running

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp server/.env.example server/.env
```

Open `server/.env` and fill in your API keys (see Configuration below).

### 3. Start the backend server

```bash
npm run server
```

The API server runs at `http://localhost:3001`.

### 4. Start the frontend (in a separate terminal)

```bash
npm start
```

The app opens at `http://localhost:3000`.

---

## Configuration (`server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_GATEWAY_BASE_URL` | Yes* | CMU AI Gateway URL: `https://ai-gateway.andrew.cmu.edu` |
| `CLAUDE_API_KEY` | Yes* | Your CMU AI Gateway token (for Claude) |
| `AI_MODEL` | No | Claude model (default: `us.anthropic.claude-haiku-4-5-20251001-v1:0`). Also: `claude-3-5-sonnet-20241022`, `claude-3-7-sonnet-20250219-v1:0` |
| `ANTHROPIC_API_KEY` | Alt | Use Claude directly from Anthropic instead of the CMU gateway (leave `AI_GATEWAY_BASE_URL` empty) |
| `LIVEAVATAR_API_KEY` | No | Optional — enables the AI avatar feature |
| `PORT` | No | Backend port (default: `3001`) |

\* Use either the CMU AI Gateway vars **or** `ANTHROPIC_API_KEY`, not both.

If no AI key is configured, the app falls back to returning raw knowledge base excerpts.

---

## Knowledge Base Format

Each `.txt` file in `knowledge-base/` follows this structure:

```
TOPIC: Registration and Schedule Planning
SECTION: studies
---
Content goes here. This is what Scotty will use to answer questions.
Multiple paragraphs are fine.
```

Files are organized into subdirectories (`studies/`, `life/`, `help/`) and loaded automatically at server startup.

---

## Architecture Overview

```
User
 │
 ▼
React Frontend (port 3000)
 │  POST /api/chat { messages, mode }
 ▼
Express Backend (port 3001)
 │
 ├── buildSystemPrompt(mode, userQuery)
 │     │
 │     └── retrieveRelevantDocsAsync(userQuery)
 │           └── Scores knowledge-base docs by keyword relevance
 │                 → Returns top matching documents
 │
 └── Claude API call (Anthropic)
       System prompt = role instructions + KB context
       → Returns grounded answer
```

Check retrieval status at runtime:

```bash
curl http://localhost:3001/api/kb/status
```

---

## Running Tests

```bash
npm test
npm run test:server
```

---

## Known Limitations

- **Retrieval is keyword-based**, not semantic embedding search.
- **No user authentication** — conversation history is stored in the browser's local storage only.
- **Knowledge base is static** — content must be manually updated as CMU-Q policies change.
- **Avatar feature** requires a paid LiveAvatar API key and is optional.

---

## Team

Built by students at Carnegie Mellon University in Qatar as part of the Emerging Technology course.
