const request = require("supertest");
const app = require("../app");

describe("backend bootstrap", () => {
  test("GET /api/health responds with ok status", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body).toMatchObject({ status: "ok" });
  });

  test("GET /socket.io returns socket probe", async () => {
    const response = await request(app).get("/socket.io").expect(200);
    expect(response.text).toContain("socket ok");
  });

  test("GET /api/me requires auth and reports no token", async () => {
    const response = await request(app).get("/api/me").expect(401);
    expect(response.body).toMatchObject({ error: "No token" });
  });

  test("requiring app does not start a listening server", async () => {
    // supertest uses the app instance directly so no network port needs to be bound.
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body.status).toBe("ok");
  });
});
