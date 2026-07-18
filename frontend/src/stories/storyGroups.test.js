import { describe, expect, it } from "vitest";

import { groupStoriesByOwner, markStoriesSeen } from "./storyGroups";

describe("storyGroups", () => {
  it("groups owners, orders each owner's stories newest first, and prioritizes owner then unseen", () => {
    const stories = [
      {
        _id: "friend-seen",
        userId: "friend-seen-owner",
        username: "Seen Friend",
        time: "2026-07-18T12:00:00.000Z",
        viewerSeen: true,
      },
      {
        _id: "friend-unseen-old",
        userId: "friend-unseen-owner",
        username: "Unseen Friend",
        time: "2026-07-18T10:00:00.000Z",
        viewerSeen: false,
      },
      {
        _id: "owner-story",
        userId: "viewer-1",
        username: "Me",
        time: "2026-07-18T09:00:00.000Z",
        viewerSeen: true,
      },
      {
        _id: "friend-unseen-new",
        userId: "friend-unseen-owner",
        username: "Unseen Friend",
        time: "2026-07-18T11:00:00.000Z",
        viewerSeen: false,
      },
    ];

    const groups = groupStoriesByOwner(stories, "viewer-1");

    expect(groups.map((group) => group.ownerId)).toEqual([
      "viewer-1",
      "friend-unseen-owner",
      "friend-seen-owner",
    ]);
    expect(groups[1].latestStory._id).toBe("friend-unseen-new");
    expect(groups[1].stories.map((story) => story._id)).toEqual([
      "friend-unseen-new",
      "friend-unseen-old",
    ]);
    expect(groups[1].hasUnseen).toBe(true);
  });

  it("marks only the requested stories as seen without duplicating the viewer", () => {
    const untouched = { _id: "story-1", seenBy: [], viewerSeen: false };
    const alreadySeen = { _id: "story-2", seenBy: ["viewer-1"], viewerSeen: false };
    const stories = [untouched, alreadySeen];

    const next = markStoriesSeen(stories, ["story-2"], "viewer-1");

    expect(next).not.toBe(stories);
    expect(next[0]).toBe(untouched);
    expect(next[1]).toEqual({
      _id: "story-2",
      seenBy: ["viewer-1"],
      viewerSeen: true,
    });
    expect(markStoriesSeen(next, ["story-2"], "viewer-1")).toBe(next);
  });
});

