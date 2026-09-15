jest.mock("../middleware/auth", () => (_req, _res, next) => next());
jest.mock("../middleware/creatorAuth", () => (_req, _res, next) => next());
jest.mock("../middleware/optionalAuth", () => (_req, _res, next) => next());
jest.mock("../utils/upload", () => ({
  fields: () => (_req, _res, next) => next(),
}));
jest.mock("../middleware/moderateUpload", () => () => (_req, _res, next) => next());

jest.mock("../controllers/tracksController", () => ({
  createTrack: (_req, res) => res.status(201).json({ ok: true }),
  updateTrack: (_req, res) => res.json({ ok: true }),
  deleteTrack: (_req, res) => res.json({ ok: true }),
  getTrackStream: (_req, res) => res.json({
    streamUrl: "/api/media/delivery/signed-token",
    previewOnly: true,
  }),
  getTrackById: (_req, res) => res.json({
    _id: "507f1f77bcf86cd799439011",
    title: "Protected Song",
    price: 2500,
    audioUrl: "https://private.example.com/master.mp3",
    fullAudioUrl: "https://private.example.com/master.mp3",
    videoUrl: "https://private.example.com/master.mp4",
    previewUrl: "https://private.example.com/preview.mp3",
    previewSampleUrl: "https://private.example.com/preview.mp3",
    previewClipUrl: "https://private.example.com/preview.mp4",
    coverImageUrl: "https://cdn.example.com/cover.jpg",
  }),
}));

const express = require("express");
const request = require("supertest");
const tracksRouter = require("../routes/tracks");

const app = express();
app.use("/api/tracks", tracksRouter);

test("public track metadata never exposes raw media storage URLs", async () => {
  const response = await request(app)
    .get("/api/tracks/507f1f77bcf86cd799439011")
    .expect(200);

  expect(response.body).toMatchObject({
    title: "Protected Song",
    price: 2500,
    coverImageUrl: "https://cdn.example.com/cover.jpg",
  });
  expect(response.body).not.toHaveProperty("audioUrl");
  expect(response.body).not.toHaveProperty("fullAudioUrl");
  expect(response.body).not.toHaveProperty("videoUrl");
  expect(response.body).not.toHaveProperty("previewUrl");
  expect(response.body).not.toHaveProperty("previewSampleUrl");
  expect(response.body).not.toHaveProperty("previewClipUrl");
});

test("stream endpoint still returns only Tengacion delivery metadata", async () => {
  const response = await request(app)
    .get("/api/tracks/507f1f77bcf86cd799439011/stream")
    .expect(200);

  expect(response.body.streamUrl).toContain("/api/media/delivery/");
  expect(JSON.stringify(response.body)).not.toContain("private.example.com");
});
