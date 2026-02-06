const { body } = require("express-validator");

exports.createPostValidator = [
  body("text")
    .optional()
    .isLength({ max: 5000 })
    .withMessage("Post text is too long"),
  body("media")
    .optional()
    .isArray()
    .withMessage("Media must be an array"),
];
