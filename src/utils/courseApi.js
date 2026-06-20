const API_BASE = process.env.REACT_APP_API_URL || "";

async function fetchJson(url, options) {
  const response = await fetch(`${API_BASE}${url}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export async function listCourses() {
  const data = await fetchJson("/api/courses");
  return data.courses ?? [];
}

export async function saveCourseToLibrary(courseInput) {
  const data = await fetchJson("/api/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(courseInput),
  });
  return data.course;
}

export async function refreshCourse(courseId) {
  const data = await fetchJson(`/api/courses/${courseId}`);
  return data.course;
}

export async function deleteCourse(courseId) {
  await fetchJson(`/api/courses/${courseId}`, { method: "DELETE" });
}

export async function addCourseMaterial(courseId, material) {
  const data = await fetchJson(`/api/courses/${courseId}/materials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(material),
  });
  return data.course;
}

export async function deleteCourseMaterial(courseId, materialId) {
  const data = await fetchJson(`/api/courses/${courseId}/materials/${materialId}`, {
    method: "DELETE",
  });
  return data.course;
}

export async function contributeToCourse(courseId, content) {
  const data = await fetchJson(`/api/courses/${courseId}/contribute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, role: "user" }),
  });
  return data.course;
}
