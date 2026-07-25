const express = require("express");

const {
  MillionaireGameError,
  listMillionaireParticipantsForAdmin,
  updateMillionaireParticipantStatus,
  updateMillionairePayout,
} = require("../services/millionaireGameService");

const router = express.Router();

const handleError = (res, error) => {
  if (error instanceof MillionaireGameError) {
    return res.status(error.status || 400).json({
      error: error.message,
      code: error.code,
      ...(error.payload || {}),
    });
  }
  console.error("Admin Millionaire route failed:", error);
  return res.status(500).json({ error: "Failed to process Millionaire administration." });
};

router.get("/participants", async (req, res) => {
  try {
    return res.json(
      await listMillionaireParticipantsForAdmin({
        search: req.query.search,
        participantStatus: req.query.participantStatus,
        attemptStatus: req.query.attemptStatus,
        payoutStatus: req.query.payoutStatus,
        page: req.query.page,
        limit: req.query.limit,
      })
    );
  } catch (error) {
    return handleError(res, error);
  }
});

router.patch("/attempts/:attemptId/payout", async (req, res) => {
  try {
    return res.json(
      await updateMillionairePayout({
        attemptId: req.params.attemptId,
        status: req.body?.status,
        reference: req.body?.reference,
        note: req.body?.note,
        adminUserId: req.user.id,
      })
    );
  } catch (error) {
    return handleError(res, error);
  }
});

router.patch("/participants/:participantId/status", async (req, res) => {
  try {
    return res.json(
      await updateMillionaireParticipantStatus({
        participantId: req.params.participantId,
        status: req.body?.status,
      })
    );
  } catch (error) {
    return handleError(res, error);
  }
});

module.exports = router;
