const { getConnection } = require("../canvasStore");
const { canvasGet, canvasGetAllPages } = require("./canvasClient");

const CACHE_TTL_MS = 10 * 60 * 1000;
const courseAssignmentCache = new Map();
const dueTodayCache = new Map();

function getTodayDateString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function isDueToday(dueAt) {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  const now = new Date();
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

function stripHtml(html) {
  if (!html) return null;
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncateDescription(text) {
  if (!text) return null;
  if (text.length <= 800) return text;
  return `${text.slice(0, 800)}...`;
}

function formatSubmissionTypes(types) {
  if (!types?.length) return "Not specified";
  return types.join(", ");
}

function formatInstructions(description) {
  const stripped = stripHtml(description);
  if (!stripped) return "No instructions provided — check Canvas directly.";
  return truncateDescription(stripped);
}

function formatDueTime(dueAt) {
  if (!dueAt) return "No due time";
  return new Date(dueAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDueDate(dueAt) {
  if (!dueAt) return "No due date";
  return new Date(dueAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTodayHeadingDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function fetchActiveCourses(canvasUrl, token) {
  return canvasGetAllPages(
    `${canvasUrl}/api/v1/courses?enrollment_state=active&per_page=100`,
    token
  );
}

async function fetchUpcomingAssignments(canvasUrl, token, courseId) {
  return canvasGetAllPages(
    `${canvasUrl}/api/v1/courses/${courseId}/assignments?bucket=upcoming&per_page=100`,
    token
  );
}

async function fetchAssignmentDetails(canvasUrl, token, courseId, assignmentId) {
  return canvasGet(
    `${canvasUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}`,
    token
  );
}

async function getCourseAssignmentList(sessionId, canvasUrl, token) {
  const cached = courseAssignmentCache.get(sessionId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const courses = await fetchActiveCourses(canvasUrl, token);
  const courseData = [];

  for (const course of courses) {
    const assignments = await fetchUpcomingAssignments(canvasUrl, token, course.id);
    courseData.push({
      id: course.id,
      name: course.name || course.course_code || `Course ${course.id}`,
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        name: assignment.name,
        due_at: assignment.due_at,
      })),
    });
  }

  courseAssignmentCache.set(sessionId, { fetchedAt: Date.now(), data: courseData });
  return courseData;
}

async function getDueTodayDetails(sessionId, canvasUrl, token, dueTodayItems) {
  if (!dueTodayItems.length) return [];

  const todayKey = `${sessionId}:${getTodayDateString()}`;
  const cached = dueTodayCache.get(todayKey);
  if (cached) return cached;

  const details = [];
  for (const item of dueTodayItems) {
    const assignment = await fetchAssignmentDetails(
      canvasUrl,
      token,
      item.courseId,
      item.assignmentId
    );
    details.push({
      courseName: item.courseName,
      name: assignment.name,
      due_at: assignment.due_at,
      points_possible: assignment.points_possible,
      submission_types: assignment.submission_types || [],
      description: assignment.description,
    });
  }

  dueTodayCache.set(todayKey, details);
  return details;
}

function formatCanvasContext(courseData, dueTodayDetails) {
  const todayFormatted = formatTodayHeadingDate();

  let dueTodaySection;
  if (dueTodayDetails.length === 0) {
    dueTodaySection = "DUE TODAY: Nothing due today.";
  } else {
    const lines = [`DUE TODAY (${todayFormatted}):`];
    for (const assignment of dueTodayDetails) {
      lines.push(`- ${assignment.courseName}: ${assignment.name}`);
      lines.push(`  Due: ${formatDueTime(assignment.due_at)}`);
      lines.push(`  Points: ${assignment.points_possible ?? "Not specified"}`);
      lines.push(`  Submit via: ${formatSubmissionTypes(assignment.submission_types)}`);
      lines.push(`  Instructions: ${formatInstructions(assignment.description)}`);
    }
    dueTodaySection = lines.join("\n");
  }

  const upcoming = [];
  for (const course of courseData) {
    for (const assignment of course.assignments) {
      if (assignment.due_at && isDueToday(assignment.due_at)) continue;
      upcoming.push({
        courseName: course.name,
        name: assignment.name,
        due_at: assignment.due_at,
      });
    }
  }

  let upcomingSection = "UPCOMING ASSIGNMENTS:";
  if (upcoming.length === 0) {
    upcomingSection += "\nNone listed.";
  } else {
    for (const assignment of upcoming) {
      upcomingSection += `\n- ${assignment.courseName}: ${assignment.name}, due ${formatDueDate(assignment.due_at)}`;
    }
  }

  return `${dueTodaySection}\n\n${upcomingSection}`;
}

async function getCanvasContext(sessionId) {
  if (!sessionId) return null;

  const connection = getConnection(sessionId);
  if (!connection) return null;

  const { canvasUrl, token } = connection;

  try {
    const courseData = await getCourseAssignmentList(sessionId, canvasUrl, token);

    const dueTodayItems = [];
    for (const course of courseData) {
      for (const assignment of course.assignments) {
        if (assignment.due_at && isDueToday(assignment.due_at)) {
          dueTodayItems.push({
            courseId: course.id,
            courseName: course.name,
            assignmentId: assignment.id,
          });
        }
      }
    }

    const dueTodayDetails = await getDueTodayDetails(
      sessionId,
      canvasUrl,
      token,
      dueTodayItems
    );
    return formatCanvasContext(courseData, dueTodayDetails);
  } catch {
    return null;
  }
}

function clearCanvasCaches(sessionId) {
  courseAssignmentCache.delete(sessionId);
  const todayKey = `${sessionId}:${getTodayDateString()}`;
  dueTodayCache.delete(todayKey);
}

module.exports = {
  getCanvasContext,
  clearCanvasCaches,
  isDueToday,
  stripHtml,
  truncateDescription,
  formatCanvasContext,
  _clearAllCaches: () => {
    courseAssignmentCache.clear();
    dueTodayCache.clear();
  },
};
