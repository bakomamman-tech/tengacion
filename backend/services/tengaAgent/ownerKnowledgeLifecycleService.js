const mongoose = require("mongoose");
const { URL } = require("url");

const KnowledgeSource = require("../../models/tengaAgent/KnowledgeSource");
const KnowledgeChunk = require("../../models/tengaAgent/KnowledgeChunk");
const {
  findOwnerWorkspace,
} = require("./ownerWorkspaceService");

const cleanText = (value, max) =>
  String(value || "").trim().slice(0, max);

const normalizeWebsite = (value) => {
  const website = cleanText(value, 500);

  if (!website) {
    return "";
  }

  let parsed;

  try {
    parsed = new URL(website);
  } catch (_error) {
    throw new Error("Business website must be a valid HTTPS URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Business website must use HTTPS.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Business website cannot contain credentials.");
  }

  parsed.hash = "";
  return parsed.toString();
};

const normalizeCountryCode = (value) => {
  const countryCode = cleanText(value, 2).toUpperCase();

  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error(
      "Country code must be a 2-letter ISO-style code."
    );
  }

  return countryCode;
};

const pausePublishedAgent = async (agent) => {
  if (!agent || agent.status !== "active") {
    return false;
  }

  agent.status = "paused";
  await agent.save();
  return true;
};

const archiveSourcesAndChunks = async ({
  organizationId,
  sourceFilter,
  reason,
  userId,
}) => {
  const sources = await KnowledgeSource.find({
    organizationId,
    status: { $ne: "archived" },
    ...sourceFilter,
  }).select("_id");

  if (sources.length === 0) {
    return 0;
  }

  const sourceIds = sources.map((source) => source._id);
  const archivedAt = new Date();

  await KnowledgeChunk.deleteMany({
    organizationId,
    sourceId: { $in: sourceIds },
  });

  await KnowledgeSource.updateMany(
    {
      organizationId,
      _id: { $in: sourceIds },
    },
    {
      $set: {
        status: "archived",
        "metadata.archivedAt": archivedAt.toISOString(),
        "metadata.archivedByUser": String(userId),
        "metadata.archivedReason": reason,
      },
    }
  );

  return sourceIds.length;
};

const updateOwnerBusinessProfile = async ({
  userId,
  name,
  website,
  industry,
  countryCode,
  timezone,
}) => {
  const workspace = await findOwnerWorkspace(userId);

  if (!workspace) {
    return null;
  }

  const organization = workspace.organization;
  const nextName = cleanText(name, 180);
  const nextWebsite = normalizeWebsite(website);
  const nextIndustry = cleanText(industry, 120);
  const nextCountryCode = normalizeCountryCode(countryCode);
  const nextTimezone = cleanText(timezone, 100);

  if (!nextName) {
    throw new Error("Business name is required.");
  }

  if (!nextTimezone) {
    throw new Error("Business timezone is required.");
  }

  const websiteChanged =
    String(organization.website || "") !== nextWebsite;

  const changed =
    organization.name !== nextName ||
    websiteChanged ||
    String(organization.industry || "") !== nextIndustry ||
    organization.countryCode !== nextCountryCode ||
    organization.timezone !== nextTimezone;

  if (!changed) {
    return {
      ...workspace,
      publicationPaused: false,
      archivedWebsiteSources: 0,
      unchanged: true,
    };
  }

  organization.name = nextName;
  organization.website = nextWebsite;
  organization.industry = nextIndustry;
  organization.countryCode = nextCountryCode;
  organization.timezone = nextTimezone;
  await organization.save();

  const archivedWebsiteSources = websiteChanged
    ? await archiveSourcesAndChunks({
        organizationId: organization._id,
        sourceFilter: { type: "website" },
        reason: "business-website-changed",
        userId,
      })
    : 0;

  const publicationPaused = await pausePublishedAgent(
    workspace.agent
  );

  return {
    organization,
    agent: workspace.agent,
    publicationPaused,
    archivedWebsiteSources,
    unchanged: false,
  };
};

const archiveOwnerKnowledgeSource = async ({
  userId,
  sourceId,
}) => {
  const workspace = await findOwnerWorkspace(userId);

  if (!workspace) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(String(sourceId || ""))) {
    return {
      ...workspace,
      source: null,
      publicationPaused: false,
      chunksRemoved: 0,
    };
  }

  const source = await KnowledgeSource.findOne({
    _id: sourceId,
    organizationId: workspace.organization._id,
    status: { $ne: "archived" },
  });

  if (!source) {
    return {
      ...workspace,
      source: null,
      publicationPaused: false,
      chunksRemoved: 0,
    };
  }

  const deleted = await KnowledgeChunk.deleteMany({
    organizationId: workspace.organization._id,
    sourceId: source._id,
  });

  source.status = "archived";
  source.metadata = {
    ...(source.metadata || {}),
    archivedAt: new Date().toISOString(),
    archivedByUser: String(userId),
    archivedReason: "owner-archived",
  };
  await source.save();

  const publicationPaused = await pausePublishedAgent(
    workspace.agent
  );

  return {
    ...workspace,
    source,
    publicationPaused,
    chunksRemoved: deleted.deletedCount || 0,
  };
};

module.exports = {
  archiveOwnerKnowledgeSource,
  archiveSourcesAndChunks,
  normalizeCountryCode,
  normalizeWebsite,
  updateOwnerBusinessProfile,
};
