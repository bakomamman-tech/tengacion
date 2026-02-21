const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const upload = require("../utils/upload");
const Post = require("../models/Post");
const auth = require("../middleware/auth");
const { saveUploadedFile } = require("../services/mediaStore");

const router = express.Router();

const avatarToUrl = (avatar) => {
  if (!avatar) return "";
  if (typeof avatar === "string") return avatar;
  return avatar.url || "";
};

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);

const includesId = (list, id) =>
  Array.isArray(list) && list.some((entry) => toIdString(entry) === id);

const buildRelationship = ({
  viewerId,
  viewerFriendIds = [],
  viewerIncomingRequestIds = [],
  targetId,
  targetFriendIds = [],
  targetIncomingRequestIds = [],
}) => {
  const isSelf = Boolean(viewerId && targetId && viewerId === targetId);
  const isFriend =
    !isSelf &&
    (includesId(viewerFriendIds, targetId) || includesId(targetFriendIds, viewerId));
  const hasSentRequest = !isSelf && includesId(targetIncomingRequestIds, viewerId);
  const hasIncomingRequest = !isSelf && includesId(viewerIncomingRequestIds, targetId);

  let status = "none";
  if (isSelf) {
    status = "self";
  } else if (isFriend) {
    status = "friends";
  } else if (hasIncomingRequest) {
    status = "request_received";
  } else if (hasSentRequest) {
    status = "request_sent";
  }

  return {
    status,
    isFriend,
    hasSentRequest,
    hasIncomingRequest,
    canRequest: status === "none",
    canCancelRequest: status === "request_sent",
    canAcceptRequest: status === "request_received",
    canRejectRequest: status === "request_received",
    canUnfriend: status === "friends",
  };
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
    const viewer = await User.findById(viewerId).select("friends friendRequests").lean();
    const followers = Array.isArray(user.followers) ? user.followers : [];
    const following = Array.isArray(user.following) ? user.following : [];
    const friends = Array.isArray(user.friends) ? user.friends : [];
    const relationship = buildRelationship({
      viewerId,
      viewerFriendIds: viewer?.friends || [],
      viewerIncomingRequestIds: viewer?.friendRequests || [],
      targetId: user._id.toString(),
      targetFriendIds: user.friends || [],
      targetIncomingRequestIds: user.friendRequests || [],
    });

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
      relationship,
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
    const rawSearch = (req.query.search || "").trim();
    const search = rawSearch.replace(/^@+/, "");
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }

    const me = await User.findById(req.user.id).select("friends friendRequests").lean();

    const users = await User.find(query)
      .select("_id name username avatar friendRequests friends")
      .sort({ name: 1 })
      .limit(50)
      .lean();

    const viewerId = req.user.id.toString();
    const payload = users
      .filter((u) => u._id.toString() !== viewerId)
      .map((entry) => ({
        ...userListPayload(entry),
        relationship: buildRelationship({
          viewerId,
          viewerFriendIds: me?.friends || [],
          viewerIncomingRequestIds: me?.friendRequests || [],
          targetId: entry._id.toString(),
          targetFriendIds: entry.friends || [],
          targetIncomingRequestIds: entry.friendRequests || [],
        }),
      }));

    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Failed to load users" });
  }
});

/* ================= SEND FRIEND REQUEST ================= */
router.post("/:id/request", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const me = await User.findById(req.user.id);
    const user = await User.findById(req.params.id);

    if (!me || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    const meId = me._id.toString();
    if (user._id.toString() === meId) {
      return res.status(400).json({ error: "Cannot friend yourself" });
    }

    const hasIncomingFromUser = (me.friendRequests || []).some(
      (id) => id.toString() === user._id.toString()
    );
    if (hasIncomingFromUser) {
      return res.status(409).json({ error: "This user already sent you a request" });
    }

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

/* ================= CANCEL SENT REQUEST ================= */
router.delete("/:id/request", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const me = await User.findById(req.user.id);
    const user = await User.findById(req.params.id);

    if (!me || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    const meId = me._id.toString();
    user.friendRequests = (user.friendRequests || []).filter(
      (id) => id.toString() !== meId
    );
    await user.save();

    return res.json({ cancelled: true });
  } catch {
    return res.status(500).json({ error: "Cancel failed" });
  }
});

/* ================= ACCEPT FRIEND REQUEST ================= */
router.post("/:id/accept", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const me = await User.findById(req.user.id);
    const user = await User.findById(req.params.id);

    if (!me || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (me._id.toString() === user._id.toString()) {
      return res.status(400).json({ error: "Cannot friend yourself" });
    }

    const requesterId = user._id.toString();
    const hasPendingRequest = (me.friendRequests || []).some(
      (id) => id.toString() === requesterId
    );
    if (!hasPendingRequest) {
      return res.status(400).json({ error: "No pending request from this user" });
    }

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

    user.friendRequests = (user.friendRequests || []).filter(
      (id) => id.toString() !== myId
    );

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
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const me = await User.findById(req.user.id);
    if (!me) {
      return res.status(404).json({ error: "User not found" });
    }

    if (me._id.toString() === req.params.id) {
      return res.status(400).json({ error: "Cannot reject yourself" });
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

/* ================= UNFRIEND ================= */
router.delete("/:id/friend", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const me = await User.findById(req.user.id);
    const user = await User.findById(req.params.id);

    if (!me || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    const myId = me._id.toString();
    const targetId = user._id.toString();
    if (myId === targetId) {
      return res.status(400).json({ error: "Cannot unfriend yourself" });
    }

    me.friends = (me.friends || []).filter((id) => id.toString() !== targetId);
    user.friends = (user.friends || []).filter((id) => id.toString() !== myId);

    await Promise.all([me.save(), user.save()]);
    return res.json({ unfriended: true });
  } catch {
    return res.status(500).json({ error: "Unfriend failed" });
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

      const imageUrl = await saveUploadedFile(selectedFile);
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
      console.error("Avatar upload failed:", err);
      return res.status(500).json({
        error: err?.message || "Avatar upload failed",
      });
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

      const imageUrl = await saveUploadedFile(selectedFile);
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
      console.error("Cover upload failed:", err);
      return res.status(500).json({
        error: err?.message || "Cover upload failed",
      });
    }
  }
);

module.exports = router;
