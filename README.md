# Tartan Scotty 🏴󠁧󠁢󠁳󠁣󠁴󠁿

**Tartan Scotty** is an AI-powered student assistant for Carnegie Mellon University in Qatar (CMU-Q). Students can ask questions about academics, campus life, registration, and more — and get answers grounded in official CMU-Q information.

---

## Features

- **Q&A Mode** — Ask anything about CMU-Q policies, registration, minors, scholarships, and student services. Answers come from an official knowledge base, not hallucinated facts.
- **Campus Guide Mode** — Interactive map navigator for finding rooms, offices, and buildings on campus.
- **Chat Mode** — Casual conversation with Scotty, still grounded in CMU-Q knowledge.
- **Tutor Mode** — Step-by-step academic tutoring. Scotty guides you toward answers rather than just giving them away.
- **Conversation History** — All chats are saved locally and organized into projects.
- **Dual AI Backend** — Supports both HuggingFace (open-source models) and Anthropic (Claude) as the LLM provider.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Create React App |
| Backend | Node.js, Express |
| AI Providers | HuggingFace Inference API, Anthropic Claude API |
| Knowledge Retrieval | Custom RAG pipeline (keyword-based retrieval over a structured knowledge base) |
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
- At least one AI API key (HuggingFace or Anthropic) — see Configuration below

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
| `HUGGINGFACE_API_KEY` | One of these two | Free at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) |
| `ANTHROPIC_API_KEY` | One of these two | Get at [console.anthropic.com](https://console.anthropic.com) |
| `HF_MODEL` | No | HuggingFace model to use (default: `meta-llama/Meta-Llama-3-8B-Instruct`) |
| `LIVEAVATAR_API_KEY` | No | Optional — enables the AI avatar feature |
| `PORT` | No | Backend port (default: `3001`) |

If neither AI key is configured, the app falls back to returning raw knowledge base excerpts.

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
 │     └── retrieveRelevantDocs(userQuery)
 │           └── Scores knowledge-base docs by keyword relevance
 │                 → Returns top-2 matching documents
 │
 └── LLM API call (HuggingFace or Anthropic)
       System prompt = role instructions + KB context
       → Returns grounded answer
```

---

## Running Tests

```bash
npm test
```

---

## Known Limitations

- **Retrieval is keyword-based**, not semantic. A production version would use text embeddings and cosine similarity for better accuracy.
- **No user authentication** — conversation history is stored in the browser's local storage only.
- **Knowledge base is static** — content must be manually updated as CMU-Q policies change.
- **Avatar feature** requires a paid LiveAvatar API key and is optional.

---

## Team

Built by students at Carnegie Mellon University in Qatar as part of the Emerging Technology course.
