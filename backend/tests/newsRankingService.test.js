const { computePublicInterestBoost, scoreStory } = require("../services/newsRankingService");

describe("newsRankingService", () => {
  test("ranks fresh local stories above older less relevant stories", () => {
    const localBreaking = scoreStory(
      {
        sourceSlug: "lagos-daily",
        articleType: "breaking",
        topicTags: ["lagos", "transport"],
        geography: { scope: "local", primaryCountry: "Nigeria", primaryState: "Lagos" },
        moderation: { sourceTrustScore: 0.8, trustScore: 0.8 },
        publishedAt: new Date().toISOString(),
      },
      {
        source: { displayName: "Lagos Daily", trustScore: 0.8 },
        userGeo: { country: "Nigeria", state: "Lagos", city: "Lagos" },
        preferences: {
          preferredTopics: ["transport", "lagos"],
          followedSourceSlugs: ["lagos-daily"],
        },
      }
    );

    const staleWorldOpinion = scoreStory(
      {
        sourceSlug: "world-opinion",
        articleType: "opinion",
        topicTags: ["politics"],
        geography: { scope: "international", primaryCountry: "France" },
        moderation: { sourceTrustScore: 0.65, trustScore: 0.65 },
        publishedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      },
      {
        source: { displayName: "World Opinion", trustScore: 0.65 },
        userGeo: { country: "Nigeria", state: "Lagos", city: "Lagos" },
        preferences: {
          preferredTopics: ["transport", "lagos"],
        },
      }
    );

    expect(localBreaking.finalScore).toBeGreaterThan(staleWorldOpinion.finalScore);
    expect(localBreaking.localRelevanceScore).toBeGreaterThan(staleWorldOpinion.localRelevanceScore);
  });

  test("adds a stronger public-interest boost to non-opinion civic coverage than opinion pieces", () => {
    const publicInterest = computePublicInterestBoost(
      {
        articleType: "breaking",
        isBreaking: true,
        topicTags: ["politics", "education"],
        geography: { scope: "national", primaryCountry: "Nigeria" },
        moderation: { sensitiveFlags: ["elections"], sourceTrustScore: 0.9 },
      },
      {
        source: { trustScore: 0.9 },
      }
    );

    const opinionBoost = computePublicInterestBoost(
      {
        articleType: "opinion",
        isOpinion: true,
        topicTags: ["politics"],
        geography: { scope: "national", primaryCountry: "Nigeria" },
        moderation: { sensitiveFlags: ["elections"], sourceTrustScore: 0.9 },
      },
      {
        source: { trustScore: 0.9 },
      }
    );

    expect(publicInterest).toBeGreaterThan(opinionBoost);
    expect(opinionBoost).toBe(0);
  });
});
