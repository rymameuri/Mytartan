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

function listCourses({ status } = {}) {
  ensureCoursesDir();
  const courses = fs
    .readdirSync(coursesDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => readCourseFile(name.replace(/\.json$/, "")))
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  if (!status) return courses;
  return courses.filter((course) => course.status === status);
}

function getCourse(id) {
  return readCourseFile(id);
}

function createCourse(input, { status = "active" } = {}) {
  const normalized = normalizeCourseInput(input);
  if (!normalized.courseName || !normalized.syllabusText) {
    throw new Error("courseName and syllabusText are required");
  }

  const now = Date.now();
  const course = {
    id: generateId(),
    status,
    ...normalized,
    materials: [],
    contributions: [],
    createdAt: now,
    updatedAt: now,
  };

  writeCourseFile(course);
  return course;
}

function updateCourse(id, patch) {
  const course = getCourse(id);
  if (!course) return null;

  const normalized = normalizeCourseInput({ ...course, ...patch });
  const updated = {
    ...course,
    ...normalized,
    status: patch.status ?? course.status,
    updatedAt: Date.now(),
  };

  writeCourseFile(updated);
  return updated;
}

function approveCourse(id) {
  return updateCourse(id, { status: "approved" });
}

function addMaterial(id, { title, content }) {
  const course = getCourse(id);
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

  const materials = [...(course.materials ?? []), material];
  const updated = {
    ...course,
    materials,
    updatedAt: Date.now(),
  };

  writeCourseFile(updated);
  return updated;
}

function deleteMaterial(courseId, materialId) {
  const course = getCourse(courseId);
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

function addContribution(id, content, { role = "user" } = {}) {
  const course = getCourse(id);
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

function deleteCourse(id) {
  const filePath = courseFilePath(id);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
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
  };
}

function setCoursesDir(dir) {
  coursesDir = dir;
}

module.exports = {
  COURSES_DIR,
  setCoursesDir,
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  approveCourse,
  addMaterial,
  deleteMaterial,
  addContribution,
  deleteCourse,
  toPublicSummary,
  toCourseContext,
};
