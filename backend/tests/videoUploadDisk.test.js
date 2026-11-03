const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const request = require("supertest");
const { createConfiguredUpload } = require("../utils/memoryUpload");

const waitForCleanup = async (target) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!fs.existsSync(target)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Temporary file remains: ${target}`);
};

describe("disk-backed media uploads", () => {
  let root;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "tengacion-upload-test-")); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  test("stores media on disk during request then cleans up", async () => {
    const upload = createConfiguredUpload({ candidates: [root], storageMode: "disk", maxFiles: 1, maxFileBytes: 1024 * 1024 });
    const app = express();
    let savedPath = "";
    app.post("/", ...upload.single("media"), (req, res) => {
      savedPath = req.file.path;
      res.status(201).json({ storedOnDisk: fs.existsSync(savedPath), buffered: Buffer.isBuffer(req.file.buffer), size: req.file.size });
    });
    const result = await request(app).post("/").attach("media", Buffer.from("video bytes"), { filename: "clip.mp4", contentType: "video/mp4" });
    expect(result.status).toBe(201);
    expect(result.body).toEqual({ storedOnDisk: true, buffered: false, size: 11 });
    expect(path.dirname(savedPath)).toBe(root);
    await waitForCleanup(savedPath);
  });

  test("rejects oversized media and removes partial upload", async () => {
    const upload = createConfiguredUpload({ candidates: [root], storageMode: "disk", maxFiles: 1, maxFileBytes: 4 });
    const app = express();
    app.post("/", ...upload.single("media"), (_req, res) => res.sendStatus(200));
    app.use((error, _req, res, _next) => res.status(error.statusCode || 400).json({ error: error.message }));
    const result = await request(app).post("/").attach("media", Buffer.from("larger-than-limit"), { filename: "clip.mp4", contentType: "video/mp4" });
    expect(result.status).toBe(413);
    expect(fs.readdirSync(root)).toEqual([]);
  });
});
