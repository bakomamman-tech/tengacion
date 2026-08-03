const {
  FEATURE_REGISTRY,
  SAFE_ACTION_PERMISSIONS,
  buildFeatureCard,
  listVisibleFeatures,
} = require("../services/assistant/featureRegistry");
const {
  findFeatureByIntent,
  listRelevantFeatures,
} = require("../services/akusoFeatureRegistryService");
const {
  getHelpArticleByFeatureId,
  searchHelpArticles,
} = require("../services/assistant/helpDocs");
const { retrieveAssistantContext } = require("../services/assistant/retrieval");

const PREVIEW_FEATURE_IDS = [
  "professional_dashboard",
  "memories",
  "saved",
  "events",
  "ads_manager",
];

describe("authoritative route truth", () => {
  it("classifies every legacy assistant feature against the route registry", () => {
    expect(
      FEATURE_REGISTRY.filter((feature) => feature.lifecycleStatus === "unclassified").map(
        (feature) => ({ id: feature.id, route: feature.route })
      )
    ).toEqual([]);
  });

  it.each(PREVIEW_FEATURE_IDS)("contains %s as a non-actionable Preview", (featureId) => {
    const feature = FEATURE_REGISTRY.find((entry) => entry.id === featureId);

    expect(feature).toEqual(
      expect.objectContaining({
        lifecycleStatus: "preview",
        availabilityStatus: "preview",
        navigationVisible: false,
        assistantEnabled: false,
        allowedActions: [],
      })
    );
    expect(SAFE_ACTION_PERMISSIONS[featureId]).toEqual(
      expect.objectContaining({ route: "", lifecycleStatus: "preview", allowedActions: [] })
    );
    expect(buildFeatureCard(feature)).toEqual(
      expect.objectContaining({ type: "info", route: "", lifecycleStatus: "preview" })
    );
  });

  it("excludes Preview surfaces from visible and recommended assistant features", () => {
    const visibleIds = listVisibleFeatures({ surface: "social" }).map((feature) => feature.id);
    const relevantIds = listRelevantFeatures({
      query: "saved memories events",
      currentRoute: "/home",
      user: { id: "truth-user" },
      limit: 100,
    }).map((feature) => feature.featureKey);

    expect(visibleIds).not.toEqual(expect.arrayContaining(["saved", "memories", "events"]));
    expect(relevantIds).not.toEqual(expect.arrayContaining(PREVIEW_FEATURE_IDS));
  });

  it("lets Akuso explain Preview truth without offering navigation or actions", () => {
    const saved = findFeatureByIntent("open saved bookmarks");

    expect(saved).toEqual(
      expect.objectContaining({
        featureKey: "saved",
        availabilityStatus: "preview",
        routePattern: "",
        userFacingActions: [],
      })
    );
    expect(saved.safeNavigationSteps.join(" ")).toMatch(/not available|Preview/i);
  });

  it("blocks Preview routes in the legacy assistant retrieval and help pipeline", () => {
    const retrieved = retrieveAssistantContext({
      query: "saved bookmarks",
      classification: { category: "app_guidance" },
      context: { currentSurface: "social" },
    });

    expect(retrieved.feature).toEqual(
      expect.objectContaining({
        id: "saved",
        route: "",
        lifecycleStatus: "preview",
        assistantEnabled: false,
        allowedActions: [],
      })
    );
    expect(getHelpArticleByFeatureId("saved")).toBeNull();
  });

  it("exposes server-backed Feedback as a navigable Beta capability", () => {
    const feature = FEATURE_REGISTRY.find((entry) => entry.id === "feedback");
    const retrieved = retrieveAssistantContext({
      query: "feedback",
      classification: { category: "app_guidance" },
      context: { currentSurface: "support" },
    });

    expect(feature).toEqual(
      expect.objectContaining({
        lifecycleStatus: "beta",
        availabilityStatus: "beta",
        navigationVisible: true,
        assistantEnabled: true,
        route: "/feedback",
      })
    );
    expect(SAFE_ACTION_PERMISSIONS.feedback).toEqual(
      expect.objectContaining({
        route: "/feedback",
        lifecycleStatus: "beta",
        allowedActions: expect.arrayContaining(["submit feedback", "report bug"]),
      })
    );
    expect(buildFeatureCard(feature)).toEqual(
      expect.objectContaining({ type: "quick-link", route: "/feedback", lifecycleStatus: "beta" })
    );
    expect(retrieved.feature).toEqual(
      expect.objectContaining({
        id: "feedback",
        route: "/feedback",
        lifecycleStatus: "beta",
        assistantEnabled: true,
      })
    );
    expect(getHelpArticleByFeatureId("feedback")).toEqual(
      expect.objectContaining({ id: "report-abuse", route: "/feedback?type=safety" })
    );
    expect(
      searchHelpArticles("report abuse", { limit: 10 }).map(
        (article) => article.feature?.id || ""
      )
    ).toContain("feedback");
  });
});
