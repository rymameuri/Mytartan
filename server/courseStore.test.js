const fs = require("fs");
const path = require("path");
const os = require("os");

const courseStore = require("./courseStore");

const TEST_USER = "user-test-1";

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
    const course = courseStore.createCourse(
      {
        courseName: "Intro to CS",
        courseCode: "15-112",
        syllabusText: "Week 1: functions",
      },
      { userId: TEST_USER }
    );

    expect(course.status).toBe("active");
    expect(course.userId).toBe(TEST_USER);
    expect(course.courseName).toBe("Intro to CS");
    expect(courseStore.getCourse(course.id)).toEqual(course);
  });

  test("lists courses scoped to user", () => {
    courseStore.createCourse(
      { courseName: "Mine", syllabusText: "Topics" },
      { userId: TEST_USER }
    );
    courseStore.createCourse(
      { courseName: "Other", syllabusText: "Topics" },
      { userId: "other-user" }
    );

    expect(courseStore.listCourses({ userId: TEST_USER })).toHaveLength(1);
    expect(courseStore.listCourses({ userId: TEST_USER })[0].courseName).toBe("Mine");
  });

  test("finds and upserts canvas courses", () => {
    const created = courseStore.upsertCanvasCourse(TEST_USER, {
      externalCourseId: "101",
      courseName: "Canvas Course",
      courseCode: "15-213",
      instructor: "Prof",
      semester: "Spring 2026",
      syllabusText: "Syllabus body",
    });

    expect(created.externalSource).toBe("canvas");
    expect(courseStore.findCourseByExternalId(TEST_USER, "101")?.id).toBe(created.id);

    const updated = courseStore.upsertCanvasCourse(TEST_USER, {
      externalCourseId: "101",
      courseName: "Canvas Course Updated",
      courseCode: "15-213",
      instructor: "Prof",
      semester: "Spring 2026",
      syllabusText: "Updated syllabus",
    });

    expect(updated.id).toBe(created.id);
    expect(updated.courseName).toBe("Canvas Course Updated");
  });

  test("syncs canvas materials by external id", () => {
    const course = courseStore.createCourse(
      { courseName: "Algorithms", syllabusText: "Sorting" },
      { userId: TEST_USER }
    );

    courseStore.addMaterial(
      course.id,
      { title: "Manual notes", content: "My notes" },
      { userId: TEST_USER }
    );

    const synced = courseStore.syncCanvasMaterials(
      course.id,
      [
        { externalItemId: "canvas:file:1", title: "Lecture 1", content: "Slides text" },
        { externalItemId: "canvas:page:2", title: "Week 2", content: "Reading" },
      ],
      { userId: TEST_USER }
    );

    expect(synced.materials).toHaveLength(3);
    expect(synced.materials.some((item) => item.title === "Manual notes")).toBe(true);
    expect(synced.materials.some((item) => item.externalItemId === "canvas:file:1")).toBe(true);
  });

  test("deletes only owned courses", () => {
    const course = courseStore.createCourse(
      { courseName: "Temporary", syllabusText: "Topics" },
      { userId: TEST_USER }
    );

    expect(courseStore.deleteCourse(course.id, { userId: "other-user" })).toBe(false);
    expect(courseStore.deleteCourse(course.id, { userId: TEST_USER })).toBe(true);
    expect(courseStore.getCourse(course.id)).toBeNull();
  });

  test("summary helpers expose canvas fields", () => {
    const course = courseStore.upsertCanvasCourse(TEST_USER, {
      externalCourseId: "55",
      courseName: "Test",
      courseCode: "01",
      instructor: "",
      semester: "",
      syllabusText: "Body",
    });

    const summary = courseStore.toPublicSummary(courseStore.getCourse(course.id));
    expect(summary.externalSource).toBe("canvas");
    expect(summary.externalCourseId).toBe("55");
  });
});
