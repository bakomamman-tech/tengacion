import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import registry from "../routeTruthRegistry.json";
import {
  decorateNavigationItems,
  getRouteTruth,
  isLifecycleNavigable,
} from "../routeTruth";

const REQUIRED_FIELDS = [
  "id",
  "title",
  "status",
  "surface",
  "access",
  "canonicalPath",
  "appPaths",
  "dataAuthority",
  "ownerRole",
  "kpi",
  "featureFlag",
  "testEvidence",
];

const declaredAppPaths = () => {
  const source = readFileSync(resolve(process.cwd(), "src/App.jsx"), "utf8");
  return [...source.matchAll(/<Route\b[^>]*\bpath="([^"]+)"/g)].map(
    (match) => match[1]
  );
};

describe("route truth registry", () => {
  it("accounts for every App route exactly once", () => {
    const appPaths = declaredAppPaths();
    const registeredPaths = registry.features.flatMap((feature) => feature.appPaths);

    expect(appPaths).toHaveLength(181);
    expect(new Set(registeredPaths).size).toBe(registeredPaths.length);
    expect([...registeredPaths].sort()).toEqual([...appPaths].sort());
  });

  it("keeps the required ownership and evidence metadata on every feature", () => {
    for (const feature of registry.features) {
      for (const field of REQUIRED_FIELDS) {
        expect(feature).toHaveProperty(field);
      }
      expect(feature.appPaths.length).toBeGreaterThan(0);
      expect(feature.dataAuthority).not.toBe("");
      expect(feature.ownerRole).not.toBe("");
      expect(feature.kpi).not.toBe("");
      expect(Array.isArray(feature.testEvidence)).toBe(true);
    }
  });

  it("contains Preview navigation and labels non-production lifecycles", () => {
    const dashboard = getRouteTruth("/dashboard");
    expect(dashboard).toEqual(expect.objectContaining({ status: "preview" }));
    expect(isLifecycleNavigable(dashboard)).toBe(false);

    expect(
      decorateNavigationItems([
        { label: "Dashboard", path: "/dashboard" },
        { label: "Groups", path: "/groups" },
        { label: "Gaming", path: "/gaming" },
      ])
    ).toEqual([
      expect.objectContaining({ label: "Groups", lifecycleLabel: "Beta" }),
      expect.objectContaining({ label: "Gaming", lifecycleLabel: "Experimental" }),
    ]);
  });

  it("records one public creator canonical family and explicit compatibility routes", () => {
    const creatorProfiles = registry.features.find(
      (feature) => feature.id === "public_creator_profiles"
    );

    expect(creatorProfiles).toEqual(
      expect.objectContaining({
        access: "mixed",
        canonicalPath: "/creator/:username",
        routeContract: {
          publicCanonicalFamily: "/creator/:username",
          idCompatibilityFamily: "/creators/:creatorId",
          artistCompatibilityPath: "/artist/:username",
          readAccess: "public",
          authenticatedActions: ["follow", "message", "purchase", "subscribe"],
        },
      })
    );
    expect(getRouteTruth("/artist/creator.example")).toBe(creatorProfiles);
    expect(getRouteTruth("/creator/creator.example/books")).toBe(creatorProfiles);
  });
});
