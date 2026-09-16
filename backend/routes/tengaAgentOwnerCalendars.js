const express = require("express");

const {
  completeOwnerCalendarConnection,
  disconnectOwnerCalendarConnection,
  getOwnerCalendarConnections,
  startOwnerCalendarConnection,
} = require(
  "../services/tengaAgent/calendarConnectionService"
);

const router = express.Router();

router.get(
  "/calendar-connections",
  async (req, res, next) => {
    try {
      const result =
        await getOwnerCalendarConnections({
          userId: req.user._id,
        });

      if (!result) {
        return res.status(404).json({
          ok: false,
          message: "TengaAgent workspace not found.",
        });
      }

      res.set("Cache-Control", "no-store");
      return res.json({
        ok: true,
        providers: result.providers,
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/calendar-connections/:provider/connect",
  async (req, res, next) => {
    try {
      const result =
        await startOwnerCalendarConnection({
          userId: req.user._id,
          provider: req.params.provider,
        });

      if (!result) {
        return res.status(404).json({
          ok: false,
          message: "TengaAgent workspace not found.",
        });
      }

      res.set("Cache-Control", "no-store");
      return res.json({
        ok: true,
        provider: result.provider,
        authorizationUrl:
          result.authorizationUrl,
      });
    } catch (error) {
      if (/not configured/i.test(error?.message || "")) {
        return res.status(503).json({
          ok: false,
          message: error.message,
        });
      }

      if (/unsupported calendar provider/i.test(error?.message || "")) {
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
  "/calendar-connections/oauth/complete",
  async (req, res, next) => {
    try {
      const result =
        await completeOwnerCalendarConnection({
          userId: req.user._id,
          state: req.body?.state,
          code: req.body?.code,
          oauthError: req.body?.error,
        });

      res.set("Cache-Control", "no-store");
      return res.json({
        ok: true,
        provider: result.provider,
        connection: result.connection,
      });
    } catch (error) {
      if (/not configured/i.test(error?.message || "")) {
        return res.status(503).json({
          ok: false,
          message: error.message,
        });
      }

      if (
        /authorization|provider|access token|workspace|code is required/i.test(
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

router.delete(
  "/calendar-connections/:provider",
  async (req, res, next) => {
    try {
      const result =
        await disconnectOwnerCalendarConnection({
          userId: req.user._id,
          provider: req.params.provider,
        });

      if (!result) {
        return res.status(404).json({
          ok: false,
          message: "TengaAgent workspace not found.",
        });
      }

      res.set("Cache-Control", "no-store");
      return res.json({
        ok: true,
        ...result,
      });
    } catch (error) {
      if (/unsupported calendar provider/i.test(error?.message || "")) {
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
