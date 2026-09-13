const crypto = require("crypto");

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function createToken(ttlMs) {
  const token = crypto.randomBytes(32).toString("hex");
  return {
    token,
    hash: hashToken(token),
    expiresAt: Date.now() + ttlMs,
  };
}

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

module.exports = {
  hashToken,
  createToken,
  VERIFY_TTL_MS,
  RESET_TTL_MS,
};
