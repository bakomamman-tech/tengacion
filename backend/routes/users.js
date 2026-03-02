const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const upload = require("../utils/upload");
const Post = require("../models/Post");
const auth = require("../middleware/auth");
const { saveUploadedMedia } = require("../services/mediaStore");
const { createNotification } = require("../services/notificationService");
const {
  normalizeMediaValue,
  mediaToUrl,
  normalizeUserMediaDocument,
} = require("../utils/userMedia");

const router = express.Router();

const avatarToUrl = (avatar) => {
  return mediaToUrl(avatar);
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
const PRIVACY_VALUES = ["public", "friends", "private"];
const MESSAGE_PERMISSION_VALUES = ["everyone", "friends", "no_one"];
const AUDIENCE_VALUES = ["public", "friends", "close_friends"];

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

const canViewProfile = ({ isOwner, relationship, profileVisibility }) => {
  if (isOwner) return true;
  if (profileVisibility === "public") return true;
  if (profileVisibility === "friends") return Boolean(relationship?.isFriend);
  return false;
};

const getUploadedFile = (req) =>
  req.file || req.files?.image?.[0] || req.files?.file?.[0] || null;

const emitFriendEvent = (req, userId, eventName, payload) => {
  const io = req.app.get("io");
  if (!io) return;
  const id = toIdString(userId);
  if (!id) return;
  io.to(id).to(`user:${id}`).emit(eventName, payload);
};

const isBirthdayToday = (birthday = {}) => {
  const day = Number(birthday?.day) || 0;
  const month = Number(birthday?.month) || 0;
  if (!day || !month) return false;
  const now = new Date();
  return now.getDate() === day && now.getMonth() + 1 === month;
};

/* ================= MY PROFILE ================= */
router.get("/me", auth, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
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
    const user = await User.findById(req.user.id).lean();
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
      birthday,
    } = req.body;

    const updates = {};
    if (bio !== undefined) updates.bio = bio;
    if (gender !== undefined) updates.gender = gender;
    if (pronouns !== undefined) updates.pronouns = pronouns;
    if (currentCity !== undefined) updates.currentCity = currentCity;
    if (hometown !== undefined) updates.hometown = hometown;
    if (workplace !== undefined) updates.workplace = workplace;
    if (education !== undefined) updates.education = education;
    if (website !== undefined) updates.website = website;
    if (birthday !== undefined && birthday && typeof birthday === "object") {
      updates.birthday = {
        day: Number(birthday.day) || 0,
        month: Number(birthday.month) || 0,
        year: Number(birthday.year) || 0,
        visibility: ["private", "friends", "public"].includes(String(birthday.visibility || ""))
          ? String(birthday.visibility)
          : user?.birthday?.visibility || "private",
      };
    }
    if (avatar !== undefined) {
      updates.avatar = normalizeMediaValue(avatar);
    }
    if (cover !== undefined) {
      updates.cover = normalizeMediaValue(cover);
    }

    const safeUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");
    if (!safeUser) {
      return res.status(401).json({ error: "User not found" });
    }
    normalizeUserMediaDocument(safeUser);
    return res.json(safeUser);
  } catch (err) {
    console.error("Profile update error:", err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

/* ================= PUBLIC PROFILE BY USERNAME ================= */
router.get("/profile/:username", auth, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
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
    const isOwner = Boolean(viewerId && user._id.toString() === viewerId);
    const profileVisibility = String(user?.privacy?.profileVisibility || "public");
    const canView = canViewProfile({ isOwner, relationship, profileVisibility });
    if (!canView) {
      return res.json({
        _id: user._id.toString(),
        name: user.name || "",
        username: user.username || "",
        avatar: avatarToUrl(user.avatar),
        cover: avatarToUrl(user.cover),
        relationship,
        isOwner: false,
        profileVisibility,
        restricted: true,
      });
    }

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
      birthday: user.birthday || { day: 0, month: 0, year: 0, visibility: "private" },
      avatar: avatarToUrl(user.avatar),
      cover: avatarToUrl(user.cover),
      followersCount: followers.length,
      followingCount: following.length,
      friendsCount: friends.length,
      friendsPreview,
      relationship,
      joinedAt: user.createdAt || user.joined || null,
      isOwner,
      status: user.status || { text: "", emoji: "", updatedAt: null },
      badges: Array.isArray(user.badges) ? user.badges : [],
      streaks: user.streaks || { checkIn: { count: 0, lastCheckInAt: null } },
      birthdayToday: isBirthdayToday(user.birthday),
      privacy: user.privacy || {
        profileVisibility: "public",
        defaultPostAudience: "friends",
        allowMessagesFrom: "everyone",
      },
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

    const me = await User.findById(req.user.id).select("_id name username");
    const user = await User.findById(req.params.id).select("_id name username friends friendRequests");

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
      console.log("[FRIEND SEND]", {
        fromUserId: meId,
        toUserId: user._id.toString(),
        accepted: false,
        reason: "incoming-exists",
      });
      return res.status(409).json({ error: "This user already sent you a request" });
    }

    const alreadyRequested = (user.friendRequests || []).some(
      (id) => id.toString() === meId
    );
    const alreadyFriends = (user.friends || []).some(
      (id) => id.toString() === meId
    );
    if (alreadyFriends) {
      console.log("[FRIEND SEND]", {
        fromUserId: meId,
        toUserId: user._id.toString(),
        accepted: false,
        reason: "already-friends",
      });
      return res.status(409).json({ error: "You are already friends" });
    }

    let created = false;
    if (!alreadyRequested && !alreadyFriends) {
      user.friendRequests.push(me._id);
      await user.save();
      created = true;
      console.log("[FRIEND DB]", {
        action: "request:create",
        fromUserId: meId,
        toUserId: user._id.toString(),
      });
      emitFriendEvent(req, user._id, "friend:request", {
        fromUser: userListPayload(me),
        createdAt: new Date().toISOString(),
      });
      await createNotification({
        recipient: user._id,
        sender: me._id,
        type: "friend_request",
        text: "sent you a friend request",
        entity: { id: me._id, model: "User" },
        metadata: { link: `/profile/${encodeURIComponent(me.username || "")}` },
        io: req.app.get("io"),
        onlineUsers: req.app.get("onlineUsers"),
      });
    }

    console.log("[FRIEND SEND]", {
      fromUserId: meId,
      toUserId: user._id.toString(),
      created,
      alreadyRequested,
    });
    return res.status(created ? 201 : 200).json({
      sent: true,
      created,
      request: {
        from: userListPayload(me),
        toUserId: user._id.toString(),
        status: "pending",
      },
    });
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
    console.log("[FRIEND DB]", {
      action: "request:accept",
      meId: me._id.toString(),
      requesterId,
    });
    emitFriendEvent(req, user._id, "friend:accepted", {
      byUser: userListPayload(me),
      friend: userListPayload(user),
      acceptedAt: new Date().toISOString(),
    });
    emitFriendEvent(req, me._id, "friend:accepted", {
      byUser: userListPayload(me),
      friend: userListPayload(user),
      acceptedAt: new Date().toISOString(),
    });
    console.log("[FRIEND ACCEPT]", {
      meId: me._id.toString(),
      requesterId,
      friendsNow: true,
    });

    return res.json({
      friends: true,
      friend: userListPayload(user),
      removedRequestFromUserId: requesterId,
    });
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
    console.log("[FRIEND FETCH]", {
      userId: req.user.id,
      incomingCount: users.length,
    });
    console.log("[FRIEND DB]", {
      action: "request:list",
      userId: req.user.id,
      incomingCount: users.length,
    });

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
      const existing = await User.findById(req.user.id).lean();
      if (!existing) {
        return res.status(404).json({ error: "User not found" });
      }
      const selectedFile = getUploadedFile(req);
      if (!selectedFile) {
        return res.status(400).json({ error: "No image" });
      }
      if (!selectedFile.mimetype?.startsWith("image/")) {
        return res.status(400).json({ error: "Only image files are allowed" });
      }

      const uploaded = await saveUploadedMedia(selectedFile);
      const avatar = normalizeMediaValue(uploaded);
      const safeUser = await User.findByIdAndUpdate(
        req.user.id,
        { $set: { avatar } },
        { new: true, runValidators: true }
      ).select("-password");
      if (!safeUser) {
        return res.status(404).json({ error: "User not found" });
      }
      normalizeUserMediaDocument(safeUser);
      if (process.env.NODE_ENV !== "production") {
        console.log("[UPLOAD][avatar]", {
          userId: safeUser._id.toString(),
          url: safeUser.avatar?.url || "",
          public_id: safeUser.avatar?.public_id || "",
          resource_type: uploaded.resource_type,
        });
      }

      try {
        await Post.create({
          author: safeUser._id,
          text: "Updated profile picture",
          media: [{ url: uploaded.url, type: "image" }],
          privacy: "public",
        });
      } catch (postErr) {
        console.error("Avatar update post creation failed:", postErr);
      }

      return res.json({
        user: safeUser,
        media: avatar,
      });
    } catch (err) {
      console.error("Avatar upload failed:", err);
      return res.status(500).json({
        error: err?.message || "Avatar upload failed",
        message: err?.message || "Avatar upload failed",
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
      const existing = await User.findById(req.user.id).lean();
      if (!existing) {
        return res.status(404).json({ error: "User not found" });
      }
      const selectedFile = getUploadedFile(req);
      if (!selectedFile) {
        return res.status(400).json({ error: "No image" });
      }
      if (!selectedFile.mimetype?.startsWith("image/")) {
        return res.status(400).json({ error: "Only image files are allowed" });
      }

      const uploaded = await saveUploadedMedia(selectedFile);
      const cover = normalizeMediaValue(uploaded);
      const safeUser = await User.findByIdAndUpdate(
        req.user.id,
        { $set: { cover } },
        { new: true, runValidators: true }
      ).select("-password");
      if (!safeUser) {
        return res.status(404).json({ error: "User not found" });
      }
      normalizeUserMediaDocument(safeUser);
      if (process.env.NODE_ENV !== "production") {
        console.log("[UPLOAD][cover]", {
          userId: safeUser._id.toString(),
          url: safeUser.cover?.url || "",
          public_id: safeUser.cover?.public_id || "",
          resource_type: uploaded.resource_type,
        });
      }

      try {
        await Post.create({
          author: safeUser._id,
          text: "Updated cover photo",
          media: [{ url: uploaded.url, type: "image" }],
          privacy: "public",
        });
      } catch (postErr) {
        console.error("Cover update post creation failed:", postErr);
      }

      return res.json({
        user: safeUser,
        media: cover,
      });
    } catch (err) {
      console.error("Cover upload failed:", err);
      return res.status(500).json({
        error: err?.message || "Cover upload failed",
        message: err?.message || "Cover upload failed",
      });
    }
  }
);

/* ================= STATUS / MOOD ================= */
router.put("/me/status", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const text = String(req.body?.text || "").trim().slice(0, 120);
    const emoji = String(req.body?.emoji || "").trim().slice(0, 8);
    user.status = {
      text,
      emoji,
      updatedAt: text || emoji ? new Date() : null,
    };
    await user.save();
    return res.json({ success: true, status: user.status });
  } catch (err) {
    console.error("Status update failed:", err);
    return res.status(500).json({ error: "Failed to update status" });
  }
});

router.get("/:id/status", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const user = await User.findById(req.params.id).select("_id status").lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json({
      userId: user._id.toString(),
      status: user.status || { text: "", emoji: "", updatedAt: null },
    });
  } catch (err) {
    console.error("Status fetch failed:", err);
    return res.status(500).json({ error: "Failed to fetch status" });
  }
});

/* ================= CLOSE FRIENDS ================= */
router.get("/me/close-friends", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate("closeFriends", "_id name username avatar")
      .lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const payload = (user.closeFriends || []).map((entry) => ({
      _id: toIdString(entry._id),
      name: entry.name || "",
      username: entry.username || "",
      avatar: avatarToUrl(entry.avatar),
    }));
    return res.json(payload);
  } catch (err) {
    console.error("Close friends fetch failed:", err);
    return res.status(500).json({ error: "Failed to load close friends" });
  }
});

router.put("/me/close-friends", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const add = Array.isArray(req.body?.add) ? req.body.add : [];
    const remove = Array.isArray(req.body?.remove) ? req.body.remove : [];
    add.forEach((id) => {
      if (isValidId(id) && toIdString(id) !== toIdString(user._id)) {
        user.closeFriends.addToSet(id);
      }
    });
    remove.forEach((id) => {
      if (isValidId(id)) {
        user.closeFriends.pull(id);
      }
    });
    await user.save();
    return res.json({
      success: true,
      closeFriends: (user.closeFriends || []).map((id) => toIdString(id)),
    });
  } catch (err) {
    console.error("Close friends update failed:", err);
    return res.status(500).json({ error: "Failed to update close friends" });
  }
});

/* ================= PRIVACY CONTROLS ================= */
router.put("/me/privacy", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const profileVisibility = String(req.body?.profileVisibility || "").toLowerCase();
    const defaultPostAudience = String(req.body?.defaultPostAudience || "").toLowerCase();
    const allowMessagesFrom = String(req.body?.allowMessagesFrom || "").toLowerCase();

    if (PRIVACY_VALUES.includes(profileVisibility)) {
      user.privacy.profileVisibility = profileVisibility;
    }
    if (AUDIENCE_VALUES.includes(defaultPostAudience)) {
      user.privacy.defaultPostAudience = defaultPostAudience;
    }
    if (MESSAGE_PERMISSION_VALUES.includes(allowMessagesFrom)) {
      user.privacy.allowMessagesFrom = allowMessagesFrom;
    }

    await user.save();
    return res.json({
      success: true,
      privacy: user.privacy,
    });
  } catch (err) {
    console.error("Privacy update failed:", err);
    return res.status(500).json({ error: "Failed to update privacy settings" });
  }
});

const updateIdListField = (field, operation = "add") => async (req, res) => {
  try {
    if (!isValidId(req.params.userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const meId = toIdString(req.user.id);
    const targetId = toIdString(req.params.userId);
    if (meId === targetId) {
      return res.status(400).json({ error: "You cannot update yourself" });
    }

    const user = await User.findById(meId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user[field] = Array.isArray(user[field]) ? user[field] : [];

    if (operation === "remove") {
      user[field].pull(targetId);
    } else {
      user[field].addToSet(targetId);
    }
    await user.save();

    return res.json({
      success: true,
      [field]: (user[field] || []).map((entry) => toIdString(entry)),
    });
  } catch (err) {
    console.error(`Failed to update ${field}:`, err);
    return res.status(500).json({ error: "Failed to update list" });
  }
};

router.put("/me/block/:userId", auth, updateIdListField("blocks", "add"));
router.put("/me/unblock/:userId", auth, updateIdListField("blocks", "remove"));
router.put("/me/mute/:userId", auth, updateIdListField("mutes", "add"));
router.put("/me/unmute/:userId", auth, updateIdListField("mutes", "remove"));
router.put("/me/restrict/:userId", auth, updateIdListField("restricts", "add"));
router.put("/me/unrestrict/:userId", auth, updateIdListField("restricts", "remove"));
router.put("/me/hide-stories-from/:userId", auth, updateIdListField("hiddenStoriesFrom", "add"));
router.put(
  "/me/unhide-stories-from/:userId",
  auth,
  updateIdListField("hiddenStoriesFrom", "remove")
);

/* ================= STREAK ================= */
router.get("/me/streaks", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("streaks").lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json(user.streaks || { checkIn: { count: 0, lastCheckInAt: null } });
  } catch (err) {
    console.error("Streak fetch failed:", err);
    return res.status(500).json({ error: "Failed to load streaks" });
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const viewerId = toIdString(req.user.id);
    const user = await User.findById(req.params.id).select("-password").lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const isOwner = viewerId === toIdString(user._id);
    const isFriend = (user.friends || []).some((id) => toIdString(id) === viewerId);
    const profileVisibility = String(user?.privacy?.profileVisibility || "public");
    if (!isOwner && profileVisibility === "private") {
      return res.status(403).json({ error: "Profile is private" });
    }
    if (!isOwner && profileVisibility === "friends" && !isFriend) {
      return res.status(403).json({ error: "Profile is visible to friends only" });
    }
    return res.json(user);
  } catch (err) {
    console.error("User detail failed:", err);
    return res.status(500).json({ error: "Failed to load user" });
  }
});

router.put("/me/onboarding", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const incomingSteps = req.body?.steps && typeof req.body.steps === "object" ? req.body.steps : {};
    user.onboarding = user.onboarding || { completed: false, steps: {} };
    user.onboarding.steps = user.onboarding.steps || {};
    for (const key of ["avatar", "bio", "interests", "followSuggestions"]) {
      if (Object.prototype.hasOwnProperty.call(incomingSteps, key)) {
        user.onboarding.steps[key] = Boolean(incomingSteps[key]);
      }
    }
    if (Array.isArray(req.body?.interests)) {
      user.interests = req.body.interests
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 20);
      user.onboarding.steps.interests = user.interests.length > 0;
    }
    if (typeof req.body?.completed === "boolean") {
      user.onboarding.completed = req.body.completed;
    } else {
      const steps = user.onboarding.steps || {};
      user.onboarding.completed =
        Boolean(steps.avatar) &&
        Boolean(steps.bio) &&
        Boolean(steps.interests) &&
        Boolean(steps.followSuggestions);
    }
    await user.save();
    return res.json({
      success: true,
      onboarding: user.onboarding,
      interests: user.interests || [],
    });
  } catch (err) {
    console.error("Onboarding update failed:", err);
    return res.status(500).json({ error: "Failed to update onboarding" });
  }
});

module.exports = router;
