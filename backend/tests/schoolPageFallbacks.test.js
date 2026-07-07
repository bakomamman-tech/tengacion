const fs = require("fs");
const path = require("path");

const { getFallbackSchoolPageBySlug } = require("../data/schoolPageFallbacks");

describe("Kurah academy fallback page", () => {
  const school = getFallbackSchoolPageBySlug("kurahtechandartsacademy");
  const pupils = [
    ["Nursery 1", "Jaydee Musa", "/assets/kurah-academy/student-nursery-1-jaydee-musa.jpg"],
    ["Nursery 2", "Miracle Ikenna", "/assets/kurah-academy/student-nursery-2-miracle-ikenna.jpg"],
    ["Nursery 3", "Shepherd Sunday", "/assets/kurah-academy/student-nursery-3-shepherd-sunday.jpg"],
    ["Nursery 3", "Success K. Noah", "/assets/kurah-academy/student-nursery-3-success-k-noah.jpg"],
  ];

  test.each(pupils)("includes %s pupil %s and their portrait", (className, name, photoUrl) => {
    const classGroup = school.classPhotos.find((group) => group.className === className);
    const pupil = classGroup?.students.find((entry) => entry.name === name);
    const portraitPath = path.resolve(
      __dirname,
      "..",
      "..",
      "frontend",
      "public",
      photoUrl.replace(/^\//, "")
    );

    expect(pupil).toEqual({ name, photoUrl });
    expect(fs.statSync(portraitPath).size).toBeGreaterThan(0);
  });

  test("reflects the four added pupils in the school total", () => {
    expect(school.statistics.students).toBe(104);
  });
});
