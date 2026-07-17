import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(testDir, "../index.css"), "utf8").replace(/\r\n/g, "\n");
const page = readFileSync(resolve(testDir, "./ReelsPage.jsx"), "utf8")
  .replace(/\r\n/g, "\n")
  .replace(/\s+/g, " ");

function getRule(selector, startAt = 0) {
  const start = css.indexOf(`${selector} {`, startAt);

  if (start === -1) {
    return "";
  }

  return css.slice(start, css.indexOf("\n}", start));
}

function getMediaSection(query, nextQuery) {
  const start = css.indexOf(query);
  const end = nextQuery ? css.indexOf(nextQuery, start + query.length) : css.length;

  return start === -1 ? "" : css.slice(start, end === -1 ? css.length : end);
}

describe("Reels modern layout contract", () => {
  it("keeps the desktop rails, stage, and portrait reel presentation", () => {
    const shell = getRule(".reels-page-shell");
    const stage = getRule(".reels-stage");
    const reel = getRule(".reel-viewer-card");

    expect(shell).toContain("display: grid;");
    expect(shell).toContain(
      "grid-template-columns: minmax(224px, 260px) minmax(500px, 1fr) minmax(240px, 282px);"
    );
    expect(shell).toContain("height: calc(100dvh - 72px);");
    expect(shell).toContain("overflow: hidden;");
    expect(css).toContain(".reels-left-rail,");
    expect(css).toContain(".reels-right-rail {");
    expect(stage).toContain("grid-template-rows: auto minmax(0, 1fr);");
    expect(stage).toContain("overflow: hidden;");
    expect(reel).toContain("aspect-ratio: 9 / 16;");
    expect(css).toContain(".reel-actions {");
    expect(css).toContain(".reels-queue-list {");
  });

  it("keeps scrolling inside the stage and snaps between complete reels", () => {
    const stream = getRule(".reels-stream");
    const slide = getRule(".reels-slide");

    expect(stream).toContain("min-height: 0;");
    expect(stream).toContain("height: 100%;");
    expect(stream).toContain("overflow-y: auto;");
    expect(stream).toContain("overscroll-behavior-y: contain;");
    expect(stream).toContain("scroll-snap-type: y mandatory;");
    expect(slide).toContain("min-height: 100%;");
    expect(slide).toContain("scroll-snap-align: center;");
    expect(slide).toContain("scroll-snap-stop: always;");
  });

  it("preserves the desktop, tablet, phone, and short-viewport breakpoints", () => {
    const tablet = getMediaSection("@media (max-width: 1120px)", "@media (max-width: 920px)");
    const compact = getMediaSection("@media (max-width: 920px)", "@media (max-width: 680px)");
    const phone = getMediaSection("@media (max-width: 680px)", "@media (max-width: 420px)");
    const narrowPhone = getMediaSection(
      "@media (max-width: 420px)",
      "@media (max-height: 740px) and (min-width: 921px)"
    );
    const shortViewport = getMediaSection(
      "@media (max-height: 720px) and (max-width: 920px)",
      "@media (prefers-reduced-motion: reduce)"
    );

    expect(css).toContain("@media (max-width: 1280px)");
    expect(tablet).toContain(".reels-right-rail {");
    expect(tablet).toContain("grid-column: 1 / -1;");
    expect(compact).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(compact).toContain(".reels-mobile-create {");
    expect(compact).toContain("display: inline-flex;");
    expect(phone).toContain("grid-template-columns: minmax(0, 1fr) 70px;");
    expect(narrowPhone).toContain("grid-template-columns: minmax(0, 1fr) 62px;");
    expect(shortViewport).toContain("width: min(100%, 292px);");
  });

  it("honors reduced-motion preferences", () => {
    const reducedMotion = getMediaSection("@media (prefers-reduced-motion: reduce)");

    expect(reducedMotion).toContain(".reels-stream {");
    expect(reducedMotion).toContain("scroll-behavior: auto;");
    expect(reducedMotion).toContain(".reels-slide.active .reel-viewer-card,");
    expect(reducedMotion).toContain(".reel-action-btn,");
    expect(reducedMotion).toContain("transition: none;");
    expect(reducedMotion).toContain("transform: none;");
  });

  it("keeps the page structure and key visible information labels", () => {
    [
      'className="reels-left-rail"',
      'className="reels-stage"',
      'className="reels-stream"',
      'className="reels-right-rail"',
      'className="reel-actions"',
      'className="reels-queue-list"',
    ].forEach((className) => expect(page).toContain(className));

    [
      "Tengacion Reels",
      "Short videos with a stronger stage.",
      "Watch the latest creator drops, browse already published reels, and publish your own without leaving the experience.",
      "Create Reel",
      "Back Home",
      "published reels",
      "native reel uploads",
      "What works best",
      "Vertical video gets the best stage presence.",
      "Keep captions short so the video remains the focus.",
      "Use the right rail controls to jump through the stream.",
      "Already created reels",
      "Discover what creators are posting now",
      "Sound on",
      "Sound off",
      "Loading reels",
      "No reels yet",
      "Like",
      "Comments",
      "Share",
      "Profile",
      "Now playing",
      "No active reel",
      "Previous",
      "Next",
      "Refresh Reels",
      "Stream queue",
      "Reels studio",
      "Share a short-form video with your audience.",
      "Choose another video",
      "Choose reel video",
      "9:16 videos look best here.",
      "MP4, MOV, or WebM, up to 100MB.",
      "Uploading reel",
      "Cancel",
      "Posting...",
      "Post",
    ].forEach((label) => expect(page).toContain(label));
  });

  it("keeps every reel metadata binding and the six-item queue", () => {
    [
      "getReelVideoUrl(reel)",
      "getReelPoster(reel)",
      "formatRelativeTime(reel?.createdAt)",
      "getDisplayName(reel)",
      "getUsername(reel)",
      "getAvatar(reel)",
      "getLikesCount(reel)",
      "getCommentsCount(reel)",
      "reel?.likedByViewer",
      "reel?.text",
      "reels.slice(0, 6)",
      "ExpandablePostText",
    ].forEach((binding) => expect(page).toContain(binding));
  });
});
