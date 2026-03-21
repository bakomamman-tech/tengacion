const mongoose = require("mongoose");

require("../config/env");

const connectDB = require("../config/db");
const NewsPublisherContract = require("../models/NewsPublisherContract");
const NewsSource = require("../models/NewsSource");
const { NEWS_SOURCE_CATALOG } = require("../config/newsSources");
const { syncNewsCatalog } = require("../services/newsCatalogService");
const { runClusterNewsJob } = require("../jobs/clusterNews.job");
const { runIngestNewsJob } = require("../jobs/ingestNews.job");
const { runScoreNewsJob } = require("../jobs/scoreNews.job");

const contracts = [
  {
    sourceSlug: "reuters",
    contractName: "Reuters Daily Summary License",
    contractVersion: "2026.03",
    publisherTier: "licensed",
    rightsModeDefault: "SUMMARY_PLUS_LINKOUT",
    rights: {
      mode: "SUMMARY_PLUS_LINKOUT",
      attributionRequired: true,
      canonicalLinkRequired: true,
      allowBodyHtml: false,
      allowSummary: true,
      allowThumbnail: true,
      allowEmbed: false,
    },
  },
  {
    sourceSlug: "ap",
    contractName: "AP Summary Distribution License",
    contractVersion: "2026.03",
    publisherTier: "licensed",
    rightsModeDefault: "SUMMARY_PLUS_LINKOUT",
    rights: {
      mode: "SUMMARY_PLUS_LINKOUT",
      attributionRequired: true,
      canonicalLinkRequired: true,
      allowBodyHtml: false,
      allowSummary: true,
      allowThumbnail: true,
      allowEmbed: false,
    },
  },
  {
    sourceSlug: "guardian",
    contractName: "Guardian Partner Distribution",
    contractVersion: "2026.03",
    publisherTier: "partner",
    rightsModeDefault: "SUMMARY_PLUS_LINKOUT",
    rights: {
      mode: "SUMMARY_PLUS_LINKOUT",
      attributionRequired: true,
      canonicalLinkRequired: true,
      allowBodyHtml: false,
      allowSummary: true,
      allowThumbnail: true,
      allowEmbed: false,
    },
  },
];

const mockStoriesBySource = {
  reuters: [
    {
      externalId: "reuters-lagos-flood-1",
      title: "Lagos officials roll out emergency flood response across coastal districts",
      subtitle: "City teams open shelters as heavy rainfall disrupts commuting routes",
      summaryText:
        "Emergency management teams in Lagos say they have opened temporary shelters and redirected traffic after overnight flooding affected several coastal districts.",
      canonicalUrl: "https://www.reuters.com/world/africa/lagos-flood-response-2026-03-20/",
      publishedAt: new Date().toISOString(),
      authorByline: "Reuters Staff",
      tags: ["climate", "weather", "safety", "nigeria", "lagos"],
      rights: { mode: "SUMMARY_PLUS_LINKOUT" },
      assets: [
        {
          externalId: "reuters-lagos-flood-asset",
          role: "hero",
          url: "https://images.example.com/reuters-lagos-flood.jpg",
          secureUrl: "https://images.example.com/reuters-lagos-flood.jpg",
          altText: "Flooded street in Lagos",
        },
      ],
      raw: { location: "Lagos, Nigeria" },
    },
    {
      externalId: "reuters-africa-ai-1",
      title: "African startups attract new AI infrastructure funding",
      subtitle: "Investors cite rising demand for local cloud and data tools",
      summaryText:
        "A new wave of investors is backing African AI infrastructure startups as governments and enterprises increase demand for local tools and trusted data systems.",
      canonicalUrl: "https://www.reuters.com/world/africa/africa-ai-funding-2026-03-20/",
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      authorByline: "Reuters Staff",
      tags: ["technology", "business", "africa"],
      rights: { mode: "SUMMARY_PLUS_LINKOUT" },
      raw: { location: "Africa" },
    },
  ],
  ap: [
    {
      externalId: "ap-global-rates-watch",
      title: "Global markets steady as investors weigh rate outlook",
      subtitle: "Central bank signals keep international traders cautious",
      summaryText:
        "Investors across major markets are tracking central bank guidance and inflation data as they reassess the path for interest rates.",
      canonicalUrl: "https://apnews.com/article/global-markets-rates-2026-03-20",
      publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      authorByline: "AP Business Desk",
      tags: ["world", "business", "economy"],
      rights: { mode: "SUMMARY_PLUS_LINKOUT" },
      raw: { location: "Global" },
    },
  ],
  guardian: [
    {
      externalId: "guardian-naira-explainer",
      title: "Explainer: what a steadier naira could mean for creators and small businesses",
      subtitle: "A look at pricing, imports, and audience spending",
      summaryText:
        "A steadier naira changes how independent creators price digital goods, advertising, and international subscriptions across Nigeria.",
      canonicalUrl: "https://www.theguardian.com/world/2026/mar/20/naira-creators-explainer",
      publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      authorByline: "Guardian Nigeria Desk",
      tags: ["business", "explainer", "nigeria", "economy"],
      rights: { mode: "SUMMARY_PLUS_LINKOUT" },
      raw: { location: "Nigeria" },
    },
    {
      externalId: "guardian-opinion-education",
      title: "Opinion: why digital skills policy needs a stronger public-school focus",
      subtitle: "Investment is rising, but classroom access remains uneven",
      summaryText:
        "A sustainable digital economy needs more attention to public-school infrastructure, teachers, and equitable student access.",
      canonicalUrl: "https://www.theguardian.com/commentisfree/2026/mar/20/digital-skills-public-school-focus",
      publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      authorByline: "Guest Columnist",
      tags: ["education", "technology", "opinion", "nigeria"],
      rights: { mode: "SUMMARY_PLUS_LINKOUT" },
      raw: { location: "Nigeria" },
    },
  ],
  "channels-tv": [
    {
      externalId: "channels-budget-watch",
      title: "Senate committee opens new review round for transport and education allocations",
      subtitle: "Lawmakers say the focus is service delivery and budget efficiency",
      summaryText:
        "Committee hearings on transport and education spending are expected to shape how projects are prioritized in the coming quarter.",
      canonicalUrl: "https://www.channelstv.com/2026/03/20/senate-review-transport-education-allocations/",
      publishedAt: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
      authorByline: "Channels TV",
      tags: ["politics", "education", "transport", "nigeria"],
      rights: { mode: "SUMMARY_PLUS_LINKOUT" },
      raw: { location: "Abuja, Nigeria" },
    },
  ],
  "premium-times": [
    {
      externalId: "premium-times-tech-hubs",
      title: "New digital innovation hubs expand access for student founders in three Nigerian states",
      subtitle: "Operators say the next phase will focus on mentoring and local partnerships",
      summaryText:
        "New hubs in Lagos, Enugu, and Kano aim to help student founders access training, internet infrastructure, and small grants.",
      canonicalUrl: "https://www.premiumtimesng.com/news/top-news/2026/03/20/new-digital-innovation-hubs-expand-access.html",
      publishedAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
      authorByline: "Premium Times Reporter",
      tags: ["technology", "education", "business", "nigeria"],
      rights: { mode: "SUMMARY_PLUS_LINKOUT" },
      raw: { location: "Nigeria" },
    },
  ],
  "lagos-traffic-radio": [
    {
      externalId: "lagos-traffic-radio-island-routes",
      title: "Lagos transit agency adds early-morning buses on island routes",
      subtitle: "New schedule targets workers and students before rush hour",
      summaryText:
        "The agency says the added buses will reduce wait times on high-demand island routes and improve early-morning mobility for commuters.",
      canonicalUrl: "https://lagostrafficradio.com/news/early-morning-buses-island-routes",
      publishedAt: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
      authorByline: "Lagos Traffic Radio",
      tags: ["local", "transport", "community", "lagos"],
      rights: { mode: "SUMMARY_PLUS_LINKOUT" },
      raw: { location: "Lagos, Nigeria" },
    },
  ],
  "nema-alerts": [
    {
      externalId: "nema-flood-advisory-2026",
      title: "Emergency advisory urges residents in flood-prone Lagos communities to prepare for overnight rainfall",
      subtitle: "Authorities recommend route planning and monitoring official shelter updates",
      summaryText:
        "Emergency officials say residents in vulnerable communities should stay alert, monitor official channels, and avoid known flood corridors during overnight rain.",
      canonicalUrl: "https://nema.gov.ng/advisories/flood-advisory-lagos-2026-03-20",
      publishedAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      authorByline: "NEMA",
      tags: ["safety", "weather", "public-interest", "lagos"],
      rights: { mode: "SUMMARY_PLUS_LINKOUT" },
      raw: { location: "Lagos, Nigeria" },
    },
  ],
  nimet: [
    {
      externalId: "nimet-weekend-rainfall-outlook",
      title: "NiMet forecasts heavy rainfall across parts of south-west Nigeria this weekend",
      subtitle: "Transport and drainage agencies are asked to prepare for disruptions",
      summaryText:
        "Meteorological officials say periods of intense rainfall are likely in parts of south-west Nigeria, with possible effects on transport and drainage systems.",
      canonicalUrl: "https://nimet.gov.ng/bulletins/weekend-rainfall-outlook-2026-03-20",
      publishedAt: new Date(Date.now() - 100 * 60 * 1000).toISOString(),
      authorByline: "NiMet",
      tags: ["weather", "climate", "safety", "nigeria"],
      rights: { mode: "SUMMARY_PLUS_LINKOUT" },
      raw: { location: "Nigeria" },
    },
  ],
  "who-africa": [
    {
      externalId: "who-africa-vaccination-drive",
      title: "WHO Africa highlights expanded vaccination support in West Africa",
      subtitle: "Regional teams say logistics and local partnerships remain central",
      summaryText:
        "Regional health teams say the next phase of vaccination support in West Africa will focus on logistics, outreach, and verified local information.",
      canonicalUrl: "https://www.afro.who.int/news/expanded-vaccination-support-west-africa",
      publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      authorByline: "WHO Africa",
      tags: ["health", "world", "africa", "public-interest"],
      rights: { mode: "SUMMARY_PLUS_LINKOUT" },
      raw: { location: "West Africa" },
    },
  ],
  gdelt: [
    {
      externalId: "gdelt-world-elections-watch",
      title: "Election security dominates international briefing circuit",
      summaryText:
        "Global monitoring desks highlight election security, misinformation risks, and diplomatic responses across several countries.",
      canonicalUrl: "https://www.gdeltproject.org/example/elections-watch",
      publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      tags: ["world", "politics", "elections"],
      rights: { mode: "THUMBNAIL_LINKOUT" },
      raw: { location: "Global" },
    },
  ],
};

const run = async () => {
  await connectDB();

  try {
    await syncNewsCatalog();

    const sourceDocs = {};
    for (const source of NEWS_SOURCE_CATALOG) {
      sourceDocs[source.slug] = await NewsSource.findOne({ slug: source.slug });
    }

    for (const contract of contracts) {
      const source = sourceDocs[contract.sourceSlug];
      if (!source) {
        continue;
      }
      await NewsPublisherContract.findOneAndUpdate(
        {
          sourceId: source._id,
          contractName: contract.contractName,
        },
        {
          $set: {
            sourceId: source._id,
            contractName: contract.contractName,
            contractVersion: contract.contractVersion,
            publisherTier: contract.publisherTier,
            status: "active",
            rightsModeDefault: contract.rightsModeDefault,
            rights: contract.rights,
            attribution: {
              displayName: source.displayName,
              attributionRequired: true,
              canonicalLinkRequired: true,
            },
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    const ingestResult = await runIngestNewsJob({
      sourceIds: Object.values(sourceDocs)
        .filter(Boolean)
        .map((entry) => entry._id),
      limitPerSource: 8,
      mockStoriesBySource,
    });
    const clusterResult = await runClusterNewsJob({ limit: 160 });
    const scoreResult = await runScoreNewsJob({ limit: 160 });

    console.log("Sample news data ready");
    console.log({
      sourceCount: Object.keys(sourceDocs).length,
      ingestResult,
      clusterResult: {
        storyCount: clusterResult.storyCount,
        clusterCount: clusterResult.clusterCount,
      },
      scoreResult,
    });
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("Failed to seed sample news data:", error?.message || error);
  process.exit(1);
});
