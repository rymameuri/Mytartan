const fs = require("fs");
const path = require("path");
const os = require("os");

const courseStore = require("./courseStore");

describe("courseStore", () => {
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "tartan-courses-"));
    courseStore.setCoursesDir(testDir);
  });

  afterEach(() => {
    courseStore.setCoursesDir(courseStore.COURSES_DIR);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test("creates active course with syllabus", () => {
    const course = courseStore.createCourse({
      courseName: "Intro to CS",
      courseCode: "15-112",
      syllabusText: "Week 1: functions",
    });

    expect(course.status).toBe("active");
    expect(course.courseName).toBe("Intro to CS");
    expect(courseStore.getCourse(course.id)).toEqual(course);
  });

  test("lists and approves courses", () => {
    const course = courseStore.createCourse({
      courseName: "Data Structures",
      syllabusText: "Trees and graphs",
    });

    expect(courseStore.listCourses()).toHaveLength(1);
    const approved = courseStore.approveCourse(course.id);
    expect(approved.status).toBe("approved");
    expect(courseStore.listCourses({ status: "approved" })).toHaveLength(1);
  });

  test("stores tutor contributions on a course", () => {
    const course = courseStore.createCourse({
      courseName: "Algorithms",
      syllabusText: "Sorting",
    });

    const updated = courseStore.addContribution(course.id, "Explain Big-O notation");
    expect(updated.contributions).toHaveLength(1);
    expect(updated.contributions[0].content).toMatch(/Big-O/);
  });

  test("adds materials to a course", () => {
    const course = courseStore.createCourse({
      courseName: "Algorithms",
      syllabusText: "Sorting",
    });

    const updated = courseStore.addMaterial(course.id, {
      title: "Week 6 Notes",
      content: "Recursion and base cases",
    });
    expect(updated.materials).toHaveLength(1);
    expect(updated.materials[0].title).toBe("Week 6 Notes");
  });

  test("deletes a course", () => {
    const course = courseStore.createCourse({
      courseName: "Temporary",
      syllabusText: "Topics",
    });

    expect(courseStore.deleteCourse(course.id)).toBe(true);
    expect(courseStore.getCourse(course.id)).toBeNull();
  });

  test("summary helpers expose safe fields", () => {
    const course = courseStore.createCourse({
      courseName: "Test",
      syllabusText: "Body",
    });
    courseStore.addContribution(course.id, "Question one");

    const summary = courseStore.toPublicSummary(courseStore.getCourse(course.id));
    expect(summary).toHaveProperty("contributionCount", 1);
    expect(summary).not.toHaveProperty("syllabusText");

    const context = courseStore.toCourseContext(courseStore.getCourse(course.id));
    expect(context.syllabusText).toMatch(/Body/);
    expect(context.contributions).toHaveLength(1);
  });
});
