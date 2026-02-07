const { createNotification } = require("../services/notificationService");

await createNotification({
  recipient: targetId,
  sender: userId,
  type: "follow",
  text: "started following you",
  entity: {
    id: userId,
    model: "User",
  },
  io: req.app.get("io"),
  onlineUsers: req.app.get("onlineUsers"),
});
