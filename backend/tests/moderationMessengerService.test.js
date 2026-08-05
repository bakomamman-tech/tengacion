const {
  buildModerationMessageText,
} = require("../services/moderationMessengerService");

describe("moderation messenger copy", () => {
  test("approval updates do not imply that the uploader violated a rule", () => {
    const message = buildModerationMessageText({
      action: "approve",
      subjectTitle: "Alias Safe Track",
      reason: "Moderation review",
    });

    expect(message).toContain("Your upload has been approved for publication.");
    expect(message).toContain("No further action is required.");
    expect(message).not.toMatch(/do not re-upload|continued violations/i);
  });

  test("technical holds are identified as inspection issues rather than safety findings", () => {
    const message = buildModerationMessageText({
      action: "hold_for_review",
      subjectTitle: "Alias Safe Track",
      reason: "Some attachments exceeded the bounded scan batch.",
      labels: [
        "mime:image/jpeg",
        "uploader:user-1",
        "inspection_failed",
        "media_asset_limit_exceeded",
      ],
    });

    expect(message).toContain("placed on hold for additional review");
    expect(message).toContain("technical review hold");
    expect(message).toContain("not a finding that the upload violated a safety rule");
    expect(message).not.toMatch(/do not re-upload prohibited content/i);
  });

  test("confirmed safety rejections retain the community-rules warning", () => {
    const message = buildModerationMessageText({
      action: "reject",
      subjectTitle: "Rejected upload",
      labels: ["explicit_pornography"],
    });

    expect(message).toContain("rejected because it violates our community rules");
    expect(message).toContain("Explicit pornography");
    expect(message).toContain("Please do not re-upload prohibited content");
  });
});
