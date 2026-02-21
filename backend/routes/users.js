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

const getUploadedFile = (req) =>
  req.file || req.files?.image?.[0] || req.files?.file?.[0] || null;

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

    const {
      bio,
      gender,
      pronouns,
      avatar,
      cover,
      currentCity,
      hometown,
      workplace,
      education,
      website,
    } = req.body;

    if (bio !== undefined) user.bio = bio;
    if (gender !== undefined) user.gender = gender;
    if (pronouns !== undefined) user.pronouns = pronouns;
    if (currentCity !== undefined) user.currentCity = currentCity;
    if (hometown !== undefined) user.hometown = hometown;
    if (workplace !== undefined) user.workplace = workplace;
    if (education !== undefined) user.education = education;
    if (website !== undefined) user.website = website;
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

/* ================= PUBLIC PROFILE BY USERNAME ================= */
router.get("/profile/:username", auth, async (req, res) => {
  try {
    const username = (req.params.username || "").trim().toLowerCase();
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    const user = await User.findOne({ username })
      .select("-password")
      .populate("friends", "_id name username avatar")
      .lean();

    if (!user) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const viewerId = req.user.id?.toString();
    const followers = Array.isArray(user.followers) ? user.followers : [];
    const following = Array.isArray(user.following) ? user.following : [];
    const friends = Array.isArray(user.friends) ? user.friends : [];

    const friendsPreview = friends
      .slice(0, 9)
      .map((friend) => ({
        _id: friend?._id?.toString() || "",
        name: friend?.name || "",
        username: friend?.username || "",
        avatar: avatarToUrl(friend?.avatar),
      }))
      .filter((friend) => friend._id);

    return res.json({
      _id: user._id.toString(),
      name: user.name || "",
      username: user.username || "",
      bio: user.bio || "",
      gender: user.gender || "",
      pronouns: user.pronouns || "",
      country: user.country || "",
      currentCity: user.currentCity || "",
      hometown: user.hometown || "",
      workplace: user.workplace || "",
      education: user.education || "",
      website: user.website || "",
      phone: user.phone || "",
      dob: user.dob || null,
      avatar: avatarToUrl(user.avatar),
      cover: avatarToUrl(user.cover),
      followersCount: followers.length,
      followingCount: following.length,
      friendsCount: friends.length,
      friendsPreview,
      joinedAt: user.createdAt || user.joined || null,
      isOwner: Boolean(viewerId && user._id.toString() === viewerId),
    });
  } catch (err) {
    console.error("Profile fetch error:", err);
    return res.status(500).json({ error: "Failed to load profile" });
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
router.post(
  "/me/avatar",
  auth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const selectedFile = getUploadedFile(req);
      if (!selectedFile) {
        return res.status(400).json({ error: "No image" });
      }
      if (!selectedFile.mimetype?.startsWith("image/")) {
        return res.status(400).json({ error: "Only image files are allowed" });
      }

      const imageUrl = `/uploads/${selectedFile.filename}`;
      user.avatar = { public_id: "", url: imageUrl };
      await user.save();

      try {
        await Post.create({
          author: user._id,
          text: "Updated profile picture",
          media: [{ url: imageUrl, type: "image" }],
          privacy: "public",
        });
      } catch (postErr) {
        console.error("Avatar update post creation failed:", postErr);
      }

      const safeUser = await User.findById(req.user.id).select("-password");
      return res.json(safeUser);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Avatar upload failed" });
    }
  }
);

/* ================= UPLOAD COVER ================= */
router.post(
  "/me/cover",
  auth,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const selectedFile = getUploadedFile(req);
      if (!selectedFile) {
        return res.status(400).json({ error: "No image" });
      }
      if (!selectedFile.mimetype?.startsWith("image/")) {
        return res.status(400).json({ error: "Only image files are allowed" });
      }

      const imageUrl = `/uploads/${selectedFile.filename}`;
      user.cover = { public_id: "", url: imageUrl };
      await user.save();

      try {
        await Post.create({
          author: user._id,
          text: "Updated cover photo",
          media: [{ url: imageUrl, type: "image" }],
          privacy: "public",
        });
      } catch (postErr) {
        console.error("Cover update post creation failed:", postErr);
      }

      const safeUser = await User.findById(req.user.id).select("-password");
      return res.json(safeUser);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Cover upload failed" });
    }
  }
);

module.exports = router;
