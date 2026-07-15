const crypto = require("crypto");

const TopUpPromoPlay = require("../models/TopUpPromoPlay");
const { CAMPAIGN_KEY } = require("../models/TopUpPromoPlay");
const User = require("../models/User");
const { sanitizePhoneValue } = require("../utils/profileFields");

// Kept on the server so the two winning stars cannot be found in the browser bundle.
const WINNING_CHEST_NUMBERS = new Set([4, 11]);

const CAMPAIGN = Object.freeze({
  key: CAMPAIGN_KEY,
  title: "Top-Up Bank Account Promo",
  totalChests: 50,
  prizeChests: WINNING_CHEST_NUMBERS.size,
  prizeAmount: 5000,
  customerCarePhone: "08164649980",
  artworkUrl: "/assets/promos/top-up-bank-account-promo.png",
});

const ALPHANUMERIC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ADMIN_ROLES = new Set(["admin", "super_admin", "moderator", "trust_safety_admin"]);

class TopUpPromoError extends Error {
  constructor(message, status = 400, code = "top_up_promo_error", payload = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const generatePasscode = () => {
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (byte) => ALPHANUMERIC[byte % ALPHANUMERIC.length]).join("");
};

const isAdminAccount = (user = {}) =>
  ADMIN_ROLES.has(String(user?.role || "").trim().toLowerCase());

const isActiveAccount = (user = {}) =>
  Boolean(user?._id) &&
  user.isActive !== false &&
  user.isDeleted !== true &&
  user.isBanned !== true &&
  user.isSuspended !== true;

const serializePlay = (play = null, { includeContact = false } = {}) => {
  if (!play) return null;

  const value = typeof play.toObject === "function" ? play.toObject() : play;
  const won = String(value.outcome || "") === "win";
  const serialized = {
    id: toId(value._id),
    chestNumber: Number(value.chestNumber || 0),
    outcome: won ? "win" : "water",
    won,
    prizeAmount: won ? Number(value.prizeAmount || CAMPAIGN.prizeAmount) : 0,
    passcode: won ? String(value.passcode || "") : "",
    discoveredAt: value.discoveredAt || value.createdAt || null,
    claimStatus: String(value.claimStatus || "pending"),
  };

  if (includeContact) {
    serialized.name = String(value.contactSnapshot?.name || "");
    serialized.username = String(value.contactSnapshot?.username || "");
    serialized.email = String(value.contactSnapshot?.email || "");
    serialized.phone = String(value.contactSnapshot?.phone || "");
  }

  return serialized;
};

const getUserForPromo = (userId) =>
  User.findById(userId)
    .select("_id name username email phone role isActive isDeleted isBanned isSuspended")
    .lean();

const buildVisibility = (user = {}) => {
  if (!isActiveAccount(user)) {
    return {
      visible: false,
      reason: "inactive_account",
      message: "This promotion is only available to active Tengacion accounts.",
    };
  }

  if (isAdminAccount(user)) {
    return {
      visible: false,
      reason: "admin_account",
      message: "Promotion discoveries are not shown on administrator accounts.",
    };
  }

  return { visible: true, reason: "available", message: "" };
};

const buildAvailability = (chestNumbers = []) => {
  const discoveredChestNumbers = [...new Set(chestNumbers)]
    .map(Number)
    .filter(
      (chestNumber) =>
        Number.isInteger(chestNumber) &&
        chestNumber >= 1 &&
        chestNumber <= CAMPAIGN.totalChests
    )
    .sort((left, right) => left - right);

  return {
    discoveredChestNumbers,
    remainingChests: Math.max(0, CAMPAIGN.totalChests - discoveredChestNumbers.length),
  };
};

const getTopUpPromoAvailability = async () =>
  buildAvailability(
    await TopUpPromoPlay.distinct("chestNumber", { campaignKey: CAMPAIGN.key })
  );

const buildTopUpPromoStatus = async (userId) => {
  const [user, play, availability] = await Promise.all([
    getUserForPromo(userId),
    TopUpPromoPlay.findOne({ campaignKey: CAMPAIGN.key, userId }).lean(),
    getTopUpPromoAvailability(),
  ]);

  if (!user) {
    throw new TopUpPromoError("User not found", 404, "user_not_found");
  }

  const visibility = buildVisibility(user);
  return {
    campaign: CAMPAIGN,
    visibility,
    hasPlayed: Boolean(play),
    play: serializePlay(play),
    ...availability,
  };
};

const createPlay = async ({ user, userId, chestNumber }) => {
  const won = WINNING_CHEST_NUMBERS.has(chestNumber);
  const contactSnapshot = {
    name: String(user.name || user.username || "Tengacion user").trim(),
    username: String(user.username || "").trim(),
    email: String(user.email || "").trim().toLowerCase(),
    phone: sanitizePhoneValue(user.phone),
  };

  if (!contactSnapshot.phone) {
    throw new TopUpPromoError(
      "Add a valid phone number to your profile before opening a promo chest.",
      422,
      "phone_required"
    );
  }

  const base = {
    campaignKey: CAMPAIGN.key,
    userId,
    chestNumber,
    outcome: won ? "win" : "water",
    prizeAmount: won ? CAMPAIGN.prizeAmount : 0,
    contactSnapshot,
    discoveredAt: new Date(),
  };

  if (!won) {
    return TopUpPromoPlay.create(base);
  }

  // A collision is extraordinarily unlikely; retrying keeps the uniqueness guarantee explicit.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await TopUpPromoPlay.create({ ...base, passcode: generatePasscode() });
    } catch (error) {
      if (error?.code !== 11000 || error?.keyPattern?.passcode !== 1) {
        throw error;
      }
    }
  }

  throw new TopUpPromoError("Could not issue a unique winning passcode. Please try again.", 503, "passcode_unavailable");
};

const discoverTopUpPromoChest = async ({ userId, chestNumber }) => {
  const normalizedChest = Number(chestNumber);
  if (!Number.isInteger(normalizedChest) || normalizedChest < 1 || normalizedChest > CAMPAIGN.totalChests) {
    throw new TopUpPromoError("Choose a valid discovery star.", 400, "invalid_chest");
  }

  const user = await getUserForPromo(userId);
  if (!user) {
    throw new TopUpPromoError("User not found", 404, "user_not_found");
  }

  const visibility = buildVisibility(user);
  if (!visibility.visible) {
    throw new TopUpPromoError(visibility.message, 403, "promo_unavailable", { visibility });
  }

  const existing = await TopUpPromoPlay.findOne({ campaignKey: CAMPAIGN.key, userId });
  if (existing) {
    return {
      campaign: CAMPAIGN,
      alreadyPlayed: true,
      hasPlayed: true,
      play: serializePlay(existing),
      ...(await getTopUpPromoAvailability()),
    };
  }

  try {
    const play = await createPlay({ user, userId, chestNumber: normalizedChest });
    return {
      campaign: CAMPAIGN,
      alreadyPlayed: false,
      hasPlayed: true,
      play: serializePlay(play),
      ...(await getTopUpPromoAvailability()),
    };
  } catch (error) {
    if (error?.code === 11000) {
      const play = await TopUpPromoPlay.findOne({ campaignKey: CAMPAIGN.key, userId });
      if (play) {
        return {
          campaign: CAMPAIGN,
          alreadyPlayed: true,
          hasPlayed: true,
          play: serializePlay(play),
          ...(await getTopUpPromoAvailability()),
        };
      }

      const discoveredPlay = await TopUpPromoPlay.findOne({
        campaignKey: CAMPAIGN.key,
        chestNumber: normalizedChest,
      })
        .select("_id")
        .lean();

      if (discoveredPlay) {
        throw new TopUpPromoError(
          "Another user just discovered this chest. Choose one of the remaining stars.",
          409,
          "chest_already_discovered",
          await getTopUpPromoAvailability()
        );
      }
    }
    throw error;
  }
};

const listTopUpPromoPlaysForAdmin = async ({ outcome = "", page = 1, limit = 100 } = {}) => {
  const normalizedOutcome = String(outcome || "").trim().toLowerCase();
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(250, Math.max(1, Number(limit) || 100));
  const query = { campaignKey: CAMPAIGN.key };

  if (["win", "water"].includes(normalizedOutcome)) {
    query.outcome = normalizedOutcome;
  }

  const [plays, total, summaryRows] = await Promise.all([
    TopUpPromoPlay.find(query)
      .sort({ discoveredAt: -1, _id: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    TopUpPromoPlay.countDocuments(query),
    TopUpPromoPlay.aggregate([
      { $match: { campaignKey: CAMPAIGN.key } },
      { $group: { _id: "$outcome", count: { $sum: 1 }, prizeAmount: { $sum: "$prizeAmount" } } },
    ]),
  ]);

  const summary = { totalDiscoveries: 0, winners: 0, waterDiscoveries: 0, prizeLiability: 0 };
  summaryRows.forEach((row) => {
    const count = Number(row.count || 0);
    summary.totalDiscoveries += count;
    if (row._id === "win") {
      summary.winners = count;
      summary.prizeLiability = Number(row.prizeAmount || 0);
    } else if (row._id === "water") {
      summary.waterDiscoveries = count;
    }
  });

  return {
    campaign: CAMPAIGN,
    summary,
    plays: plays.map((play) => serializePlay(play, { includeContact: true })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
};

module.exports = {
  CAMPAIGN,
  TopUpPromoError,
  buildTopUpPromoStatus,
  discoverTopUpPromoChest,
  generatePasscode,
  listTopUpPromoPlaysForAdmin,
};
