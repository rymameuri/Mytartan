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

module.exports = {
  USERS_FILE,
  getUserByEmail,
  getUserById,
  createUser,
  updateUserProfile,
};
