#!/usr/bin/env node
/**
 * ElevenLabs TTS smoke check.
 *
 * Usage:
 *   npm run tts:smoke
 *
 * Expect when ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID are set in server/.env:
 *   GET  /api/tts/status  → { configured: true, provider: "elevenlabs" }
 *   POST /api/tts         → HTTP 200 and Content-Type: audio/mpeg
 *
 * In the browser: Network tab should show POST /api/tts 200 audio/mpeg,
 * and you should hear ElevenLabs — not the robotic system voice.
 * If /api/tts is 200 but you still hear speechSynthesis, that is a playback bug
 * (this app now fails loud instead of falling back).
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "server", ".env") });

const BASE = process.env.TTS_SMOKE_URL || `http://localhost:${process.env.PORT || 3001}`;

async function main() {
  const statusRes = await fetch(`${BASE}/api/tts/status`);
  const status = await statusRes.json().catch(() => ({}));
  console.log("GET /api/tts/status", statusRes.status, status);

  const ttsRes = await fetch(`${BASE}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Library rooms 1153 and 1155. Poetry Garden if you want air." }),
  });
  const contentType = ttsRes.headers.get("content-type") || "";
  const bytes = ttsRes.ok ? (await ttsRes.arrayBuffer()).byteLength : 0;
  console.log("POST /api/tts", ttsRes.status, contentType, bytes ? `${bytes} bytes` : "");

  if (!status.configured) {
    console.log("ElevenLabs keys are not configured. Browser TTS fallback is allowed.");
    process.exit(ttsRes.status === 500 ? 0 : 1);
  }

  if (ttsRes.status === 200 && contentType.includes("audio/mpeg") && bytes > 0) {
    console.log("OK — ElevenLabs is the voice path. In DevTools, confirm POST /api/tts 200 audio/mpeg.");
    process.exit(0);
  }

  const err = await ttsRes.json().catch(() => ({}));
  console.error("FAIL — keys are set but /api/tts did not return audio/mpeg.", err);
  process.exit(1);
}

main().catch((err) => {
  console.error("FAIL — is npm run server / npm run dev up?", err.message);
  process.exit(1);
});
