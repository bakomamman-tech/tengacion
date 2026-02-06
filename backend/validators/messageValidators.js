const { body } = require("express-validator");

exports.sendMessageValidator = [
  body("receiverId")
    .notEmpty()
    .withMessage("Receiver is required"),
  body("text")
    .trim()
    .notEmpty()
    .withMessage("Message cannot be empty")
    .isLength({ max: 2000 })
    .withMessage("Message too long"),
];
