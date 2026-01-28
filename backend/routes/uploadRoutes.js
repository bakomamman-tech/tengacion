const express = require("express");
const upload = require("../middleware/upload");

const router = express.Router();

router.post("/profile-photo", upload.single("profilePhoto"), (req, res) => {
  try {
    return res.status(200).json({
      message: "Upload successful ✅",
      imageUrl: req.file.path,
      publicId: req.file.filename,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
