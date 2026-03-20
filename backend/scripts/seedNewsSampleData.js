const mongoose = require("mongoose");

require("../config/env");

const connectDB = require("../config/db");
const NewsPublisherContract = require("../models/NewsPublisherContract");
const NewsSource = require("../models/NewsSource");
const { runClusterNewsJob } = require("../jobs/clusterNews.job");
const { runIngestNewsJob } = require("../jobs/ingestNews.job");
const { runScoreNewsJob } = require("../jobs/scoreNews.job");

const sources = [
  {
    slug: "reuters",
    displayName: "Reuters",
    publisherName: "Reuters",
    providerType: "reuters",
    publisherTier: "licensed",
    sourceType: "wire",
    homepageUrl: "https://www.reuters.com",
    canonicalDomain: "reuters.com",
    trustScore: 0.92,
    attribution: {
      displayName: "Reuters",
      attributionRequired: true,
      canonicalLinkRequired: true,
    },
    ingest: { enabled: true },
  },
  {
    slug: "guardian",
    displayName: "The Guardian",
    publisherName: "The Guardian",
    providerType: "guardian",
    publisherTier: "partner",
    sourceType: "publisher",
    homepageUrl: "https://www.theguardian.com",
    canonicalDomain: "theguardian.com",
    trustScore: 0.86,
    attribution: {
      displayName: "The Guardian",
      attributionRequired: true,
      canonicalLinkRequired: true,
    },
    ingest: { enabled: true },
  },
  {
    slug: "lagos-daily",
    displayName: "Lagos Daily",
    publisherName: "Lagos Daily",
    providerType: "partner_rss",
    publisherTier: "partner",
    sourceType: "local",
    homepageUrl: "https://lagosdaily.example.com",
    canonicalDomain: "lagosdaily.example.com",
    trustScore: 0.79,
    countries: ["Nigeria"],
    states: ["Lagos"],
    attribution: {
      displayName: "Lagos Daily",
      attributionRequired: true,
      canonicalLinkRequired: true,
    },
    ingest: { enabled: true },
  },
  {
    slug: "gdelt",
    displayName: "GDELT Discovery",
    publisherName: "GDELT",
    providerType: "gdelt",
    publisherTier: "discovery",
    sourceType: "aggregator",
    homepageUrl: "https://www.gdeltproject.org",
    canonicalDomain: "gdeltproject.org",
    trustScore: 0.62,
    discoveryOnly: true,
    attribution: {
      displayName: "GDELT Discovery",
      attributionRequired: true,
      canonicalLinkRequired: true,
    },
    ingest: { enabled: true },
  },
];

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
      tags: ["climate", "nigeria", "lagos"],
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
      tags: ["business", "explainer", "nigeria"],
      rights: { mode: "SUMMARY_PLUS_LINKOUT" },
      raw: { location: "Nigeria" },
    },
  ],
  "lagos-daily": [
    {
      externalId: "lagos-daily-transit-upgrade",
      title: "Lagos transit agency adds early-morning buses on island routes",
      subtitle: "New schedule targets workers and students before rush hour",
      summaryText:
        "The agency says the added buses will reduce wait times on high-demand island routes and improve early-morning mobility for commuters.",
      canonicalUrl: "https://lagosdaily.example.com/news/transit-upgrade",
      publishedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      authorByline: "Lagos Daily Reporter",
      tags: ["local", "transport", "lagos"],
      rights: { mode: "SUMMARY_PLUS_LINKOUT" },
      raw: { location: "Lagos, Nigeria" },
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
    const sourceDocs = {};
    for (const source of sources) {
      sourceDocs[source.slug] = await NewsSource.findOneAndUpdate(
        { slug: source.slug },
        { $set: source },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
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
      sourceIds: Object.values(sourceDocs).map((entry) => entry._id),
      limitPerSource: 8,
      mockStoriesBySource,
    });
    const clusterResult = await runClusterNewsJob({ limit: 120 });
    const scoreResult = await runScoreNewsJob({ limit: 120 });

    console.log("Sample news data ready");
    console.log({
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
