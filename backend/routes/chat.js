const express = require("express");
const auth = require("../middleware/auth");
const { sendChatMessage } = require("../controllers/chatController");

const router = express.Router();

router.post("/messages", auth, sendChatMessage);

module.exports = router;
