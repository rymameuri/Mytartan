const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { getUserById } = require("./userStore");

const DEV_JWT_SECRET = "tartan-scotty-dev-jwt-secret-change-me";
let warnedDevSecret = false;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    if (!warnedDevSecret) {
      console.warn(
        "JWT_SECRET is not set; using insecure dev fallback. Set JWT_SECRET in server/.env for production."
      );
      warnedDevSecret = true;
    }
    return DEV_JWT_SECRET;
  }
  return secret;
}

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 10);
}

async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

function signToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), { expiresIn: "7d" });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
}

function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function attachUserFromToken(req, decoded) {
  if (!decoded?.userId) return false;
  const user = getUserById(decoded.userId);
  if (!user) return false;
  req.user = { id: user.id, email: user.email, profile: user.profile };
  return true;
}

function requireAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const decoded = verifyToken(token);
  if (!decoded || !attachUserFromToken(req, decoded)) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  return next();
}

function optionalAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      attachUserFromToken(req, decoded);
    }
  }
  return next();
}

module.exports = {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  requireAuth,
  optionalAuth,
};
