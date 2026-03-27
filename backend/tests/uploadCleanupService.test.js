const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const { cleanupUploadDir } = require("../services/uploadCleanupService");

describe("uploadCleanupService", () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tengacion-upload-cleanup-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
  });

  test("removes root files and preserves nested folders", async () => {
    const rootFile = path.join(tempDir, "stale-explicit-video.mp4");
    const nestedDir = path.join(tempDir, "chat");
    const nestedFile = path.join(nestedDir, "keep-me.jpg");

    await fs.writeFile(rootFile, Buffer.from("temporary media"));
    await fs.mkdir(nestedDir, { recursive: true });
    await fs.writeFile(nestedFile, Buffer.from("nested media"));

    const result = await cleanupUploadDir({ uploadDir: tempDir, logger: null });

    await expect(fs.stat(rootFile)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.stat(nestedFile)).resolves.toBeTruthy();
    expect(result.deletedCount).toBe(1);
    expect(result.freedBytes).toBeGreaterThan(0);
    expect(await fs.readdir(nestedDir)).toEqual(["keep-me.jpg"]);
  });
});
