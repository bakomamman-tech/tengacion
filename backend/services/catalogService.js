const mongoose = require("mongoose");
const CreatorProfile = require("../models/CreatorProfile");
const Track = require("../models/Track");
const Book = require("../models/Book");
const Album = require("../models/Album");
const Video = require("../models/Video");

const toObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }
  return new mongoose.Types.ObjectId(value);
};

const resolvePurchasableItem = async (itemType, itemId) => {
  const normalizedType = String(itemType || "").trim().toLowerCase();
  const objectId = toObjectId(itemId);

  if (!objectId) {
    return null;
  }

  if (["track", "song", "podcast"].includes(normalizedType)) {
    const track = await Track.findById(objectId).lean();
    if (!track) {
      return null;
    }
    return {
      itemType: "track",
      itemId: track._id,
      title: track.title || "Track",
      price: Number(track.price) || 0,
      creatorId: track.creatorId?.toString() || "",
      payload: track,
    };
  }

  if (["book", "ebook"].includes(normalizedType)) {
    const book = await Book.findById(objectId).lean();
    if (!book) {
      return null;
    }
    return {
      itemType: "book",
      itemId: book._id,
      title: book.title || "Book",
      price: Number(book.price) || 0,
      creatorId: book.creatorId?.toString() || "",
      payload: book,
    };
  }

  if (["album"].includes(normalizedType)) {
    const album = await Album.findById(objectId).lean();
    if (!album) {
      return null;
    }
    return {
      itemType: "album",
      itemId: album._id,
      title: album.title || "Album",
      price: Number(album.price) || 0,
      creatorId: album.creatorId?.toString() || "",
      payload: album,
    };
  }

  if (["video", "comedy"].includes(normalizedType)) {
    const video = await Video.findById(objectId).lean();
    if (!video) {
      return null;
    }
    return {
      itemType: "video",
      itemId: video._id,
      title: video.caption || "Video",
      price: Number(video.price) || 0,
      creatorId: String(video.creatorProfileId || ""),
      payload: video,
    };
  }

  if (["subscription", "membership", "fanpass"].includes(normalizedType)) {
    const creatorProfile = await CreatorProfile.findById(objectId)
      .select("displayName fullName subscriptionPrice userId")
      .lean();
    if (!creatorProfile) {
      return null;
    }
    const creatorName =
      creatorProfile.displayName ||
      creatorProfile.fullName ||
      "Creator";
    return {
      itemType: "subscription",
      itemId: creatorProfile._id,
      title: `${creatorName} Membership`,
      price: Number(creatorProfile.subscriptionPrice ?? 2000) || 2000,
      creatorId: creatorProfile._id.toString(),
      ownerUserId: creatorProfile.userId?.toString?.() || "",
      payload: creatorProfile,
    };
  }

  return null;
};

module.exports = {
  resolvePurchasableItem,
};
