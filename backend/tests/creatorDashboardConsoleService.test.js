const {
  buildCreatorDashboardConsole,
} = require("../services/creatorDashboardConsoleService");

describe("creatorDashboardConsoleService", () => {
  test("builds creator operating console sections from content and purchases", () => {
    const consolePayload = buildCreatorDashboardConsole({
      activation: {
        nextStep: {
          key: "first_upload_completed",
          label: "First upload completed",
          description: "Finish a creator upload.",
          actionLabel: "Finish upload",
          actionTo: "/creator/music/upload",
        },
      },
      payoutReadiness: {
        ready: false,
        label: "Profile incomplete",
        nextStep: "Add payout account details.",
      },
      content: {
        musicTracks: [
          {
            _id: "track-1",
            title: "Paid Single",
            description: "",
            price: 2000,
            earnings: 800,
            purchaseCount: 2,
            playsCount: 45,
            publishedStatus: "published",
            coverImageUrl: "",
            previewUrl: "",
            genre: "",
            updatedAt: "2026-05-01T00:00:00.000Z",
          },
        ],
        books: [
          {
            _id: "book-1",
            title: "Creator Book",
            description: "A book with a better metadata base.",
            price: 1000,
            earnings: 400,
            purchaseCount: 1,
            coverImageUrl: "https://example.com/book.jpg",
            authorName: "Author",
            fileFormat: "pdf",
            previewUrl: "https://example.com/preview.pdf",
            publishedStatus: "published",
            updatedAt: "2026-04-25T00:00:00.000Z",
          },
        ],
      },
      purchases: [
        {
          _id: "purchase-1",
          itemType: "track",
          itemId: "track-1",
          amount: 2000,
          currency: "NGN",
          userId: {
            _id: "fan-1",
            name: "Fan Example",
            username: "fan_example",
          },
          paidAt: "2026-05-02T00:00:00.000Z",
        },
        {
          _id: "sub-1",
          itemType: "subscription",
          itemId: "creator-1",
          amount: 2000,
          currency: "NGN",
          status: "paid",
          userId: {
            _id: "fan-2",
            name: "Member Example",
            username: "member_example",
          },
          paidAt: "2026-05-03T00:00:00.000Z",
          accessExpiresAt: "2026-06-03T00:00:00.000Z",
        },
      ],
    });

    expect(consolePayload.funnel).toMatchObject({
      contentItems: 2,
      publishedItems: 2,
      paidItems: 2,
      engagement: 46,
      paidPurchases: 1,
      subscribers: 1,
    });
    expect(consolePayload.recentSales[0]).toMatchObject({
      itemTitle: "Paid Single",
      buyer: expect.objectContaining({ name: "Fan Example" }),
      creatorAmount: 800,
    });
    expect(consolePayload.recentSubscribers[0]).toMatchObject({
      buyer: expect.objectContaining({ name: "Member Example" }),
      lifecycleStatus: "active",
    });
    expect(consolePayload.topContent[0]).toMatchObject({
      title: "Paid Single",
      earnings: 800,
    });
    expect(consolePayload.metadataFixes[0]).toMatchObject({
      title: "Paid Single",
      missingFields: expect.arrayContaining(["Description", "Cover image", "Paid preview", "Genre"]),
    });
    expect(consolePayload.catalogHealth).toMatchObject({
      itemCount: 2,
      monetizedItems: 2,
      issueCount: 6,
      label: "At risk",
    });
    expect(consolePayload.catalogHealth.topIssue).toMatchObject({
      itemTitle: "Paid Single",
      title: "Add cover art",
    });
    expect(consolePayload.catalogGrowthPrompts.map((prompt) => prompt.key)).toEqual(
      expect.arrayContaining([
        "catalog_missing_cover_art_track_track-1",
        "catalog_preview_track_track-1",
        "catalog_subscription_package",
      ])
    );
    expect(consolePayload.akusoTemplates.map((template) => template.key)).toEqual(
      expect.arrayContaining([
        "track_description",
        "book_blurb",
        "subscription_benefits",
        "launch_announcement",
      ])
    );
    expect(consolePayload.akusoTemplates[0]).toMatchObject({
      title: "Track description",
      actionLabel: "Copy prompt",
      requiresReview: true,
    });
    expect(consolePayload.actionPrompts.map((prompt) => prompt.key)).toEqual(
      expect.arrayContaining([
        "activation_first_upload_completed",
        "payout_readiness",
        "metadata_fixes",
        "growth_catalog_missing_cover_art_track_track-1",
      ])
    );
  });
});
