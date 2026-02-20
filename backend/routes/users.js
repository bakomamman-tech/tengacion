const express = require("express");
const User = require("../models/User");
const upload = require("../utils/upload");
const Post = require("../models/Post");
const auth = require("../middleware/auth");

const router = express.Router();

const avatarToUrl = (avatar) => {
  if (!avatar) return "";
  if (typeof avatar === "string") return avatar;
  return avatar.url || "";
};

const userListPayload = (user) => ({
  _id: user._id.toString(),
  name: user.name,
  username: user.username,
  avatar: avatarToUrl(user.avatar),
});

/* ================= MY PROFILE ================= */
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    return res.json(user);
  } catch {
    return res.status(500).json({ error: "Failed to load profile" });
  }
});

/* ================= UPDATE PROFILE ================= */
router.put("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const { bio, gender, pronouns, avatar, cover } = req.body;

    if (bio !== undefined) user.bio = bio;
    if (gender !== undefined) user.gender = gender;
    if (pronouns !== undefined) user.pronouns = pronouns;
    if (avatar !== undefined) {
      user.avatar =
        typeof avatar === "string"
          ? { public_id: "", url: avatar }
          : avatar;
    }
    if (cover !== undefined) {
      user.cover =
        typeof cover === "string"
          ? { public_id: "", url: cover }
          : cover;
    }

    await user.save();

    const safeUser = await User.findById(req.user.id).select("-password");
    return res.json(safeUser);
  } catch (err) {
    console.error("Profile update error:", err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

/* ================= LIST USERS ================= */
router.get("/", auth, async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .select("_id name username avatar")
      .sort({ name: 1 })
      .limit(50)
      .lean();

    const payload = users
      .filter((u) => u._id.toString() !== req.user.id.toString())
      .map(userListPayload);

    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Failed to load users" });
  }
});

/* ================= SEND FRIEND REQUEST ================= */
router.post("/:id/request", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    const user = await User.findById(req.params.id);

    if (!me || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    const meId = me._id.toString();
    const alreadyRequested = (user.friendRequests || []).some(
      (id) => id.toString() === meId
    );
    const alreadyFriends = (user.friends || []).some(
      (id) => id.toString() === meId
    );

    if (!alreadyRequested && !alreadyFriends) {
      user.friendRequests.push(me._id);
      await user.save();
    }

    return res.json({ sent: true });
  } catch {
    return res.status(500).json({ error: "Request failed" });
  }
});

/* ================= ACCEPT FRIEND REQUEST ================= */
router.post("/:id/accept", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    const user = await User.findById(req.params.id);

    if (!me || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    const requesterId = user._id.toString();

    me.friendRequests = (me.friendRequests || []).filter(
      (id) => id.toString() !== requesterId
    );

    if (!(me.friends || []).some((id) => id.toString() === requesterId)) {
      me.friends.push(user._id);
    }

    const myId = me._id.toString();
    if (!(user.friends || []).some((id) => id.toString() === myId)) {
      user.friends.push(me._id);
    }

    await Promise.all([me.save(), user.save()]);

    return res.json({ friends: true });
  } catch (err) {
    console.error("Accept error:", err);
    return res.status(500).json({ error: "Accept failed" });
  }
});

/* ================= REJECT FRIEND REQUEST ================= */
router.post("/:id/reject", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) {
      return res.status(404).json({ error: "User not found" });
    }

    me.friendRequests = (me.friendRequests || []).filter(
      (id) => id.toString() !== req.params.id
    );
    await me.save();

    return res.json({ rejected: true });
  } catch {
    return res.status(500).json({ error: "Reject failed" });
  }
});

/* ================= LIST FRIEND REQUESTS ================= */
router.get("/requests", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select("friendRequests");
    if (!me) {
      return res.status(404).json({ error: "User not found" });
    }

    const users = await User.find(
      { _id: { $in: me.friendRequests || [] } },
      "_id name username avatar"
    ).lean();

    return res.json(users.map(userListPayload));
  } catch {
    return res.status(500).json({ error: "Failed to load requests" });
  }
});

/* ================= UPLOAD AVATAR ================= */
router.post("/me/avatar", auth, upload.single("image"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No image" });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    user.avatar = { public_id: "", url: imageUrl };
    await user.save();

    await Post.create({
      author: user._id,
      text: "Updated profile picture",
      media: [{ url: imageUrl, type: "image" }],
      privacy: "public",
    });

    return res.json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Avatar upload failed" });
  }
});

/* ================= UPLOAD COVER ================= */
router.post("/me/cover", auth, upload.single("image"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No image" });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    user.cover = { public_id: "", url: imageUrl };
    await user.save();

    await Post.create({
      author: user._id,
      text: "Updated cover photo",
      media: [{ url: imageUrl, type: "image" }],
      privacy: "public",
    });

    return res.json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Cover upload failed" });
  }
});

module.exports = router;
