const express = require("express");
const mongoose = require("mongoose");

const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const upload = require("../middleware/privateUpload");
const moderateUpload = require("../middleware/moderateUpload");
const Group = require("../models/Group");
const { saveUploadedMedia } = require("../services/mediaStore");

const router = express.Router();

router.use(auth);

const userFields = "name username avatar";

const populateGroup = (query) =>
  query
    .populate("owner", userFields)
    .populate("members.user", userFields)
    .populate("posts.author", userFields);

const serializeUser = (user) => ({
  id: String(user?._id || user || ""),
  name: String(user?.name || user?.username || "Tengacion member"),
  username: String(user?.username || ""),
  avatar: String(user?.avatar || ""),
});

const serializeGroup = (group) => ({
  id: String(group._id),
  name: group.name,
  description: group.description || "",
  privacy: group.privacy,
  coverImage: group.coverImage || "",
  createdAt: group.createdAt,
  updatedAt: group.updatedAt,
  owner: serializeUser(group.owner),
  members: (group.members || []).map((member) => ({
    ...serializeUser(member.user),
    role: member.role === "admin" ? "Admin" : member.role === "moderator" ? "Moderator" : "Member",
  })),
  posts: (group.posts || [])
    .slice()
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .map((post) => ({
      id: String(post._id),
      text: post.text,
      createdAt: post.createdAt,
      author: serializeUser(post.author),
    })),
});

const cleanText = (value = "") => String(value || "").trim();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const scope = cleanText(req.query.scope).toLowerCase();
    const filter =
      scope === "discover"
        ? { privacy: "public", owner: { $ne: userId }, "members.user": { $ne: userId } }
        : { $or: [{ owner: userId }, { "members.user": userId }] };
    const groups = await populateGroup(Group.find(filter).sort({ updatedAt: -1 }).limit(100));
    res.json(groups.map(serializeGroup));
  })
);

router.post(
  "/",
  upload.single("coverImage"),
  moderateUpload({
    sourceType: "group_cover",
    titleFields: ["name"],
    descriptionFields: ["description"],
  }),
  asyncHandler(async (req, res) => {
    const name = cleanText(req.body?.name);
    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ error: "Group name must be between 2 and 80 characters" });
    }
    const userId = new mongoose.Types.ObjectId(req.user.id);
    if (cleanText(req.body?.coverImage)) {
      return res.status(400).json({
        error: "Upload the group cover image instead of providing an external URL",
      });
    }
    if (req.file && !String(req.file.mimetype || "").toLowerCase().startsWith("image/")) {
      return res.status(400).json({ error: "Group cover must be an image file" });
    }
    const uploadedCover = req.file
      ? await saveUploadedMedia(req.file, {
          source: "group_cover",
          resourceType: "image",
        })
      : null;
    const coverImage = String(uploadedCover?.secureUrl || uploadedCover?.url || "").slice(0, 2048);
    const group = await Group.create({
      owner: userId,
      name,
      description: cleanText(req.body?.description).slice(0, 500),
      privacy: req.body?.privacy === "private" ? "private" : "public",
      coverImage,
      members: [{ user: userId, role: "admin" }],
    });
    const populated = await populateGroup(Group.findById(group._id));
    res.status(201).json(serializeGroup(populated));
  })
);

router.get(
  "/:groupId",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.groupId)) {
      return res.status(404).json({ error: "Group not found" });
    }
    const group = await populateGroup(Group.findById(req.params.groupId));
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }
    const isMember = group.members.some((member) => String(member.user?._id || member.user) === String(req.user.id));
    if (group.privacy === "private" && !isMember) {
      return res.status(403).json({ error: "This is a private group" });
    }
    res.json(serializeGroup(group));
  })
);

router.post(
  "/:groupId/posts",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.groupId)) {
      return res.status(404).json({ error: "Group not found" });
    }
    const text = cleanText(req.body?.text);
    if (!text || text.length > 5000) {
      return res.status(400).json({ error: "Post text is required and must be under 5,000 characters" });
    }
    const group = await Group.findById(req.params.groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }
    const isMember = group.members.some((member) => String(member.user) === String(req.user.id));
    if (!isMember) {
      return res.status(403).json({ error: "Join this group before posting" });
    }
    group.posts.push({ author: req.user.id, text });
    await group.save();
    const populated = await populateGroup(Group.findById(group._id));
    res.status(201).json(serializeGroup(populated));
  })
);

module.exports = router;
