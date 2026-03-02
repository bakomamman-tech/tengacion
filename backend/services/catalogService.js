const mongoose = require("mongoose");
const Track = require("../models/Track");
const Book = require("../models/Book");
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

  return null;
};

module.exports = {
  resolvePurchasableItem,
};
