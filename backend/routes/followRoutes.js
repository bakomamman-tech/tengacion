const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
} = require("../controllers/followController");

router.post("/:userId/follow", auth, followUser);
router.post("/:userId/unfollow", auth, unfollowUser);
router.get("/:userId/followers", getFollowers);
router.get("/:userId/following", getFollowing);

module.exports = router;
