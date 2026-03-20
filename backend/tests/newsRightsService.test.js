const { enforceStoryRights } = require("../services/newsRightsService");

describe("newsRightsService", () => {
  test("strips bodyHtml when full in-app display is not allowed", () => {
    const story = enforceStoryRights({
      title: "Example story",
      bodyHtml: "<p>Full article body</p>",
      summaryText: "Summary only",
      canonicalUrl: "https://publisher.example.com/story",
      rights: {
        mode: "SUMMARY_PLUS_LINKOUT",
        allowBodyHtml: false,
        allowSummary: true,
        attributionRequired: true,
        canonicalLinkRequired: true,
      },
    });

    expect(story.bodyHtml).toBe("");
    expect(story.summaryText).toBe("Summary only");
    expect(story.canonicalUrl).toBe("https://publisher.example.com/story");
    expect(story.display.canRenderFullText).toBe(false);
    expect(story.display.linkOutOnly).toBe(true);
  });
});
