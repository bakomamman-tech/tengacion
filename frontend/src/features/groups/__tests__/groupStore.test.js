import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  GROUPS_CHANGED_EVENT,
  GROUPS_STORAGE_KEY,
  addStoredGroupPost,
  createStoredGroup,
  purgeLegacyGroupArtifacts,
  readStoredGroups,
} from "../groupStore";

const user = {
  _id: "user-1",
  name: "Test Creator",
  username: "test_creator",
  avatar: "/avatar.png",
};

describe("groupStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts empty and persists only groups created by the current user", () => {
    expect(readStoredGroups(user)).toEqual([]);

    const group = createStoredGroup(
      {
        name: "Film Makers Network",
        description: "A place to plan productions.",
        privacy: "private",
      },
      user
    );

    expect(readStoredGroups(user)).toMatchObject([
      {
        id: group.id,
        name: "Film Makers Network",
        privacy: "private",
        members: [{ name: "Test Creator", role: "Admin" }],
      },
    ]);
    expect(readStoredGroups({ _id: "another-user" })).toEqual([]);
  });

  it("adds discussion posts to a user-created group", () => {
    const group = createStoredGroup({ name: "Writers Room" }, user);
    addStoredGroupPost(group.id, "Welcome to our first discussion.", user);

    expect(readStoredGroups(user)[0].posts).toMatchObject([
      {
        text: "Welcome to our first discussion.",
        author: { name: "Test Creator" },
      },
    ]);
  });

  it("filters legacy placeholders and purges their stale share records", () => {
    window.localStorage.setItem(
      GROUPS_STORAGE_KEY,
      JSON.stringify([
        { id: "artists-hub", ownerKey: "user-1", name: "Tengacion Artists Hub" },
      ])
    );
    window.localStorage.setItem(
      "tengacion:group-shares",
      JSON.stringify({
        "artists-hub": { postId: "old-post" },
        "real-group": { postId: "new-post" },
      })
    );
    const changed = vi.fn();
    window.addEventListener(GROUPS_CHANGED_EVENT, changed);

    purgeLegacyGroupArtifacts();

    expect(readStoredGroups(user)).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem("tengacion:group-shares"))).toEqual({
      "real-group": { postId: "new-post" },
    });
    window.removeEventListener(GROUPS_CHANGED_EVENT, changed);
  });
});
