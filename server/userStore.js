const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const USERS_FILE = path.join(__dirname, "..", "data", "users.json");

function ensureUsersFile() {
  const dir = path.dirname(USERS_FILE);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "[]", "utf8");
  }
}

function readUsers() {
  ensureUsersFile();
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  ensureUsersFile();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

function defaultProfile() {
  return {
    preferredName: null,
    learningStyle: null,
    intendedUse: null,
    major: null,
    graduationDate: null,
    onboardingComplete: false,
  };
}

function getUserByEmail(email) {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return null;
  return readUsers().find((user) => user.email?.toLowerCase() === normalized) ?? null;
}

function getUserById(id) {
  if (!id) return null;
  return readUsers().find((user) => user.id === id) ?? null;
}

function createUser(userObject) {
  const users = readUsers();
  const user = {
    id: userObject.id || crypto.randomUUID(),
    email: String(userObject.email ?? "").trim().toLowerCase(),
    passwordHash: userObject.passwordHash,
    emailVerified: userObject.emailVerified === true,
    createdAt: userObject.createdAt ?? Date.now(),
    profile: { ...defaultProfile(), ...(userObject.profile ?? {}) },
  };
  users.push(user);
  writeUsers(users);
  return user;
}

function isProfileComplete(profile) {
  return Boolean(
    profile?.major?.trim() &&
      profile?.graduationDate?.trim() &&
      profile?.learningStyle?.trim() &&
      profile?.intendedUse?.trim()
  );
}

function updateUserProfile(id, profileFields) {
  const users = readUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index < 0) return null;

  const profile = {
    ...defaultProfile(),
    ...users[index].profile,
    ...profileFields,
  };
  profile.onboardingComplete = isProfileComplete(profile);

  users[index] = {
    ...users[index],
    profile,
  };
  writeUsers(users);
  return users[index];
}

function patchUser(id, fields) {
  const users = readUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index < 0) return null;
  users[index] = { ...users[index], ...fields };
  writeUsers(users);
  return users[index];
}

function findUserByHashedToken(hashField, expiresField, hash) {
  if (!hash) return null;
  const now = Date.now();
  return (
    readUsers().find((user) => user[hashField] === hash && Number(user[expiresField] || 0) > now) ?? null
  );
}

function getUserCanvasConnection(id) {
  const user = getUserById(id);
  if (!user?.canvas?.url || !user?.canvas?.token) return null;
  return { canvasUrl: user.canvas.url, token: user.canvas.token };
}

function setUserCanvasConnection(id, canvasUrl, token) {
  const users = readUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index < 0) return null;

  users[index] = {
    ...users[index],
    canvas: {
      url: canvasUrl,
      token,
    },
  };
  writeUsers(users);
  return users[index];
}

function clearUserCanvasConnection(id) {
  const users = readUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index < 0) return null;

  const { canvas: _removed, ...rest } = users[index];
  users[index] = rest;
  writeUsers(users);
  return users[index];
}

module.exports = {
  USERS_FILE,
  getUserByEmail,
  getUserById,
  createUser,
  updateUserProfile,
  patchUser,
  findUserByHashedToken,
  getUserCanvasConnection,
  setUserCanvasConnection,
  clearUserCanvasConnection,
};
