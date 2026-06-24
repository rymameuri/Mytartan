const { getConnection } = require("../canvasStore");
const {
  findCourseByExternalId,
  upsertCanvasCourse,
  syncCanvasMaterials,
  getCourseForUser,
  MAX_CONTRIBUTION_CHARS,
} = require("../courseStore");
const { extractTextFromBuffer } = require("../textExtraction");
const { canvasGet, canvasGetAllPages, canvasDownload } = require("./canvasClient");

const MAX_FILES_PER_SYNC = 50;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkMaterial(title, content) {
  const text = String(content ?? "").trim();
  if (!text) return [];

  if (text.length <= MAX_CONTRIBUTION_CHARS) {
    return [{ title: title.slice(0, 200), content: text }];
  }

  const chunks = [];
  let remaining = text;
  let part = 1;
  while (remaining.length > 0) {
    const slice = remaining.slice(0, MAX_CONTRIBUTION_CHARS);
    const chunkTitle =
      remaining.length <= MAX_CONTRIBUTION_CHARS && part === 1
        ? title.slice(0, 200)
        : `${title.slice(0, 180)} (Part ${part})`.slice(0, 200);
    chunks.push({ title: chunkTitle, content: slice });
    remaining = remaining.slice(MAX_CONTRIBUTION_CHARS);
    part += 1;
  }
  return chunks;
}

function buildMaterialEntries(title, content, externalItemId) {
  return chunkMaterial(title, content).map((chunk, index) => ({
    ...chunk,
    externalItemId: index === 0 ? externalItemId : `${externalItemId}:part:${index + 1}`,
  }));
}

function formatTerm(term) {
  if (!term) return "";
  if (typeof term === "string") return term;
  return term.name || "";
}

async function fetchCourseTeachers(canvasUrl, token, courseId) {
  try {
    const teachers = await canvasGetAllPages(
      `${canvasUrl}/api/v1/courses/${courseId}/users?enrollment_type=teacher&per_page=50`,
      token
    );
    const names = teachers
      .map((teacher) => teacher.name || teacher.sortable_name)
      .filter(Boolean);
    return names.join(", ");
  } catch {
    return "";
  }
}

async function fetchCourseDetails(canvasUrl, token, courseId) {
  const course = await canvasGet(
    `${canvasUrl}/api/v1/courses/${courseId}?include[]=syllabus_body&include[]=term`,
    token
  );
  const instructor = await fetchCourseTeachers(canvasUrl, token, courseId);
  const syllabusText =
    stripHtml(course.syllabus_body) ||
    `Imported from Canvas course ${course.name || course.course_code || courseId}.`;

  return {
    courseName: course.name || course.course_code || `Course ${courseId}`,
    courseCode: course.course_code || "",
    instructor,
    semester: formatTerm(course.term),
    syllabusText,
    additionalNotes: "",
  };
}

async function fetchModuleMaterials(canvasUrl, token, courseId, limits) {
  const materials = [];
  let modules = [];

  try {
    modules = await canvasGetAllPages(
      `${canvasUrl}/api/v1/courses/${courseId}/modules?include[]=items&per_page=50`,
      token
    );
  } catch {
    return materials;
  }

  for (const module of modules) {
    for (const item of module.items ?? []) {
      if (limits.fileCount >= MAX_FILES_PER_SYNC) break;

      const baseTitle = `${module.name}: ${item.title}`.trim();

      if (item.type === "Page" && item.page_url) {
        try {
          const page = await canvasGet(
            `${canvasUrl}/api/v1/courses/${courseId}/pages/${item.page_url}`,
            token
          );
          const body = stripHtml(page.body);
          if (body) {
            materials.push(
              ...buildMaterialEntries(baseTitle, body, `canvas:page:${item.id}`)
            );
          }
        } catch {
          /* skip page */
        }
        continue;
      }

      if (item.type === "Assignment" && item.content_id) {
        try {
          const assignment = await canvasGet(
            `${canvasUrl}/api/v1/courses/${courseId}/assignments/${item.content_id}`,
            token
          );
          const description = stripHtml(assignment.description);
          if (description) {
            materials.push(
              ...buildMaterialEntries(
                baseTitle,
                description,
                `canvas:assignment:${item.content_id}`
              )
            );
          }
        } catch {
          /* skip assignment */
        }
        continue;
      }

      if (item.type === "File" && item.content_id) {
        const fileMaterials = await importCanvasFile(
          canvasUrl,
          token,
          item.content_id,
          baseTitle,
          limits
        );
        materials.push(...fileMaterials);
      }
    }
  }

  return materials;
}

async function importCanvasFile(canvasUrl, token, fileId, title, limits) {
  if (limits.fileCount >= MAX_FILES_PER_SYNC) {
    return buildMaterialEntries(
      `${title} (skipped)`,
      "Skipped — file limit reached for this sync.",
      `canvas:skip:limit:${fileId}`
    );
  }

  try {
    const fileMeta = await canvasGet(`${canvasUrl}/api/v1/files/${fileId}`, token);
    const downloadUrl = fileMeta.url;
    if (!downloadUrl) {
      return buildMaterialEntries(
        `${title} (skipped)`,
        `Could not download ${fileMeta.display_name || "file"} from Canvas.`,
        `canvas:skip:nourl:${fileId}`
      );
    }

    const buffer = await canvasDownload(downloadUrl, token);
    limits.fileCount += 1;
    limits.totalBytes += buffer.length;

    if (limits.totalBytes > MAX_TOTAL_BYTES) {
      return buildMaterialEntries(
        `${title} (skipped)`,
        "Skipped — total download size limit reached for this sync.",
        `canvas:skip:size:${fileId}`
      );
    }

    const extracted = await extractTextFromBuffer(buffer, fileMeta.display_name, {
      mimeType: fileMeta["content-type"],
    });

    if (extracted.text) {
      return buildMaterialEntries(
        fileMeta.display_name || title,
        extracted.text,
        `canvas:file:${fileId}`
      );
    }

    return buildMaterialEntries(
      `${fileMeta.display_name || title} (skipped)`,
      extracted.skipReason || "Unsupported or unreadable file from Canvas.",
      `canvas:skip:unsupported:${fileId}`
    );
  } catch (err) {
    return buildMaterialEntries(
      `${title} (skipped)`,
      err.message || "Could not download file from Canvas.",
      `canvas:skip:error:${fileId}`
    );
  }
}

async function fetchStandaloneFiles(canvasUrl, token, courseId, limits, seenFileIds) {
  const materials = [];

  let files = [];
  try {
    files = await canvasGetAllPages(
      `${canvasUrl}/api/v1/courses/${courseId}/files?per_page=50`,
      token
    );
  } catch {
    return materials;
  }

  for (const file of files) {
    if (limits.fileCount >= MAX_FILES_PER_SYNC) break;
    if (seenFileIds.has(String(file.id))) continue;

    const fileMaterials = await importCanvasFile(
      canvasUrl,
      token,
      file.id,
      file.display_name || `File ${file.id}`,
      limits
    );
    materials.push(...fileMaterials);
  }

  return materials;
}

async function fetchAllAssignments(canvasUrl, token, courseId) {
  const materials = [];
  let assignments = [];

  try {
    assignments = await canvasGetAllPages(
      `${canvasUrl}/api/v1/courses/${courseId}/assignments?per_page=50`,
      token
    );
  } catch {
    return materials;
  }

  for (const assignment of assignments) {
    const description = stripHtml(assignment.description);
    if (!description) continue;
    materials.push(
      ...buildMaterialEntries(
        `Assignment: ${assignment.name}`,
        description,
        `canvas:assignment:${assignment.id}`
      )
    );
  }

  return materials;
}

async function importSingleCanvasCourse(userId, canvasUrl, token, canvasCourseId) {
  const limits = { fileCount: 0, totalBytes: 0 };
  const details = await fetchCourseDetails(canvasUrl, token, canvasCourseId);

  const course = upsertCanvasCourse(userId, {
    ...details,
    externalCourseId: canvasCourseId,
  });

  const moduleMaterials = await fetchModuleMaterials(
    canvasUrl,
    token,
    canvasCourseId,
    limits
  );
  const seenFileIds = new Set(
    moduleMaterials
      .map((item) => item.externalItemId)
      .filter((id) => id?.startsWith("canvas:file:"))
      .map((id) => id.replace("canvas:file:", ""))
  );

  const standaloneMaterials = await fetchStandaloneFiles(
    canvasUrl,
    token,
    canvasCourseId,
    limits,
    seenFileIds
  );
  const assignmentMaterials = await fetchAllAssignments(canvasUrl, token, canvasCourseId);

  const merged = [...moduleMaterials, ...standaloneMaterials, ...assignmentMaterials];
  const deduped = [];
  const seenExternal = new Set();
  for (const material of merged) {
    if (seenExternal.has(material.externalItemId)) continue;
    seenExternal.add(material.externalItemId);
    deduped.push(material);
  }

  return syncCanvasMaterials(course.id, deduped, { userId });
}

async function listCanvasCoursesForImport(userId) {
  const connection = getConnection(userId);
  if (!connection) {
    throw new Error("Canvas is not connected");
  }

  const { canvasUrl, token } = connection;
  const courses = await canvasGetAllPages(
    `${canvasUrl}/api/v1/courses?enrollment_state=active&include[]=term&per_page=50`,
    token
  );

  return courses.map((course) => ({
    id: String(course.id),
    name: course.name || course.course_code || `Course ${course.id}`,
    courseCode: course.course_code || "",
    term: formatTerm(course.term),
    alreadyImported: Boolean(findCourseByExternalId(userId, course.id)),
  }));
}

async function importCanvasCourses(userId, canvasCourseIds) {
  const connection = getConnection(userId);
  if (!connection) {
    throw new Error("Canvas is not connected");
  }

  const { canvasUrl, token } = connection;
  const courses = [];
  const errors = [];

  for (const canvasCourseId of canvasCourseIds) {
    try {
      const course = await importSingleCanvasCourse(userId, canvasUrl, token, canvasCourseId);
      courses.push(course);
    } catch (err) {
      errors.push({
        canvasCourseId: String(canvasCourseId),
        message: err.message || "Import failed",
      });
    }
  }

  return { courses, errors };
}

async function syncCanvasCourse(userId, courseId) {
  const course = getCourseForUser(courseId, userId);
  if (!course) {
    throw new Error("Course not found");
  }
  if (course.externalSource !== "canvas" || !course.externalCourseId) {
    throw new Error("This course was not imported from Canvas");
  }

  const connection = getConnection(userId);
  if (!connection) {
    throw new Error("Canvas is not connected");
  }

  const synced = await importSingleCanvasCourse(
    userId,
    connection.canvasUrl,
    connection.token,
    course.externalCourseId
  );
  return synced;
}

module.exports = {
  stripHtml,
  chunkMaterial,
  buildMaterialEntries,
  listCanvasCoursesForImport,
  importCanvasCourses,
  syncCanvasCourse,
  importSingleCanvasCourse,
  MAX_FILES_PER_SYNC,
  MAX_TOTAL_BYTES,
};
