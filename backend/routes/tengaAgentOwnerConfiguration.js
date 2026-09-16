const express = require("express");

const auth = require("../middleware/auth");
const {
  setOwnerAgentPublicationPreservingTools,
  updateOwnerAgentConfiguration,
} = require("../services/tengaAgent/ownerAgentConfigurationService");
const {
  syncOwnerWebsiteKnowledge,
} = require("../services/tengaAgent/ownerWebsiteKnowledgeService");

const router = express.Router();

router.use(auth);

const serializeWorkspace = (workspace) => ({
  organization: {
    id: workspace.organization._id,
    name: workspace.organization.name,
    slug: workspace.organization.slug,
    website: workspace.organization.website,
    industry: workspace.organization.industry,
    countryCode: workspace.organization.countryCode,
    timezone: workspace.organization.timezone,
    plan: workspace.organization.plan,
    status: workspace.organization.status,
  },
  agent: workspace.agent
    ? {
        id: workspace.agent._id,
        key: workspace.agent.key,
        name: workspace.agent.name,
        role: workspace.agent.role,
        greeting: workspace.agent.greeting,
        tone: workspace.agent.tone,
        languages: workspace.agent.languages,
        systemInstructions:
          workspace.agent.systemInstructions,
        enabledTools: workspace.agent.enabledTools,
        status: workspace.agent.status,
        published:
          workspace.agent.status === "active",
        publicPath:
          `/tengaagent/${workspace.organization.slug}/${workspace.agent.key}`,
      }
    : null,
});

router.patch(
  "/agent/publication",
  async (req, res, next) => {
    try {
      if (typeof req.body?.published !== "boolean") {
        return res.status(400).json({
          ok: false,
          message: "published must be true or false.",
        });
      }

      const workspace =
        await setOwnerAgentPublicationPreservingTools({
          userId: req.user._id,
          published: req.body.published,
        });

      if (!workspace) {
        return res.status(404).json({
          ok: false,
          message: "TengaAgent workspace not found.",
        });
      }

      res.set("Cache-Control", "no-store");

      return res.json({
        ok: true,
        ...serializeWorkspace(workspace),
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.patch(
  "/agent/configuration",
  async (req, res, next) => {
    try {
      const workspace =
        await updateOwnerAgentConfiguration({
          userId: req.user._id,
          name: req.body?.name,
          role: req.body?.role,
          greeting: req.body?.greeting,
          tone: req.body?.tone,
          languages: req.body?.languages,
          systemInstructions:
            req.body?.systemInstructions,
          enabledTools: req.body?.enabledTools,
        });

      if (!workspace) {
        return res.status(404).json({
          ok: false,
          message: "TengaAgent workspace not found.",
        });
      }

      res.set("Cache-Control", "no-store");

      return res.json({
        ok: true,
        publicationPaused:
          Boolean(workspace.publicationPaused),
        ...serializeWorkspace(workspace),
      });
    } catch (error) {
      if (
        /required|languages|tools|unsupported/i.test(
          error?.message || ""
        )
      ) {
        return res.status(400).json({
          ok: false,
          message: error.message,
        });
      }

      return next(error);
    }
  }
);

router.post(
  "/knowledge/website",
  async (req, res, next) => {
    try {
      const result =
        await syncOwnerWebsiteKnowledge({
          userId: req.user._id,
          url: req.body?.url,
          title: req.body?.title,
        });

      res.set("Cache-Control", "no-store");

      return res.status(201).json({
        ok: true,
        source: {
          id: result.source._id,
          type: result.source.type,
          title: result.source.title,
          sourceUrl: result.source.sourceUrl,
          status: result.source.status,
          chunkCount: result.source.chunkCount,
          updatedAt: result.source.updatedAt,
        },
        chunksCreated: result.chunksCreated,
        unchanged: result.unchanged,
      });
    } catch (error) {
      if (
        /workspace first|website|https|hostname|redirect|html|plain text|too large|readable|credentials|http /i.test(
          error?.message || ""
        )
      ) {
        return res.status(400).json({
          ok: false,
          message: error.message,
        });
      }

      return next(error);
    }
  }
);

module.exports = router;
