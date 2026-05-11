const request = require("supertest");

const app = require("../app");
const { config } = require("../config/env");
const {
  buildAndroidAssetLinks,
  normalizeFingerprint,
} = require("../services/androidAssetLinksService");

const RAW_SHA256 = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const COLON_SHA256 =
  "00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF";

describe("Android Digital Asset Links", () => {
  const originalAndroidTwa = config.androidTwa;

  afterEach(() => {
    config.androidTwa = originalAndroidTwa;
  });

  it("normalizes Google Play SHA-256 fingerprints", () => {
    expect(normalizeFingerprint(RAW_SHA256)).toBe(COLON_SHA256);
    expect(normalizeFingerprint(COLON_SHA256.toLowerCase())).toBe(COLON_SHA256);
    expect(normalizeFingerprint("not-a-fingerprint")).toBe("");
  });

  it("builds a Digital Asset Links statement for a valid package", () => {
    expect(
      buildAndroidAssetLinks({
        packageName: "com.tengacion.app",
        sha256CertFingerprints: [RAW_SHA256, COLON_SHA256],
      })
    ).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.tengacion.app",
          sha256_cert_fingerprints: [COLON_SHA256],
        },
      },
    ]);
  });

  it("does not serve placeholder asset links before signing config exists", async () => {
    config.androidTwa = {
      packageName: "",
      sha256CertFingerprints: [],
      configured: false,
    };

    const response = await request(app).get("/.well-known/assetlinks.json").expect(404);

    expect(response.type).toMatch(/json/);
    expect(response.text).not.toContain("<!doctype html>");
  });

  it("serves the configured TWA asset links endpoint", async () => {
    config.androidTwa = {
      packageName: "com.tengacion.app",
      sha256CertFingerprints: [RAW_SHA256],
      configured: true,
    };

    const response = await request(app).get("/.well-known/assetlinks.json").expect(200);

    expect(response.type).toMatch(/json/);
    expect(response.body).toEqual([
      expect.objectContaining({
        relation: ["delegate_permission/common.handle_all_urls"],
        target: expect.objectContaining({
          namespace: "android_app",
          package_name: "com.tengacion.app",
          sha256_cert_fingerprints: [COLON_SHA256],
        }),
      }),
    ]);
  });
});
