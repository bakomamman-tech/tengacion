const Message = require("../models/Message");
const asyncHandler = require("../middleware/asyncHandler");
const paginate = require("../utils/paginate");

exports.getConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { page, limit, skip } = paginate(req, 30);

  const [messages, total] = await Promise.all([
    Message.find({ conversationId })
      .sort({ time: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Message.countDocuments({ conversationId }),
  ]);

  res.json({
    success: true,
    data: messages.reverse(), // newest at bottom for chat UI
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});
