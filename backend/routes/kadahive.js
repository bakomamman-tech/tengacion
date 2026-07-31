const express = require("express");
const mongoose = require("mongoose");

const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const User = require("../models/User");
const KadahiveEvent = require("../models/KadahiveEvent");
const KadahiveResource = require("../models/KadahiveResource");
const KadahiveBooking = require("../models/KadahiveBooking");
const KadahiveEventRegistration = require("../models/KadahiveEventRegistration");

const router = express.Router();
const INSTITUTION = "kadahive";
const GLOBAL_ADMIN_ROLES = new Set(["admin", "super_admin"]);

const DEFAULT_EVENTS = [
  {
    title: "AI & Machine Learning Workshop",
    slug: "ai-machine-learning-workshop",
    category: "workshop",
    summary:
      "Learn the fundamentals of artificial intelligence and machine learning with hands-on projects.",
    description:
      "A practical introduction to artificial intelligence and machine learning for Kaduna's emerging technology community.",
    dateLabel: "15 December 2025",
    startsAt: new Date("2025-12-15T09:00:00.000Z"),
    endsAt: new Date("2025-12-15T16:00:00.000Z"),
    status: "archived",
    featured: false,
  },
  {
    title: "KADA Hive Christmas Program",
    slug: "kada-hive-christmas-program",
    category: "training",
    summary:
      "A four-week holiday programme that gives children aged five and above practical coding skills.",
    description:
      "Children learn coding basics, Scratch programming, HTML web design, Python basics and an introduction to AI through guided projects.",
    dateLabel: "19 December 2025 – 16 January 2026",
    startsAt: new Date("2025-12-19T09:00:00.000Z"),
    endsAt: new Date("2026-01-16T13:00:00.000Z"),
    status: "archived",
    featured: true,
  },
  {
    title: "Cyber Smart Bootcamp",
    slug: "cyber-smart-bootcamp-2026",
    category: "bootcamp",
    summary:
      "An intensive two-day bootcamp on cybersecurity, digital safety and practical protection.",
    description:
      "Sessions cover phishing and POS fraud, securing WhatsApp and banking apps, digital identity, ethical hacking and cybersecurity career pathways.",
    dateLabel: "27–28 February 2026",
    startsAt: new Date("2026-02-27T09:00:00.000Z"),
    endsAt: new Date("2026-02-28T16:00:00.000Z"),
    status: "archived",
    featured: true,
  },
];

const DEFAULT_RESOURCES = [
  {
    title: "AI Guidebook",
    description: "A practical guide to understanding and implementing artificial intelligence.",
    category: "technology",
    resourceType: "guide",
    accessLevel: "member",
    progressLabel: "Member guide",
    isPublished: true,
  },
  {
    title: "Web Development Course",
    description: "A structured full-stack development learning path for emerging developers.",
    category: "technology",
    resourceType: "course",
    accessLevel: "member",
    progressLabel: "Self-paced",
    isPublished: true,
  },
  {
    title: "Business Planning Toolkit",
    description: "Templates and prompts for turning an idea into a viable startup plan.",
    category: "business",
    resourceType: "template",
    accessLevel: "member",
    progressLabel: "Downloadable",
    isPublished: true,
  },
];

const cleanText = (value, max = 500) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);

const slugify = (value) =>
  cleanText(value, 180)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const validId = (value) => mongoose.Types.ObjectId.isValid(value);
const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const ensureDefaults = async () => {
  await Promise.all([
    ...DEFAULT_EVENTS.map((event) =>
      KadahiveEvent.updateOne(
        { slug: event.slug },
        { $setOnInsert: event },
        { upsert: true, setDefaultsOnInsert: true }
      )
    ),
    ...DEFAULT_RESOURCES.map((resource) =>
      KadahiveResource.updateOne(
        { title: resource.title },
        { $setOnInsert: resource },
        { upsert: true, setDefaultsOnInsert: true }
      )
    ),
  ]);
};

const membershipFor = (user) =>
  (Array.isArray(user?.institutionMemberships) ? user.institutionMemberships : []).find(
    (entry) => String(entry?.institution || "").toLowerCase() === INSTITUTION
  );

const resolveAccess = async (userId) => {
  const user = await User.findById(userId).select(
    "_id name username email phone role isActive isBanned isDeleted isSuspended institutionMemberships"
  );
  if (!user || !user.isActive || user.isBanned || user.isDeleted || user.isSuspended) {
    return { user: null, membership: null, scope: "" };
  }

  const globalRole = String(user.role || "").toLowerCase();
  if (GLOBAL_ADMIN_ROLES.has(globalRole)) {
    return { user, membership: membershipFor(user), scope: "super_admin" };
  }

  const membership = membershipFor(user);
  if (!membership || membership.status !== "active") {
    return { user, membership, scope: "" };
  }

  return {
    user,
    membership,
    scope: membership.role === "admin" ? "institution_admin" : "member",
  };
};

const requireAccess = (allowedScopes) =>
  asyncHandler(async (req, res, next) => {
    const access = await resolveAccess(req.user?.id);
    if (!access.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!allowedScopes.includes(access.scope)) {
      return res.status(403).json({ error: "Kadahive access is required" });
    }
    req.kadahiveAccess = access;
    return next();
  });

const toMember = (user) => {
  const membership = membershipFor(user);
  return {
    _id: String(user._id || ""),
    name: user.name || "",
    username: user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    role: membership?.role || "member",
    status: membership?.status || "active",
    joinedAt: membership?.joinedAt || user.createdAt || null,
    lastLoginAt: user.lastLoginAt || user.lastLogin || null,
  };
};

const sanitizeEventPayload = (payload = {}, { partial = false } = {}) => {
  const next = {};
  const assign = (key, value) => {
    if (!partial || value !== undefined) next[key] = value;
  };

  assign("title", payload.title === undefined ? undefined : cleanText(payload.title, 160));
  assign("summary", payload.summary === undefined ? undefined : cleanText(payload.summary, 320));
  assign(
    "description",
    payload.description === undefined ? undefined : cleanText(payload.description, 6000)
  );
  assign("dateLabel", payload.dateLabel === undefined ? undefined : cleanText(payload.dateLabel, 80));
  assign("location", payload.location === undefined ? undefined : cleanText(payload.location, 240));
  assign("startsAt", payload.startsAt === undefined ? undefined : parseDate(payload.startsAt));
  assign("endsAt", payload.endsAt === undefined ? undefined : parseDate(payload.endsAt));
  assign(
    "capacity",
    payload.capacity === undefined
      ? undefined
      : Math.max(0, Math.min(100000, Number(payload.capacity) || 0))
  );
  assign("featured", payload.featured === undefined ? undefined : Boolean(payload.featured));

  const category = cleanText(payload.category, 40).toLowerCase();
  if (!partial || payload.category !== undefined) {
    next.category = ["workshop", "bootcamp", "community", "training", "conference", "other"].includes(
      category
    )
      ? category
      : "other";
  }

  const status = cleanText(payload.status, 30).toLowerCase();
  if (!partial || payload.status !== undefined) {
    next.status = ["draft", "published", "archived"].includes(status) ? status : "draft";
  }

  return Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
};

const sanitizeResourcePayload = (payload = {}, { partial = false } = {}) => {
  const next = {};
  const assign = (key, value) => {
    if (!partial || value !== undefined) next[key] = value;
  };
  assign("title", payload.title === undefined ? undefined : cleanText(payload.title, 180));
  assign(
    "description",
    payload.description === undefined ? undefined : cleanText(payload.description, 1200)
  );
  assign("url", payload.url === undefined ? undefined : cleanText(payload.url, 1000));
  assign(
    "progressLabel",
    payload.progressLabel === undefined ? undefined : cleanText(payload.progressLabel, 60)
  );
  assign(
    "isPublished",
    payload.isPublished === undefined ? undefined : Boolean(payload.isPublished)
  );

  const category = cleanText(payload.category, 40).toLowerCase();
  if (!partial || payload.category !== undefined) {
    next.category = ["technology", "business", "career", "funding", "community", "other"].includes(
      category
    )
      ? category
      : "other";
  }
  const resourceType = cleanText(payload.resourceType, 40).toLowerCase();
  if (!partial || payload.resourceType !== undefined) {
    next.resourceType = ["guide", "course", "template", "report", "link", "video"].includes(
      resourceType
    )
      ? resourceType
      : "guide";
  }
  const accessLevel = cleanText(payload.accessLevel, 40).toLowerCase();
  if (!partial || payload.accessLevel !== undefined) {
    next.accessLevel = ["public", "member", "premium"].includes(accessLevel)
      ? accessLevel
      : "member";
  }

  return Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
};

router.get(
  "/public",
  asyncHandler(async (_req, res) => {
    await ensureDefaults();
    const [events, resources] = await Promise.all([
      KadahiveEvent.find({ status: { $in: ["published", "archived"] } })
        .sort({ featured: -1, startsAt: -1, createdAt: -1 })
        .lean(),
      KadahiveResource.find({ isPublished: true, accessLevel: "public" })
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    return res.json({
      success: true,
      institution: {
        slug: INSTITUTION,
        name: "KADA Hive Innovation & Tech Hub",
        address: "11B Sambo Road, City Centre, Kaduna",
        phone: "+234 806 123 4567",
        email: "info@kadahivehub.com",
      },
      events,
      resources,
    });
  })
);

router.use(auth);

router.post(
  "/membership/join",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select("institutionMemberships role");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const current = membershipFor(user);
    if (current?.status === "suspended") {
      return res.status(403).json({ error: "Your Kadahive membership is suspended" });
    }
    if (!current) {
      user.institutionMemberships.push({
        institution: INSTITUTION,
        role: "member",
        status: "active",
        joinedAt: new Date(),
        updatedAt: new Date(),
      });
      await user.save();
    }
    const access = await resolveAccess(req.user.id);
    return res.status(current ? 200 : 201).json({
      success: true,
      membership: membershipFor(access.user),
      scope: access.scope,
    });
  })
);

router.get(
  "/me",
  requireAccess(["member", "institution_admin", "super_admin"]),
  asyncHandler(async (req, res) => {
    await ensureDefaults();
    const userId = req.kadahiveAccess.user._id;
    const [events, resources, bookings, registrations] = await Promise.all([
      KadahiveEvent.find({ status: { $in: ["published", "archived"] } })
        .sort({ startsAt: -1 })
        .lean(),
      KadahiveResource.find({ isPublished: true }).sort({ createdAt: -1 }).lean(),
      KadahiveBooking.find({ userId }).sort({ startsAt: -1 }).lean(),
      KadahiveEventRegistration.find({ userId, status: { $ne: "cancelled" } })
        .select("eventId status createdAt")
        .lean(),
    ]);

    return res.json({
      success: true,
      scope: req.kadahiveAccess.scope,
      membership: req.kadahiveAccess.membership || {
        institution: INSTITUTION,
        role: "super_admin",
        status: "active",
      },
      user: toMember(req.kadahiveAccess.user),
      events,
      resources,
      bookings,
      registrations,
      stats: {
        upcomingEvents: events.filter(
          (event) => event.status === "published" && new Date(event.startsAt || 0) >= new Date()
        ).length,
        activeBookings: bookings.filter((booking) =>
          ["pending", "approved"].includes(booking.status)
        ).length,
        availableResources: resources.length,
      },
    });
  })
);

router.post(
  "/bookings",
  requireAccess(["member", "institution_admin", "super_admin"]),
  asyncHandler(async (req, res) => {
    const space = cleanText(req.body?.space, 60).toLowerCase();
    const startsAt = parseDate(req.body?.startsAt);
    const durationHours = Math.max(1, Math.min(12, Number(req.body?.durationHours) || 0));
    const attendees = Math.max(1, Math.min(500, Number(req.body?.attendees) || 1));
    const purpose = cleanText(req.body?.purpose, 500);
    if (
      !["coworking-desk", "meeting-room", "training-hall", "event-space"].includes(space) ||
      !startsAt ||
      startsAt.getTime() <= Date.now() ||
      !purpose
    ) {
      return res.status(400).json({ error: "Valid space, future date and purpose are required" });
    }

    const booking = await KadahiveBooking.create({
      userId: req.kadahiveAccess.user._id,
      space,
      startsAt,
      durationHours,
      attendees,
      purpose,
    });
    return res.status(201).json({ success: true, booking });
  })
);

router.post(
  "/events/:eventId/register",
  requireAccess(["member", "institution_admin", "super_admin"]),
  asyncHandler(async (req, res) => {
    if (!validId(req.params.eventId)) {
      return res.status(400).json({ error: "Invalid event id" });
    }
    const event = await KadahiveEvent.findOne({
      _id: req.params.eventId,
      status: "published",
    });
    if (!event) {
      return res.status(404).json({ error: "Registration is not open for this event" });
    }
    if (event.capacity > 0 && event.registrationCount >= event.capacity) {
      return res.status(409).json({ error: "This event is at capacity" });
    }

    const existing = await KadahiveEventRegistration.findOne({
      eventId: event._id,
      userId: req.kadahiveAccess.user._id,
    });
    if (existing?.status !== "cancelled") {
      return res.status(409).json({ error: "You are already registered for this event" });
    }

    let registration = existing;
    if (registration) {
      registration.status = "registered";
      await registration.save();
    } else {
      registration = await KadahiveEventRegistration.create({
        eventId: event._id,
        userId: req.kadahiveAccess.user._id,
      });
    }
    event.registrationCount += 1;
    await event.save();
    return res.status(201).json({ success: true, registration });
  })
);

router.use(requireAccess(["institution_admin", "super_admin"]));

router.get(
  "/admin/overview",
  asyncHandler(async (req, res) => {
    await ensureDefaults();
    const [
      totalMembers,
      activeMembers,
      adminMembers,
      eventCount,
      publishedEvents,
      resourceCount,
      pendingBookings,
      bookings,
      recentMembers,
      events,
      resources,
    ] = await Promise.all([
      User.countDocuments({ "institutionMemberships.institution": INSTITUTION }),
      User.countDocuments({
        institutionMemberships: {
          $elemMatch: { institution: INSTITUTION, status: "active" },
        },
      }),
      User.countDocuments({
        institutionMemberships: {
          $elemMatch: { institution: INSTITUTION, role: "admin", status: "active" },
        },
      }),
      KadahiveEvent.countDocuments({}),
      KadahiveEvent.countDocuments({ status: "published" }),
      KadahiveResource.countDocuments({}),
      KadahiveBooking.countDocuments({ status: "pending" }),
      KadahiveBooking.find({})
        .populate("userId", "name username email phone")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      User.find({ "institutionMemberships.institution": INSTITUTION })
        .select("name username email phone institutionMemberships createdAt lastLoginAt lastLogin")
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      KadahiveEvent.find({}).sort({ startsAt: -1, createdAt: -1 }).lean(),
      KadahiveResource.find({}).sort({ createdAt: -1 }).lean(),
    ]);

    return res.json({
      success: true,
      scope: req.kadahiveAccess.scope,
      stats: {
        totalMembers,
        activeMembers,
        adminMembers,
        eventCount,
        publishedEvents,
        resourceCount,
        pendingBookings,
      },
      recentMembers: recentMembers.map(toMember),
      bookings,
      events,
      resources,
    });
  })
);

router.get(
  "/admin/members",
  asyncHandler(async (req, res) => {
    const search = cleanText(req.query.search, 120);
    const filter = { "institutionMemberships.institution": INSTITUTION };
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: regex }, { username: regex }, { email: regex }];
    }
    const members = await User.find(filter)
      .select("name username email phone institutionMemberships createdAt lastLoginAt lastLogin")
      .sort({ createdAt: -1 })
      .limit(250)
      .lean();
    return res.json({ success: true, members: members.map(toMember) });
  })
);

router.patch(
  "/admin/members/:userId",
  asyncHandler(async (req, res) => {
    if (!validId(req.params.userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const target = await User.findById(req.params.userId).select(
      "name username email phone institutionMemberships createdAt lastLoginAt lastLogin"
    );
    const membership = membershipFor(target);
    if (!target || !membership) {
      return res.status(404).json({ error: "Kadahive member not found" });
    }

    const requestedRole = cleanText(req.body?.role, 30).toLowerCase();
    const requestedStatus = cleanText(req.body?.status, 30).toLowerCase();
    const isGlobalAdmin = req.kadahiveAccess.scope === "super_admin";

    if (requestedRole) {
      if (!isGlobalAdmin) {
        return res.status(403).json({ error: "Only Tengacion super admins can assign Kadahive admins" });
      }
      if (!["member", "admin"].includes(requestedRole)) {
        return res.status(400).json({ error: "Invalid membership role" });
      }
      membership.role = requestedRole;
    }

    if (requestedStatus) {
      if (!["active", "suspended"].includes(requestedStatus)) {
        return res.status(400).json({ error: "Invalid membership status" });
      }
      if (membership.role === "admin" && !isGlobalAdmin) {
        return res.status(403).json({ error: "Only Tengacion super admins can suspend a Kadahive admin" });
      }
      membership.status = requestedStatus;
    }
    membership.updatedAt = new Date();
    await target.save();
    return res.json({ success: true, member: toMember(target) });
  })
);

router.post(
  "/admin/events",
  asyncHandler(async (req, res) => {
    const payload = sanitizeEventPayload(req.body || {});
    if (!payload.title || !payload.summary) {
      return res.status(400).json({ error: "Event title and summary are required" });
    }
    let slug = slugify(req.body?.slug || payload.title);
    if (!slug) slug = `event-${Date.now()}`;
    if (await KadahiveEvent.exists({ slug })) {
      slug = `${slug}-${Date.now().toString().slice(-6)}`;
    }
    const event = await KadahiveEvent.create({
      ...payload,
      slug,
      createdBy: req.kadahiveAccess.user._id,
      updatedBy: req.kadahiveAccess.user._id,
    });
    return res.status(201).json({ success: true, event });
  })
);

router.patch(
  "/admin/events/:eventId",
  asyncHandler(async (req, res) => {
    if (!validId(req.params.eventId)) {
      return res.status(400).json({ error: "Invalid event id" });
    }
    const payload = sanitizeEventPayload(req.body || {}, { partial: true });
    payload.updatedBy = req.kadahiveAccess.user._id;
    const event = await KadahiveEvent.findByIdAndUpdate(req.params.eventId, payload, {
      returnDocument: "after",
      runValidators: true,
    });
    if (!event) return res.status(404).json({ error: "Event not found" });
    return res.json({ success: true, event });
  })
);

router.delete(
  "/admin/events/:eventId",
  asyncHandler(async (req, res) => {
    if (!validId(req.params.eventId)) {
      return res.status(400).json({ error: "Invalid event id" });
    }
    const event = await KadahiveEvent.findByIdAndDelete(req.params.eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });
    await KadahiveEventRegistration.deleteMany({ eventId: event._id });
    return res.json({ success: true });
  })
);

router.post(
  "/admin/resources",
  asyncHandler(async (req, res) => {
    const payload = sanitizeResourcePayload(req.body || {});
    if (!payload.title || !payload.description) {
      return res.status(400).json({ error: "Resource title and description are required" });
    }
    if (payload.url && !/^https?:\/\//i.test(payload.url)) {
      return res.status(400).json({ error: "Resource URL must start with http:// or https://" });
    }
    const resource = await KadahiveResource.create({
      ...payload,
      createdBy: req.kadahiveAccess.user._id,
      updatedBy: req.kadahiveAccess.user._id,
    });
    return res.status(201).json({ success: true, resource });
  })
);

router.patch(
  "/admin/resources/:resourceId",
  asyncHandler(async (req, res) => {
    if (!validId(req.params.resourceId)) {
      return res.status(400).json({ error: "Invalid resource id" });
    }
    const payload = sanitizeResourcePayload(req.body || {}, { partial: true });
    if (payload.url && !/^https?:\/\//i.test(payload.url)) {
      return res.status(400).json({ error: "Resource URL must start with http:// or https://" });
    }
    payload.updatedBy = req.kadahiveAccess.user._id;
    const resource = await KadahiveResource.findByIdAndUpdate(req.params.resourceId, payload, {
      returnDocument: "after",
      runValidators: true,
    });
    if (!resource) return res.status(404).json({ error: "Resource not found" });
    return res.json({ success: true, resource });
  })
);

router.delete(
  "/admin/resources/:resourceId",
  asyncHandler(async (req, res) => {
    if (!validId(req.params.resourceId)) {
      return res.status(400).json({ error: "Invalid resource id" });
    }
    const resource = await KadahiveResource.findByIdAndDelete(req.params.resourceId);
    if (!resource) return res.status(404).json({ error: "Resource not found" });
    return res.json({ success: true });
  })
);

router.patch(
  "/admin/bookings/:bookingId",
  asyncHandler(async (req, res) => {
    if (!validId(req.params.bookingId)) {
      return res.status(400).json({ error: "Invalid booking id" });
    }
    const status = cleanText(req.body?.status, 30).toLowerCase();
    if (!["pending", "approved", "declined", "cancelled", "completed"].includes(status)) {
      return res.status(400).json({ error: "Invalid booking status" });
    }
    const booking = await KadahiveBooking.findByIdAndUpdate(
      req.params.bookingId,
      {
        status,
        adminNote: cleanText(req.body?.adminNote, 500),
        reviewedBy: req.kadahiveAccess.user._id,
        reviewedAt: new Date(),
      },
      { returnDocument: "after", runValidators: true }
    ).populate("userId", "name username email phone");
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    return res.json({ success: true, booking });
  })
);

module.exports = router;
