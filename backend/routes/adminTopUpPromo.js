const express = require("express");

const {
  TopUpPromoError,
  listTopUpPromoPlaysForAdmin,
} = require("../services/topUpPromoService");

const router = express.Router();

router.get("/plays", async (req, res) => {
  try {
    return res.json(
      await listTopUpPromoPlaysForAdmin({
        outcome: req.query.outcome,
        page: req.query.page,
        limit: req.query.limit,
      })
    );
  } catch (error) {
    if (error instanceof TopUpPromoError) {
      return res.status(error.status || 400).json({ error: error.message, code: error.code });
    }
    console.error("Admin Top-Up Bank Account Promo route failed:", error);
    return res.status(500).json({ error: "Failed to load promo discoveries." });
  }
});

module.exports = router;
