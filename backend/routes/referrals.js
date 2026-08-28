const express = require("express");

const auth = require("../middleware/auth");
const {
  recordReferralMilestone,
  recordReferralOpen,
} = require("../services/expansionPlatformOperatingService");

const router = express.Router();

router.get("/:token", async (req, res) => {
  try {
    const referral = await recordReferralOpen({ token: req.params.token });
    const separator = referral.destinationPath.includes("?") ? "&" : "?";
    res.set("Cache-Control", "no-store");
    res.cookie("tengacion_ref", referral.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    return res.redirect(302, `${referral.destinationPath}${separator}ref=${encodeURIComponent(referral.token)}`);
  } catch (_error) {
    res.set("Cache-Control", "no-store");
    return res.redirect(302, "/home?referral=unavailable");
  }
});

router.post("/:token/milestones", auth, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    return res.json(await recordReferralMilestone({
      token: req.params.token,
      userId: req.user.id,
      milestone: req.body?.milestone,
    }));
  } catch (error) {
    return res.status(Number(error?.status || 0) || 500).json({
      error: error.message || "Failed to record referral milestone",
      details: error?.details || undefined,
    });
  }
});

module.exports = router;
