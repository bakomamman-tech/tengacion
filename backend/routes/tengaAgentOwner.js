const express =
  require("express");

const auth =
  require(
    "../middleware/auth"
  );

const {
  createOrUpdateOwnerWorkspace,
  findOwnerWorkspace,
  listOwnerKnowledge,
  syncOwnerKnowledge,
} = require(
  "../services/tengaAgent/ownerWorkspaceService"
);

const router =
  express.Router();

router.use(auth);

const serializeWorkspace = (
  workspace
) => ({
  organization: {
    id:
      workspace.organization._id,

    name:
      workspace.organization.name,

    slug:
      workspace.organization.slug,

    website:
      workspace.organization.website,

    industry:
      workspace.organization.industry,

    countryCode:
      workspace.organization.countryCode,

    timezone:
      workspace.organization.timezone,

    plan:
      workspace.organization.plan,

    status:
      workspace.organization.status,
  },

  agent:
    workspace.agent
      ? {
          id:
            workspace.agent._id,

          key:
            workspace.agent.key,

          name:
            workspace.agent.name,

          role:
            workspace.agent.role,

          status:
            workspace.agent.status,
        }
      : null,
});

router.get(
  "/workspace",
  async (
    req,
    res,
    next
  ) => {
    try {
      const workspace =
        await findOwnerWorkspace(
          req.user._id
        );

      if (!workspace) {
        return res
          .status(404)
          .json({
            ok: false,

            message:
              "TengaAgent workspace not found.",
          });
      }

      res.set(
        "Cache-Control",
        "no-store"
      );

      return res.json({
        ok: true,

        ...serializeWorkspace(
          workspace
        ),
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/workspace",
  async (
    req,
    res,
    next
  ) => {
    try {
      const existing =
        await findOwnerWorkspace(
          req.user._id
        );

      const workspace =
        await createOrUpdateOwnerWorkspace({
          userId:
            req.user._id,

          name:
            req.body?.name,

          website:
            req.body?.website,

          industry:
            req.body?.industry,

          countryCode:
            req.body?.countryCode,

          timezone:
            req.body?.timezone,
        });

      res.set(
        "Cache-Control",
        "no-store"
      );

      return res
        .status(
          existing
            ? 200
            : 201
        )
        .json({
          ok: true,

          created:
            !existing,

          ...serializeWorkspace(
            workspace
          ),
        });
    } catch (error) {
      if (
        /required|country code/i.test(
          error?.message || ""
        )
      ) {
        return res
          .status(400)
          .json({
            ok: false,

            message:
              error.message,
          });
      }

      return next(error);
    }
  }
);

router.get(
  "/knowledge",
  async (
    req,
    res,
    next
  ) => {
    try {
      const result =
        await listOwnerKnowledge({
          userId:
            req.user._id,
        });

      if (!result) {
        return res
          .status(404)
          .json({
            ok: false,

            message:
              "TengaAgent workspace not found.",
          });
      }

      res.set(
        "Cache-Control",
        "no-store"
      );

      return res.json({
        ok: true,

        sources:
          result.sources.map(
            (source) => ({
              id:
                source._id,

              type:
                source.type,

              title:
                source.title,

              status:
                source.status,

              chunkCount:
                source.chunkCount,

              updatedAt:
                source.updatedAt,
            })
          ),
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/knowledge",
  async (
    req,
    res,
    next
  ) => {
    try {
      const result =
        await syncOwnerKnowledge({
          userId:
            req.user._id,

          type:
            req.body?.type,

          title:
            req.body?.title,

          text:
            req.body?.text,
        });

      res.set(
        "Cache-Control",
        "no-store"
      );

      return res
        .status(201)
        .json({
          ok: true,

          source: {
            id:
              result.source._id,

            type:
              result.source.type,

            title:
              result.source.title,

            status:
              result.source.status,

            chunkCount:
              result.source.chunkCount,
          },

          chunksCreated:
            result.chunksCreated,

          unchanged:
            result.unchanged,
        });
    } catch (error) {
      if (
        /workspace first|required|unsupported/i.test(
          error?.message || ""
        )
      ) {
        return res
          .status(400)
          .json({
            ok: false,

            message:
              error.message,
          });
      }

      return next(error);
    }
  }
);

module.exports =
  router;