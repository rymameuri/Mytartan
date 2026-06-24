const API_BASE = process.env.REACT_APP_API_URL || "";

function buildHeaders(token, extra = {}) {
  const headers = { ...extra };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchJson(url, options = {}, token) {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: buildHeaders(token, options.headers),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export async function listCourses(token) {
  const data = await fetchJson("/api/courses", {}, token);
  return data.courses ?? [];
}

export async function saveCourseToLibrary(courseInput, token) {
  const data = await fetchJson(
    "/api/courses",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(courseInput),
    },
    token
  );
  return data.course;
}

export async function refreshCourse(courseId, token) {
  const data = await fetchJson(`/api/courses/${courseId}`, {}, token);
  return data.course;
}

export async function deleteCourse(courseId, token) {
  await fetchJson(`/api/courses/${courseId}`, { method: "DELETE" }, token);
}

export async function addCourseMaterial(courseId, material, token) {
  const data = await fetchJson(
    `/api/courses/${courseId}/materials`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(material),
    },
    token
  );
  return data.course;
}

export async function deleteCourseMaterial(courseId, materialId, token) {
  const data = await fetchJson(
    `/api/courses/${courseId}/materials/${materialId}`,
    { method: "DELETE" },
    token
  );
  return data.course;
}

export async function contributeToCourse(courseId, content, token) {
  const data = await fetchJson(
    `/api/courses/${courseId}/contribute`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, role: "user" }),
    },
    token
  );
  return data.course;
}

export async function listCanvasCourses(token) {
  const data = await fetchJson("/api/canvas/courses", {}, token);
  return data.courses ?? [];
}

export async function importCanvasCourses(canvasCourseIds, token) {
  return fetchJson(
    "/api/courses/import/canvas",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canvasCourseIds }),
    },
    token
  );
}

export async function syncCanvasCourse(courseId, token) {
  const data = await fetchJson(
    `/api/courses/${courseId}/sync`,
    { method: "POST" },
    token
  );
  return data.course;
}
