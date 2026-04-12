const { assistantRequestSchema } = require("../services/assistant/schemas");
const { chat } = require("../services/assistant/assistantService");

exports.chat = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = assistantRequestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid assistant request",
      });
    }

    const response = await chat({
      user: req.user,
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
      pendingAction: parsed.data.pendingAction,
      context: parsed.data.context,
    });

    return res.json(response);
  } catch (error) {
    return next(error);
  }
};
