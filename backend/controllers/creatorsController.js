const mongoose = require("mongoose");
const asyncHandler = require("../middleware/asyncHandler");
const CreatorProfile = require("../models/CreatorProfile");
const Track = require("../models/Track");
const Book = require("../models/Book");

const toCreatorPayload = (profile) => ({
  _id: profile._id.toString(),
  userId: profile.userId?._id ? profile.userId._id.toString() : profile.userId?.toString(),
  displayName: profile.displayName || "",
  bio: profile.bio || "",
  coverImageUrl: profile.coverImageUrl || "",
  links: Array.isArray(profile.links) ? profile.links : [],
  user: profile.userId && typeof profile.userId === "object"
    ? {
        _id: profile.userId._id?.toString() || "",
        name: profile.userId.name || "",
        username: profile.userId.username || "",
        avatar:
          typeof profile.userId.avatar === "string"
            ? profile.userId.avatar
            : profile.userId.avatar?.url || "",
      }
    : null,
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
});

exports.getMyCreatorProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const profile = await CreatorProfile.findOne({ userId }).populate(
    "userId",
    "name username avatar"
  );

  if (!profile) {
    return res.status(404).json({ error: "Creator profile not found" });
  }

  return res.json(toCreatorPayload(profile));
});

exports.upsertMyCreatorProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const displayName = String(req.body?.displayName || "").trim();
  const bio = String(req.body?.bio || "").trim();
  const coverImageUrl = String(req.body?.coverImageUrl || "").trim();
  const links = Array.isArray(req.body?.links)
    ? req.body.links
        .map((entry) => ({
          label: String(entry?.label || "").trim(),
          url: String(entry?.url || "").trim(),
        }))
        .filter((entry) => entry.url)
        .slice(0, 10)
    : [];

  if (!displayName) {
    return res.status(400).json({ error: "displayName is required" });
  }

  const profile = await CreatorProfile.findOneAndUpdate(
    { userId },
    {
      $set: {
        displayName,
        bio: bio.slice(0, 2000),
        coverImageUrl,
        links,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).populate("userId", "name username avatar");

  return res.status(201).json(toCreatorPayload(profile));
});

exports.getCreatorById = asyncHandler(async (req, res) => {
  const { creatorId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(creatorId)) {
    return res.status(400).json({ error: "Invalid creator id" });
  }

  const profile = await CreatorProfile.findById(creatorId).populate(
    "userId",
    "name username avatar"
  );
  if (!profile) {
    return res.status(404).json({ error: "Creator not found" });
  }

  return res.json(toCreatorPayload(profile));
});

exports.getCreatorTracks = asyncHandler(async (req, res) => {
  const { creatorId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(creatorId)) {
    return res.status(400).json({ error: "Invalid creator id" });
  }

  const tracks = await Track.find({ creatorId }).sort({ createdAt: -1 }).lean();
  return res.json(
    tracks.map((track) => ({
      _id: track._id.toString(),
      creatorId: track.creatorId?.toString() || "",
      title: track.title || "",
      description: track.description || "",
      price: Number(track.price) || 0,
      previewUrl: track.previewUrl || "",
      durationSec: Number(track.durationSec) || 0,
      createdAt: track.createdAt,
    }))
  );
});

exports.getCreatorBooks = asyncHandler(async (req, res) => {
  const { creatorId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(creatorId)) {
    return res.status(400).json({ error: "Invalid creator id" });
  }

  const books = await Book.find({ creatorId }).sort({ createdAt: -1 }).lean();
  return res.json(
    books.map((book) => ({
      _id: book._id.toString(),
      creatorId: book.creatorId?.toString() || "",
      title: book.title || "",
      description: book.description || "",
      price: Number(book.price) || 0,
      coverImageUrl: book.coverImageUrl || "",
      createdAt: book.createdAt,
    }))
  );
});
