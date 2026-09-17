const express = require("express");

const auth = require("../middleware/auth");
const {
  findOwnerWorkspace,
} = require("../services/tengaAgent/ownerWorkspaceService");
const {
  getTenantPilotReadiness,
} = require("../services/tengaAgent/pilotReadinessService");

const router = express.Router();
router.use(auth);

router.get("/pilot-readiness", async (req, res, next) => {
  try {
    const workspace = await findOwnerWorkspace(req.user._id);
    if (!workspace) {
      return res.status(404).json({
        ok: false,
        message: "TengaAgent workspace not found.",
      });
    }

    const readiness = await getTenantPilotReadiness({
      organizationId: workspace.organization._id,
    });

    res.set("Cache-Control", "no-store");
    return res.json({
      ok: true,
      readiness,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
