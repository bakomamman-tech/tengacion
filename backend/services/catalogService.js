const mongoose = require("mongoose");
const Track = require("../models/Track");
const Book = require("../models/Book");

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

  if (normalizedType === "track") {
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

  if (normalizedType === "book") {
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

  return null;
};

module.exports = {
  resolvePurchasableItem,
};
