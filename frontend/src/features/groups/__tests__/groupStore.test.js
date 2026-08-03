import { beforeEach, describe, expect, it } from "vitest";

import * as groupStore from "../groupStore";

describe("groupStore server-authority boundary", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("normalizes server group documents without creating a browser owner record", () => {
    expect(
      groupStore.normalizeGroup({
        _id: "group-1",
        name: "Film Makers Network",
        privacy: "private",
        owner: { _id: "owner-1", name: "Test Creator" },
        members: [{ _id: "member-1", username: "member_one", role: "Admin" }],
        posts: [
          {
            _id: "post-1",
            text: "Welcome to our first discussion.",
            author: { _id: "owner-1", name: "Test Creator" },
          },
        ],
      })
    ).toMatchObject({
      id: "group-1",
      name: "Film Makers Network",
      privacy: "private",
      owner: { id: "owner-1", name: "Test Creator" },
      members: [{ id: "member-1", username: "member_one", role: "Admin" }],
      posts: [{ id: "post-1", text: "Welcome to our first discussion." }],
    });
  });

  it("filters malformed and retired placeholder records", () => {
    expect(
      groupStore.normalizeGroups([
        { id: "artists-hub", name: "Retired placeholder" },
        { name: "Missing identity" },
        { id: "server-group", name: "Server group" },
      ])
    ).toEqual([expect.objectContaining({ id: "server-group", name: "Server group" })]);
  });

  it("removes legacy group caches instead of reading or preserving them", () => {
    window.localStorage.setItem("tengacion:user-groups:v1", JSON.stringify([{ id: "local" }]));
    window.localStorage.setItem("tengacion:group-shares", JSON.stringify({ local: {} }));

    expect(groupStore.purgeLegacyGroupArtifacts()).toEqual([
      "tengacion:user-groups:v1",
      "tengacion:group-shares",
    ]);
    expect(window.localStorage.getItem("tengacion:user-groups:v1")).toBeNull();
    expect(window.localStorage.getItem("tengacion:group-shares")).toBeNull();
  });

  it("does not expose browser-backed group mutation APIs", () => {
    expect(groupStore).not.toHaveProperty("readStoredGroups");
    expect(groupStore).not.toHaveProperty("replaceStoredGroups");
    expect(groupStore).not.toHaveProperty("createStoredGroup");
    expect(groupStore).not.toHaveProperty("addStoredGroupPost");
  });
});
