const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  userId: String,        // who should receive it
  fromId: String,        // who triggered it
  type: String,         // like, comment, follow, message
  text: String,
  time: {
    type: Date,
    default: Date.now
  },
  read: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model("Notification", NotificationSchema);
