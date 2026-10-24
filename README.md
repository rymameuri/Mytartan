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
| AI Provider | Anthropic Claude API, CMU AI Gateway, or Hugging Face Inference Providers |
| Knowledge Retrieval | Custom RAG pipeline (keyword matching with fuzzy correction and alias expansion) |
| Avatar (optional) | LiveAvatar API |
| Voice persona | ElevenLabs TTS (talking mascot image) |

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
| `AI_PROVIDER` | No | `claude` (default), `huggingface`, or `hf` |
| `AI_GATEWAY_BASE_URL` | Yes* | CMU AI Gateway URL: `https://ai-gateway.andrew.cmu.edu` |
| `CLAUDE_API_KEY` | Yes* | Your CMU AI Gateway token (for Claude) |
| `AI_MODEL` | No | Claude model (default: `claude-haiku-4-5-20251001-v1:0`). Also: `claude-sonnet-4-20250514-v1:0`, `gpt-5-nano`, `gpt-5.4-mini` |
| `ANTHROPIC_API_KEY` | Alt | Use Claude directly from Anthropic instead of the CMU gateway (leave `AI_GATEWAY_BASE_URL` empty) |
| `HUGGINGFACE_API_KEY` | Alt | Hugging Face token with **Inference Providers** permission (use with `AI_PROVIDER=huggingface`) |
| `HUGGINGFACE_MODEL` | No | HF model id (default: `deepseek-ai/DeepSeek-V4-Flash-0731`) |
| `HF_REASONING_EFFORT` | No | Optional DeepSeek reasoning level: `low`, `high`, or `max` |
| `LIVEAVATAR_API_KEY` | No | Optional — legacy LiveAvatar video avatar |
| `ELEVENLABS_API_KEY` | No | ElevenLabs API key for talking mascot voice |
| `ELEVENLABS_VOICE_ID` | No | ElevenLabs voice ID (required with `ELEVENLABS_API_KEY`) |
| `ELEVENLABS_MODEL_ID` | No | TTS model (default: `eleven_flash_v2_5`, the low-latency model). Set `eleven_multilingual_v2` if a cloned voice rejects flash. |
| `PORT` | No | Backend port (default: `3001`) |

\* Use either the CMU AI Gateway vars **or** `ANTHROPIC_API_KEY`, or set `AI_PROVIDER=huggingface` with `HUGGINGFACE_API_KEY` — not multiple providers at once.

If no AI key is configured, the app falls back to returning raw knowledge base excerpts.

### Troubleshooting: `getaddrinfo ENOTFOUND ai-gateway.andrew.cmu.edu`

The CMU AI Gateway hostname is only resolvable on CMU networks. If you see this error (common from CMU-Q or off-campus):

1. Install **Cisco AnyConnect** (CMU software center).
2. Connect to the **Pittsburgh campus VPN**: `vpn.cmu.edu` (not just `vpn.qatar.cmu.edu`).
3. Restart the backend: `cd server && npm start`.
4. Verify DNS resolves: `ping ai-gateway.andrew.cmu.edu` — you should get an IP, not "Unknown host".

If it still fails after Pittsburgh VPN, contact your course admin or `it-help@cmu.edu` — the gateway may not be reachable from your region yet.

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

Files are organized into subdirectories (`studies/`, `life/`, `help/`, `mycmuq/`) and loaded automatically at server startup.

### Topic suggestions (sidebar)

When you add or expand KB pages, also update **`src/data/topicSuggestions.js`** so students can discover new topics from the sidebar. Each entry should include:

- `label` — short name shown in the UI
- `prompt` — natural question sent to Scotty (should match how students ask)
- `kbPath` — optional path under `knowledge-base/` for maintainers

Run `npm test -- --testPathPattern=topicSuggestions` to verify every `kbPath` still exists.

**Full developer manual:** [MANUAL/DEVELOPER_GUIDE.txt](MANUAL/DEVELOPER_GUIDE.txt) — KB workflow, commands, troubleshooting, and pre-merge checklist.

### KB maintenance pipeline

When CMU-Q information changes, use this workflow:

1. **Edit content** — update the relevant `.txt` under `knowledge-base/` (and `data/key-facts.json` for deadlines, fees, or GPA cutoffs).
2. **Sync manifest** (if you added or removed files) — `npm run kb:sync-manifest`
3. **Validate** — `npm run kb:validate` (headers, manifest, tests, retrieval eval)
4. **Restart server** and spot-check — `curl "http://localhost:3001/api/kb/debug?q=YOUR+QUESTION"`

| Change type | Edit | Also update |
|-------------|------|-------------|
| Deadline / fee / GPA | KB `.txt` | `data/key-facts.json` (`lastVerified` to today) |
| New portal page | New `.txt` | `npm run kb:sync-manifest`, `src/data/topicSuggestions.js`, optional `data/synonyms.json` |
| Student slang / abbreviation | — | `data/synonyms.json` |
| Removed page | Delete `.txt` | `npm run kb:sync-manifest`, remove from `topicSuggestions.js` and `eval/golden-set.json` |

**Commands:**

| Command | Purpose |
|---------|---------|
| `npm run kb:sync-manifest` | Regenerate `knowledge-base/manifest.json` and `mycmuq/index.json` from disk |
| `npm run kb:validate` | Run full validation pipeline before shipping KB changes |
| `npm run kb:eval` | Retrieval eval only (`eval/golden-set.json`, hit@3 ≥ 75%) |
| `python scripts/clean_knowledge_base.py --apply` | Fix formatting (whitespace, duplicate lines) |
| `GET /api/kb/debug?q=...` | Inspect which chunks match a question (no LLM call) |

**Optional header** for tracking updates:

```
LAST_UPDATED: 2026-06-24
```

The manifest sync script reads this into `knowledge-base/manifest.json`.

**Registry:** [`knowledge-base/manifest.json`](knowledge-base/manifest.json) lists all 176 KB files with `path`, `topic`, `section`, `sourceUrl`, and optional coupling fields (`synonyms`, `keyFactIds`, `topicSuggestionLabel`) you can set manually — they are preserved across syncs.

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

When using Hugging Face instead of Claude:

```bash
# server/.env
AI_PROVIDER=huggingface
HUGGINGFACE_API_KEY=hf_your_token
HUGGINGFACE_MODEL=deepseek-ai/DeepSeek-V4-Flash-0731
```

Scotty then calls `https://router.huggingface.co/v1/chat/completions` with the same system prompt and message history.
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
npm run kb:validate    # full KB pipeline (headers, manifest, retrieval eval)
npm run kb:eval        # retrieval eval only
```

---

## Known Limitations

- **Retrieval is keyword-based**, not semantic embedding search.
- **No user authentication** — conversation history is stored in the browser's local storage only.
- **Knowledge base is static** — content must be manually updated as CMU-Q policies change.
- **Avatar feature** uses your mascot image with ElevenLabs voice (or browser TTS fallback). Legacy LiveAvatar video is optional.

---

## Team

Built by students at Carnegie Mellon University in Qatar as part of the Emerging Technology course.
