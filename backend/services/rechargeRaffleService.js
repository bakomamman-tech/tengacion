const RechargeRaffleCard = require("../models/RechargeRaffleCard");
const RechargeRafflePlay = require("../models/RechargeRafflePlay");
const Post = require("../models/Post");
const User = require("../models/User");
const { mediaToUrl } = require("../utils/userMedia");

const MAX_SPINS = 5;
const COOLDOWN_MS = 2 * 24 * 60 * 60 * 1000;
const PRIZE_AMOUNT = 100;
const NETWORKS = {
  mtn: {
    id: "mtn",
    label: "MTN",
    pinLengths: [16, 17],
    dialCodes: ["*555*PIN#", "*311*PIN#"],
  },
  airtel: {
    id: "airtel",
    label: "Airtel",
    pinLengths: [16],
    dialCodes: ["*126*PIN#", "*444*PIN#"],
  },
};
const ADVERTISED_PRIZE_TIERS = [100, 500, 1000, 10000];
const SPIN_LOSS_OUTCOMES = [
  { label: "N500 near miss", amount: 500 },
  { label: "N1000 near miss", amount: 1000 },
  { label: "N10000 jackpot lane", amount: 10000 },
  { label: "Bonus spin glow", amount: 0 },
];

class RechargeRaffleError extends Error {
  constructor(message, status = 400, code = "raffle_error", payload = {}) {
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

const normalizeNetwork = (value = "") => {
  const network = String(value || "").trim().toLowerCase();
  if (!NETWORKS[network]) {
    return "";
  }
  return network;
};

const normalizePin = (value = "") => String(value || "").replace(/\D/g, "").trim();

const validatePinForNetwork = (network, pin) => {
  const config = NETWORKS[network];
  if (!config) {
    return "Choose MTN or Airtel.";
  }
  if (!/^\d+$/.test(pin)) {
    return "PIN must contain digits only.";
  }
  if (!config.pinLengths.includes(pin.length)) {
    const lengths = config.pinLengths.join(" or ");
    return `${config.label} N100 PINs must be ${lengths} digits.`;
  }
  return "";
};

const maskPin = (pin = "") => {
  const value = String(pin || "").trim();
  if (value.length <= 8) {
    return value ? "****" : "";
  }
  return `${value.slice(0, 4)} ${"*".repeat(Math.max(4, value.length - 8))} ${value.slice(-4)}`;
};

const buildDialCodes = (network, pin = "PIN") =>
  (NETWORKS[network]?.dialCodes || []).map((code) => code.replace("PIN", pin));

const getNetworkPayload = () =>
  Object.values(NETWORKS).map((network) => ({
    id: network.id,
    label: network.label,
    pinLengths: network.pinLengths,
    dialCodes: network.dialCodes,
  }));

const hasProfilePhoto = (user = {}) => Boolean(mediaToUrl(user.avatar));

const getEligibility = (user = {}) => {
  const accountBasicsComplete = Boolean(user?.name && user?.username && user?.email);
  const profilePhotoComplete = hasProfilePhoto(user);
  const activeAccount =
    Boolean(user?._id) &&
    user.isActive !== false &&
    user.isDeleted !== true &&
    user.isBanned !== true &&
    user.isSuspended !== true;

  const requirements = [
    {
      id: "account",
      label: "Complete account basics",
      complete: accountBasicsComplete && activeAccount,
    },
    {
      id: "avatar",
      label: "Upload a profile picture",
      complete: profilePhotoComplete,
    },
  ];

  return {
    eligible: requirements.every((item) => item.complete),
    requirements,
    accountBasicsComplete,
    profilePhotoComplete,
    activeAccount,
  };
};

const getRepeatPostRequirement = async (userId, latestPlay = null, now = new Date()) => {
  if (!latestPlay || String(latestPlay.status || "active") === "active") {
    return {
      required: false,
      complete: true,
      since: null,
      latestPostAt: null,
    };
  }

  const nextAvailableAt = latestPlay.nextAvailableAt ? new Date(latestPlay.nextAvailableAt) : null;
  if (nextAvailableAt && nextAvailableAt.getTime() > now.getTime()) {
    return {
      required: false,
      complete: true,
      since: latestPlay.wonAt || latestPlay.updatedAt || latestPlay.createdAt || null,
      latestPostAt: null,
    };
  }

  const since = latestPlay.wonAt || latestPlay.updatedAt || latestPlay.createdAt || null;
  if (!since) {
    return {
      required: true,
      complete: false,
      since: null,
      latestPostAt: null,
    };
  }

  const latestPost = await Post.findOne({
    author: userId,
    createdAt: { $gt: since },
  })
    .select("_id createdAt")
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  return {
    required: true,
    complete: Boolean(latestPost),
    since,
    latestPostAt: latestPost?.createdAt || null,
  };
};

const getEffectiveEligibility = async (user = {}, latestPlay = null, now = new Date()) => {
  const base = getEligibility(user);
  const repeatPostRequirement = await getRepeatPostRequirement(user?._id, latestPlay, now);
  const requirements = [...base.requirements];

  if (repeatPostRequirement.required) {
    requirements.push({
      id: "feed_post",
      label: "Post on your registered feed page before your next raffle round",
      complete: repeatPostRequirement.complete,
      since: repeatPostRequirement.since,
      latestPostAt: repeatPostRequirement.latestPostAt,
    });
  }

  return {
    ...base,
    eligible: base.eligible && (!repeatPostRequirement.required || repeatPostRequirement.complete),
    requirements,
    repeatPostRequirement,
  };
};

const serializePrize = (play = {}) => {
  if (!play?.prizePin) {
    return null;
  }
  return {
    network: play.network,
    networkLabel: NETWORKS[play.network]?.label || play.network,
    amount: Number(play.prizeAmount || PRIZE_AMOUNT),
    pin: String(play.prizePin || ""),
    dialCodes: buildDialCodes(play.network, play.prizePin),
    wonAt: play.wonAt || null,
  };
};

const serializePlay = (play = null, now = new Date()) => {
  if (!play) {
    return null;
  }

  const status = String(play.status || "active");
  const spinsUsed = Number(play.spinsUsed || 0);
  const maxSpins = Number(play.maxSpins || MAX_SPINS);
  const nextAvailableAt = play.nextAvailableAt || null;
  const cooldownActive =
    status !== "active" &&
    nextAvailableAt &&
    new Date(nextAvailableAt).getTime() > now.getTime();

  return {
    _id: toId(play._id),
    network: play.network,
    networkLabel: NETWORKS[play.network]?.label || play.network,
    status,
    spinsUsed,
    maxSpins,
    spinsRemaining: Math.max(0, maxSpins - spinsUsed),
    nextAvailableAt,
    cooldownActive,
    spinHistory: Array.isArray(play.spinHistory) ? play.spinHistory : [],
    prize: serializePrize(play),
    createdAt: play.createdAt || null,
    updatedAt: play.updatedAt || null,
  };
};

const getAvailabilitySummary = async () => {
  const rows = await RechargeRaffleCard.aggregate([
    {
      $group: {
        _id: {
          network: "$network",
          status: "$status",
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const summary = {
    total: 0,
    available: 0,
    claimed: 0,
    void: 0,
    byNetwork: Object.keys(NETWORKS).reduce((acc, network) => {
      acc[network] = { available: 0, claimed: 0, void: 0, total: 0 };
      return acc;
    }, {}),
  };

  rows.forEach((row) => {
    const network = row?._id?.network;
    const status = row?._id?.status || "available";
    const count = Number(row?.count || 0);
    if (!summary.byNetwork[network]) {
      return;
    }
    summary.byNetwork[network][status] = count;
    summary.byNetwork[network].total += count;
    summary[status] = (Number(summary[status] || 0) + count);
    summary.total += count;
  });

  return summary;
};

const getLatestPlay = (userId) =>
  RechargeRafflePlay.findOne({ userId }).sort({ createdAt: -1, _id: -1 });

const buildRaffleStatus = async (userId) => {
  const now = new Date();
  const [user, latestPlay, availability] = await Promise.all([
    User.findById(userId).select("_id name username email avatar isActive isDeleted isBanned isSuspended").lean(),
    RechargeRafflePlay.findOne({ userId }).sort({ createdAt: -1, _id: -1 }).lean(),
    getAvailabilitySummary(),
  ]);

  if (!user) {
    throw new RechargeRaffleError("User not found", 404, "user_not_found");
  }

  const eligibility = await getEffectiveEligibility(user, latestPlay, now);
  const play = serializePlay(latestPlay, now);
  const cooldownActive = Boolean(play?.cooldownActive);
  const retryAfterSeconds = cooldownActive
    ? Math.max(0, Math.ceil((new Date(play.nextAvailableAt).getTime() - now.getTime()) / 1000))
    : 0;
  const hasActivePlay = play?.status === "active" && play.spinsRemaining > 0;

  return {
    eligibility,
    prizeTiers: ADVERTISED_PRIZE_TIERS,
    networks: getNetworkPayload(),
    availability: {
      mtn: {
        available: Number(availability.byNetwork.mtn.available || 0),
      },
      airtel: {
        available: Number(availability.byNetwork.airtel.available || 0),
      },
    },
    play,
    cooldown: {
      active: cooldownActive,
      retryAfterSeconds,
      nextAvailableAt: cooldownActive ? play.nextAvailableAt : null,
    },
    canStart: eligibility.eligible && !cooldownActive && !hasActivePlay,
    canSpin: eligibility.eligible && !cooldownActive && (!play || hasActivePlay || play.status !== "active"),
    rules: {
      maxSpins: MAX_SPINS,
      cooldownHours: COOLDOWN_MS / (60 * 60 * 1000),
      prizeAmount: PRIZE_AMOUNT,
    },
  };
};

const chooseLossOutcome = (spinNumber) => {
  const index = Math.max(0, (Number(spinNumber || 1) - 1) % SPIN_LOSS_OUTCOMES.length);
  return SPIN_LOSS_OUTCOMES[index];
};

const shouldWinSpin = (spinNumber) => {
  if (spinNumber >= MAX_SPINS) {
    return true;
  }

  const probabilities = [0.18, 0.24, 0.34, 0.46];
  return Math.random() < probabilities[Math.max(0, spinNumber - 1)];
};

const findAvailableCard = (network) =>
  RechargeRaffleCard.findOne({ network, amount: PRIZE_AMOUNT, status: "available" })
    .sort({ createdAt: 1, _id: 1 })
    .select("_id");

const claimAvailableCard = (network, userId, playId, now) =>
  RechargeRaffleCard.findOneAndUpdate(
    { network, amount: PRIZE_AMOUNT, status: "available" },
    {
      $set: {
        status: "claimed",
        claimedBy: userId,
        claimedAt: now,
        playId,
      },
    },
    {
      sort: { createdAt: 1, _id: 1 },
      new: true,
    }
  );

const getOrCreatePlayableRound = async ({ userId, network, now }) => {
  const latest = await getLatestPlay(userId);
  if (!latest) {
    return RechargeRafflePlay.create({ userId, network });
  }

  const status = String(latest.status || "active");
  const nextAvailableAt = latest.nextAvailableAt ? new Date(latest.nextAvailableAt) : null;
  if (status !== "active") {
    if (nextAvailableAt && nextAvailableAt.getTime() > now.getTime()) {
      return latest;
    }
    return RechargeRafflePlay.create({ userId, network });
  }

  if (Number(latest.spinsUsed || 0) >= MAX_SPINS) {
    latest.status = "exhausted";
    latest.nextAvailableAt = new Date(now.getTime() + COOLDOWN_MS);
    await latest.save();
    return latest;
  }

  return latest;
};

const spinRaffle = async ({ userId, network: rawNetwork }) => {
  const now = new Date();
  const network = normalizeNetwork(rawNetwork);
  if (!network) {
    throw new RechargeRaffleError("Choose MTN or Airtel before spinning.", 400, "invalid_network");
  }

  const user = await User.findById(userId)
    .select("_id name username email avatar isActive isDeleted isBanned isSuspended")
    .lean();
  if (!user) {
    throw new RechargeRaffleError("User not found", 404, "user_not_found");
  }

  const latest = await getLatestPlay(userId);
  const eligibility = await getEffectiveEligibility(user, latest, now);
  if (!eligibility.eligible) {
    throw new RechargeRaffleError(
      "Complete the raffle requirements to unlock Spin & Win.",
      403,
      "not_eligible",
      { eligibility }
    );
  }

  if (latest && String(latest.status || "active") !== "active") {
    const nextAvailableAt = latest.nextAvailableAt ? new Date(latest.nextAvailableAt) : null;
    if (nextAvailableAt && nextAvailableAt.getTime() > now.getTime()) {
      const status = await buildRaffleStatus(userId);
      return {
        ...status,
        rateLimited: true,
        spin: {
          won: Boolean(status.play?.prize),
          message: "You have reached your raffle rate limit. Your winning PIN stays available to copy.",
        },
      };
    }
  }

  const availableCard = await findAvailableCard(network);
  if (!availableCard) {
    throw new RechargeRaffleError(
      `${NETWORKS[network].label} N100 recharge cards are currently being loaded. Please choose another network or try again soon.`,
      409,
      "no_cards_available"
    );
  }

  const play = await getOrCreatePlayableRound({ userId, network, now });
  if (String(play.status || "active") !== "active") {
    const status = await buildRaffleStatus(userId);
    return {
      ...status,
      rateLimited: true,
      spin: {
        won: Boolean(status.play?.prize),
        message: "You have reached your raffle rate limit. Your winning PIN stays available to copy.",
      },
    };
  }

  if (String(play.network || "") !== network && Number(play.spinsUsed || 0) > 0) {
    throw new RechargeRaffleError(
      `This round is already locked to ${NETWORKS[play.network]?.label || play.network}.`,
      409,
      "network_locked"
    );
  }

  if (String(play.network || "") !== network) {
    play.network = network;
  }

  const spinNumber = Number(play.spinsUsed || 0) + 1;
  const won = shouldWinSpin(spinNumber);
  if (!won) {
    const outcome = chooseLossOutcome(spinNumber);
    play.spinsUsed = spinNumber;
    play.spinHistory.push({
      spinNumber,
      outcome: outcome.label,
      won: false,
      amount: outcome.amount,
      createdAt: now,
    });
    await play.save();
    const status = await buildRaffleStatus(userId);
    return {
      ...status,
      spin: {
        spinNumber,
        won: false,
        outcome,
        message:
          spinNumber >= MAX_SPINS - 1
            ? "The next spin is the pressure lane."
            : "Close call. Keep the wheel moving.",
      },
    };
  }

  const card = await claimAvailableCard(network, userId, play._id, now);
  if (!card) {
    throw new RechargeRaffleError(
      `${NETWORKS[network].label} N100 recharge cards are currently being loaded. Please try again soon.`,
      409,
      "no_cards_available"
    );
  }

  play.spinsUsed = spinNumber;
  play.status = "won";
  play.prizeAmount = PRIZE_AMOUNT;
  play.rechargeCardId = card._id;
  play.prizePin = card.pin;
  play.wonAt = now;
  play.nextAvailableAt = new Date(now.getTime() + COOLDOWN_MS);
  play.spinHistory.push({
    spinNumber,
    outcome: "N100 recharge PIN",
    won: true,
    amount: PRIZE_AMOUNT,
    createdAt: now,
  });
  await play.save();

  const status = await buildRaffleStatus(userId);
  return {
    ...status,
    spin: {
      spinNumber,
      won: true,
      outcome: { label: "N100 recharge PIN", amount: PRIZE_AMOUNT },
      prize: serializePrize(play.toObject ? play.toObject() : play),
      message: "Winner. Copy your recharge PIN and load it on your phone.",
    },
  };
};

const parsePinsInput = (pins) => {
  if (Array.isArray(pins)) {
    return pins.map((pin) => String(pin || "").trim()).filter(Boolean);
  }
  return String(pins || "")
    .split(/[\s,;]+/)
    .map((pin) => pin.trim())
    .filter(Boolean);
};

const serializeAdminCard = (card = {}) => ({
  _id: toId(card._id),
  network: card.network,
  networkLabel: NETWORKS[card.network]?.label || card.network,
  amount: Number(card.amount || PRIZE_AMOUNT),
  pinMasked: maskPin(card.pin),
  status: card.status || "available",
  loadedBy: toId(card.loadedBy),
  claimedBy: card.claimedBy
    ? {
        _id: toId(card.claimedBy?._id || card.claimedBy),
        name: card.claimedBy?.name || "",
        username: card.claimedBy?.username || "",
      }
    : null,
  claimedAt: card.claimedAt || null,
  batchLabel: card.batchLabel || "",
  createdAt: card.createdAt || null,
  updatedAt: card.updatedAt || null,
});

const loadRechargeCards = async ({
  network: rawNetwork,
  pins,
  loadedBy,
  batchLabel = "",
  adminNote = "",
}) => {
  const network = normalizeNetwork(rawNetwork);
  if (!network) {
    throw new RechargeRaffleError("Choose MTN or Airtel.", 400, "invalid_network");
  }

  const rawPins = parsePinsInput(pins);
  const seen = new Set();
  const validPins = [];
  const invalidEntries = [];
  const duplicateInputPins = [];

  rawPins.forEach((rawPin) => {
    const pin = normalizePin(rawPin);
    if (seen.has(pin)) {
      duplicateInputPins.push(maskPin(pin));
      return;
    }
    seen.add(pin);
    const validationError = validatePinForNetwork(network, pin);
    if (validationError) {
      invalidEntries.push({
        value: String(rawPin || "").slice(0, 24),
        error: validationError,
      });
      return;
    }
    validPins.push(pin);
  });

  if (!validPins.length) {
    throw new RechargeRaffleError(
      invalidEntries[0]?.error || "Enter at least one valid N100 recharge PIN.",
      400,
      "no_valid_pins",
      { invalidEntries, duplicateInputPins }
    );
  }

  const existingRows = await RechargeRaffleCard.find({
    network,
    pin: { $in: validPins },
  })
    .select("pin")
    .lean();
  const existingPins = new Set(existingRows.map((row) => row.pin));
  const docs = validPins
    .filter((pin) => !existingPins.has(pin))
    .map((pin) => ({
      network,
      amount: PRIZE_AMOUNT,
      pin,
      loadedBy,
      batchLabel: String(batchLabel || "").trim().slice(0, 120),
      adminNote: String(adminNote || "").trim().slice(0, 300),
    }));

  const created = docs.length ? await RechargeRaffleCard.insertMany(docs, { ordered: false }) : [];
  const summary = await getAvailabilitySummary();

  return {
    success: true,
    network,
    networkLabel: NETWORKS[network].label,
    createdCount: created.length,
    duplicateCount: existingPins.size + duplicateInputPins.length,
    invalidCount: invalidEntries.length,
    duplicatePins: [
      ...Array.from(existingPins).map(maskPin),
      ...duplicateInputPins,
    ],
    invalidEntries,
    summary,
    cards: created.map(serializeAdminCard),
  };
};

const listRechargeCardsForAdmin = async ({
  network: rawNetwork = "",
  status: rawStatus = "",
  page = 1,
  limit = 25,
} = {}) => {
  const normalizedNetwork = normalizeNetwork(rawNetwork);
  const status = String(rawStatus || "").trim().toLowerCase();
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 25));
  const query = {};
  if (normalizedNetwork) {
    query.network = normalizedNetwork;
  }
  if (["available", "claimed", "void"].includes(status)) {
    query.status = status;
  }

  const [rows, total, summary] = await Promise.all([
    RechargeRaffleCard.find(query)
      .populate("claimedBy", "_id name username")
      .sort({ createdAt: -1, _id: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    RechargeRaffleCard.countDocuments(query),
    getAvailabilitySummary(),
  ]);

  return {
    page: safePage,
    limit: safeLimit,
    total,
    pages: Math.max(1, Math.ceil(total / safeLimit)),
    summary,
    cards: rows.map(serializeAdminCard),
  };
};

module.exports = {
  ADVERTISED_PRIZE_TIERS,
  COOLDOWN_MS,
  MAX_SPINS,
  NETWORKS,
  PRIZE_AMOUNT,
  RechargeRaffleError,
  buildDialCodes,
  buildRaffleStatus,
  listRechargeCardsForAdmin,
  loadRechargeCards,
  maskPin,
  normalizeNetwork,
  spinRaffle,
  validatePinForNetwork,
};
