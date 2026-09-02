const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "removed_pages_test_secret_12345678901234567890";

const app = require("../app");

describe("removed Tengacion pages", () => {
  test.each([
    "/AI-Professionals-In-Kaduna-State",
    "/KadaHive",
    "/kadahive/login",
    "/kadahive/programmes/kids-code",
    "/kadahive/admin",
    "/admin/institutions/kadahive",
  ])("returns Gone for %s", async (path) => {
    const response = await request(app).get(path).expect(410);

    expect(response.headers["x-robots-tag"]).toBe("noindex,nofollow");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.text).toBe("This page has been removed.");
  });

  test("does not expose the removed API", async () => {
    await request(app).get("/api/kadahive/me").expect(404);
  });
});
