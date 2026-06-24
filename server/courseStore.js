const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const COURSES_DIR = path.join(__dirname, "..", "data", "user-courses");
let coursesDir = COURSES_DIR;
const MAX_CONTRIBUTION_CHARS = 4000;
const MAX_CONTRIBUTIONS = 200;

function generateId() {
  return crypto.randomUUID();
}

function ensureCoursesDir() {
  fs.mkdirSync(coursesDir, { recursive: true });
}

function courseFilePath(id) {
  return path.join(coursesDir, `${id}.json`);
}

function readCourseFile(id) {
  const filePath = courseFilePath(id);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeCourseFile(course) {
  ensureCoursesDir();
  fs.writeFileSync(courseFilePath(course.id), JSON.stringify(course, null, 2), "utf8");
}

function normalizeCourseInput(input) {
  return {
    courseName: String(input.courseName ?? "").trim(),
    courseCode: String(input.courseCode ?? "").trim(),
    instructor: String(input.instructor ?? "").trim(),
    semester: String(input.semester ?? "").trim(),
    syllabusText: String(input.syllabusText ?? "").trim(),
    additionalNotes: String(input.additionalNotes ?? "").trim(),
  };
}

function belongsToUser(course, userId) {
  if (!course || !userId) return false;
  return course.userId === userId;
}

function listCourses({ userId, status } = {}) {
  ensureCoursesDir();
  let courses = fs
    .readdirSync(coursesDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => readCourseFile(name.replace(/\.json$/, "")))
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  if (userId) {
    courses = courses.filter((course) => belongsToUser(course, userId));
  }

  if (status) {
    courses = courses.filter((course) => course.status === status);
  }

  return courses;
}

function getCourse(id) {
  return readCourseFile(id);
}

function getCourseForUser(id, userId) {
  const course = getCourse(id);
  if (!belongsToUser(course, userId)) return null;
  return course;
}

function findCourseByExternalId(userId, externalCourseId) {
  if (!userId || externalCourseId == null) return null;
  const targetId = String(externalCourseId);
  return (
    listCourses({ userId }).find(
      (course) =>
        course.externalSource === "canvas" && String(course.externalCourseId) === targetId
    ) ?? null
  );
}

function createCourse(input, { status = "active", userId } = {}) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const normalized = normalizeCourseInput(input);
  if (!normalized.courseName || !normalized.syllabusText) {
    throw new Error("courseName and syllabusText are required");
  }

  const now = Date.now();
  const course = {
    id: generateId(),
    userId,
    status,
    ...normalized,
    materials: [],
    contributions: [],
    createdAt: now,
    updatedAt: now,
  };

  if (input.externalSource) course.externalSource = input.externalSource;
  if (input.externalCourseId != null) course.externalCourseId = String(input.externalCourseId);
  if (input.lastSyncedAt) course.lastSyncedAt = input.lastSyncedAt;

  writeCourseFile(course);
  return course;
}

function updateCourse(id, patch, { userId } = {}) {
  const course = userId ? getCourseForUser(id, userId) : getCourse(id);
  if (!course) return null;

  const normalized = normalizeCourseInput({ ...course, ...patch });
  const updated = {
    ...course,
    ...normalized,
    status: patch.status ?? course.status,
    updatedAt: Date.now(),
  };

  if (patch.externalSource !== undefined) updated.externalSource = patch.externalSource;
  if (patch.externalCourseId !== undefined) {
    updated.externalCourseId =
      patch.externalCourseId == null ? undefined : String(patch.externalCourseId);
  }
  if (patch.lastSyncedAt !== undefined) updated.lastSyncedAt = patch.lastSyncedAt;

  writeCourseFile(updated);
  return updated;
}

function upsertCanvasCourse(userId, payload) {
  const existing = findCourseByExternalId(userId, payload.externalCourseId);
  const now = Date.now();

  if (existing) {
    const updated = {
      ...existing,
      courseName: payload.courseName || existing.courseName,
      courseCode: payload.courseCode ?? existing.courseCode,
      instructor: payload.instructor ?? existing.instructor,
      semester: payload.semester ?? existing.semester,
      syllabusText: payload.syllabusText || existing.syllabusText,
      additionalNotes: payload.additionalNotes ?? existing.additionalNotes,
      externalSource: "canvas",
      externalCourseId: String(payload.externalCourseId),
      lastSyncedAt: now,
      updatedAt: now,
    };
    writeCourseFile(updated);
    return updated;
  }

  return createCourse(
    {
      courseName: payload.courseName,
      courseCode: payload.courseCode,
      instructor: payload.instructor,
      semester: payload.semester,
      syllabusText: payload.syllabusText,
      additionalNotes: payload.additionalNotes,
      externalSource: "canvas",
      externalCourseId: String(payload.externalCourseId),
      lastSyncedAt: now,
    },
    { status: "active", userId }
  );
}

function syncCanvasMaterials(courseId, incomingMaterials, { userId } = {}) {
  const course = userId ? getCourseForUser(courseId, userId) : getCourse(courseId);
  if (!course) return null;

  const incomingIds = new Set(
    incomingMaterials.map((item) => item.externalItemId).filter(Boolean)
  );
  const manualMaterials = (course.materials ?? []).filter((item) => !item.externalItemId);
  const keptCanvasMaterials = (course.materials ?? []).filter(
    (item) => item.externalItemId && incomingIds.has(item.externalItemId)
  );
  const keptByExternalId = new Map(
    keptCanvasMaterials.map((item) => [item.externalItemId, item])
  );

  const syncedCanvasMaterials = incomingMaterials.map((incoming) => {
    const existing = keptByExternalId.get(incoming.externalItemId);
    return {
      id: existing?.id ?? generateId(),
      title: String(incoming.title ?? "").slice(0, 200),
      content: String(incoming.content ?? "").slice(0, MAX_CONTRIBUTION_CHARS),
      externalItemId: incoming.externalItemId,
      createdAt: existing?.createdAt ?? Date.now(),
    };
  });

  const updated = {
    ...course,
    materials: [...manualMaterials, ...syncedCanvasMaterials],
    lastSyncedAt: Date.now(),
    updatedAt: Date.now(),
  };

  writeCourseFile(updated);
  return updated;
}

function approveCourse(id, { userId } = {}) {
  return updateCourse(id, { status: "approved" }, { userId });
}

function addMaterial(id, { title, content, externalItemId }, { userId } = {}) {
  const course = userId ? getCourseForUser(id, userId) : getCourse(id);
  if (!course) return null;

  const trimmedTitle = String(title ?? "").trim();
  const trimmedContent = String(content ?? "").trim();
  if (!trimmedTitle || !trimmedContent) {
    throw new Error("Material title and content are required");
  }

  const material = {
    id: generateId(),
    title: trimmedTitle.slice(0, 200),
    content: trimmedContent.slice(0, MAX_CONTRIBUTION_CHARS),
    createdAt: Date.now(),
  };
  if (externalItemId) material.externalItemId = externalItemId;

  const materials = [...(course.materials ?? []), material];
  const updated = {
    ...course,
    materials,
    updatedAt: Date.now(),
  };

  writeCourseFile(updated);
  return updated;
}

function deleteMaterial(courseId, materialId, { userId } = {}) {
  const course = userId ? getCourseForUser(courseId, userId) : getCourse(courseId);
  if (!course) return null;

  const materials = (course.materials ?? []).filter((item) => item.id !== materialId);
  if (materials.length === (course.materials ?? []).length) return null;

  const updated = {
    ...course,
    materials,
    updatedAt: Date.now(),
  };

  writeCourseFile(updated);
  return updated;
}

function addContribution(id, content, { role = "user", userId } = {}) {
  const course = userId ? getCourseForUser(id, userId) : getCourse(id);
  if (!course) return null;

  const trimmed = String(content ?? "").trim();
  if (!trimmed) {
    throw new Error("Contribution content is required");
  }

  const contribution = {
    id: generateId(),
    role,
    content: trimmed.slice(0, MAX_CONTRIBUTION_CHARS),
    timestamp: Date.now(),
  };

  const contributions = [...(course.contributions ?? []), contribution].slice(-MAX_CONTRIBUTIONS);
  const updated = {
    ...course,
    contributions,
    updatedAt: Date.now(),
  };

  writeCourseFile(updated);
  return updated;
}

function deleteCourse(id, { userId } = {}) {
  const course = userId ? getCourseForUser(id, userId) : getCourse(id);
  if (!course) return false;
  fs.unlinkSync(courseFilePath(id));
  return true;
}

function toPublicSummary(course) {
  return {
    id: course.id,
    status: course.status,
    courseName: course.courseName,
    courseCode: course.courseCode,
    instructor: course.instructor,
    semester: course.semester,
    contributionCount: course.contributions?.length ?? 0,
    materialCount: course.materials?.length ?? 0,
    externalSource: course.externalSource ?? null,
    externalCourseId: course.externalCourseId ?? null,
    lastSyncedAt: course.lastSyncedAt ?? null,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

function toCourseContext(course) {
  return {
    id: course.id,
    courseName: course.courseName,
    courseCode: course.courseCode,
    instructor: course.instructor,
    semester: course.semester,
    syllabusText: course.syllabusText,
    additionalNotes: course.additionalNotes,
    materials: course.materials ?? [],
    contributions: course.contributions ?? [],
    status: course.status,
    externalSource: course.externalSource ?? null,
    externalCourseId: course.externalCourseId ?? null,
    lastSyncedAt: course.lastSyncedAt ?? null,
  };
}

function setCoursesDir(dir) {
  coursesDir = dir;
}

module.exports = {
  COURSES_DIR,
  MAX_CONTRIBUTION_CHARS,
  setCoursesDir,
  listCourses,
  getCourse,
  getCourseForUser,
  findCourseByExternalId,
  createCourse,
  updateCourse,
  upsertCanvasCourse,
  syncCanvasMaterials,
  approveCourse,
  addMaterial,
  deleteMaterial,
  addContribution,
  deleteCourse,
  toPublicSummary,
  toCourseContext,
};
