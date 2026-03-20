const { clusterStories } = require("../services/newsClusterService");

describe("newsClusterService", () => {
  test("clusters matching coverage using headline similarity and entity overlap", () => {
    const now = new Date().toISOString();
    const stories = [
      {
        _id: "story-a",
        sourceSlug: "reuters",
        externalId: "a",
        title: "Lagos officials expand flood response after overnight storm",
        canonicalUrl: "https://reuters.example.com/lagos-flood",
        publishedAt: now,
        articleType: "breaking",
        topicTags: ["climate", "lagos"],
        namedEntities: ["Lagos", "Emergency Management Agency"],
        geography: { scope: "local", primaryCountry: "Nigeria", primaryState: "Lagos" },
        rights: { mode: "SUMMARY_PLUS_LINKOUT" },
        moderation: { status: "approved", sourceTrustScore: 0.9, trustScore: 0.9 },
        scoring: { finalScore: 0.82, importanceScore: 0.9, freshnessScore: 0.8 },
      },
      {
        _id: "story-b",
        sourceSlug: "guardian",
        externalId: "b",
        title: "Lagos expands flood response after severe overnight rainfall",
        canonicalUrl: "https://guardian.example.com/lagos-flood-response",
        publishedAt: now,
        articleType: "report",
        topicTags: ["climate", "lagos"],
        namedEntities: ["Lagos", "Emergency Management Agency"],
        geography: { scope: "local", primaryCountry: "Nigeria", primaryState: "Lagos" },
        rights: { mode: "SUMMARY_PLUS_LINKOUT" },
        moderation: { status: "approved", sourceTrustScore: 0.86, trustScore: 0.86 },
        scoring: { finalScore: 0.78, importanceScore: 0.82, freshnessScore: 0.8 },
      },
      {
        _id: "story-c",
        sourceSlug: "ap",
        externalId: "c",
        title: "Global markets steady as investors weigh rate outlook",
        canonicalUrl: "https://ap.example.com/world-markets",
        publishedAt: now,
        articleType: "analysis",
        topicTags: ["business"],
        namedEntities: ["Federal Reserve"],
        geography: { scope: "international", primaryCountry: "United States" },
        rights: { mode: "SUMMARY_PLUS_LINKOUT" },
        moderation: { status: "approved", sourceTrustScore: 0.88, trustScore: 0.88 },
        scoring: { finalScore: 0.61, importanceScore: 0.66, freshnessScore: 0.8 },
      },
    ];

    const clusters = clusterStories(stories, {
      similarityThreshold: 0.6,
      entityThreshold: 0.4,
      maxDeltaMs: 8 * 60 * 60 * 1000,
    });

    expect(clusters).toHaveLength(2);
    const coverageCluster = clusters.find((entry) => Number(entry.sourceCount || 0) === 2);
    expect(coverageCluster).toBeTruthy();
    expect(coverageCluster.storyCount).toBe(2);
    expect(coverageCluster.topicTags).toEqual(expect.arrayContaining(["climate", "lagos"]));
  });
});
