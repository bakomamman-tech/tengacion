const express = require("express");
const mongoose = require("mongoose");

const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const TengaHarvestParticipant = require("../models/TengaHarvestParticipant");
const TengaHarvestService = require("../models/TengaHarvestService");
const TengaHarvestBooking = require("../models/TengaHarvestBooking");

const router = express.Router();
const requireAdmin = requireRole.requireAdmin();

const cleanText = (value, max = 200) => String(value || "").trim().slice(0, max);
const cleanArray = (value, maxItems = 12) =>
  Array.isArray(value)
    ? value.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, maxItems)
    : [];
const cleanNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

router.get("/services", async (req, res, next) => {
  try {
    const query = { status: "active" };
    if (req.query.type) query.type = cleanText(req.query.type, 40);
    if (req.query.state) query.state = cleanText(req.query.state, 100);
    if (req.query.lga) query.lga = cleanText(req.query.lga, 120);

    const services = await TengaHarvestService.find(query)
      .sort({ createdAt: -1 })
      .limit(60)
      .select("providerName type title description state lga community capacity capacityUnit pricePerUnitNgn priceUnitLabel renewableEnergy status createdAt")
      .lean();

    res.set("Cache-Control", "public, max-age=60");
    return res.json({ services });
  } catch (error) {
    return next(error);
  }
});

router.post("/participants", async (req, res, next) => {
  try {
    const role = cleanText(req.body.role, 30);
    const fullName = cleanText(req.body.fullName, 140);
    const phone = cleanText(req.body.phone, 40);
    const farmSizeHectares = cleanNumber(req.body.farmSizeHectares, 0);

    if (!["farmer", "provider", "cooperative", "buyer"].includes(role)) {
      return res.status(400).json({ message: "Choose a valid participant type." });
    }
    if (fullName.length < 2 || phone.length < 7) {
      return res.status(400).json({ message: "Full name and a valid phone number are required." });
    }
    if (farmSizeHectares < 0 || farmSizeHectares > 100000) {
      return res.status(400).json({ message: "Farm size must be between 0 and 100,000 hectares." });
    }

    const participant = await TengaHarvestParticipant.create({
      role,
      fullName,
      phone,
      email: cleanText(req.body.email, 180),
      organizationName: cleanText(req.body.organizationName, 180),
      state: cleanText(req.body.state, 100) || "Kaduna",
      lga: cleanText(req.body.lga, 120),
      community: cleanText(req.body.community, 160),
      farmSizeHectares,
      crops: cleanArray(req.body.crops),
      serviceInterests: cleanArray(req.body.serviceInterests),
      notes: cleanText(req.body.notes, 1000),
    });

    return res.status(201).json({
      message: "Pilot registration received.",
      participant: {
        id: participant._id,
        role: participant.role,
        status: participant.status,
        createdAt: participant.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/provider-services", async (req, res, next) => {
  try {
    const participantId = cleanText(req.body.participantId, 80);
    const providerName = cleanText(req.body.providerName, 180);
    const type = cleanText(req.body.type, 40);
    const title = cleanText(req.body.title, 180);
    const capacity = cleanNumber(req.body.capacity, 0);
    const pricePerUnitNgn = cleanNumber(req.body.pricePerUnitNgn, 0);

    if (!["solar_irrigation", "cold_storage"].includes(type)) {
      return res.status(400).json({ message: "Choose solar irrigation or cold storage." });
    }
    if (!providerName || !title) {
      return res.status(400).json({ message: "Provider name and service title are required." });
    }
    if (!participantId || !isObjectId(participantId)) {
      return res.status(400).json({ message: "Register as a provider before submitting infrastructure." });
    }
    if (capacity < 0 || pricePerUnitNgn < 0) {
      return res.status(400).json({ message: "Capacity and price cannot be negative." });
    }

    const participant = await TengaHarvestParticipant.findById(participantId).lean();
    if (!participant || participant.role !== "provider") {
      return res.status(400).json({ message: "A valid provider pilot registration is required." });
    }

    const service = await TengaHarvestService.create({
      providerName,
      participant: participant._id,
      type,
      title,
      description: cleanText(req.body.description, 1200),
      state: cleanText(req.body.state, 100) || "Kaduna",
      lga: cleanText(req.body.lga, 120),
      community: cleanText(req.body.community, 160),
      capacity,
      capacityUnit:
        cleanText(req.body.capacityUnit, 40) ||
        (type === "cold_storage" ? "crates" : "hectares_per_day"),
      pricePerUnitNgn,
      priceUnitLabel: cleanText(req.body.priceUnitLabel, 80),
      renewableEnergy: req.body.renewableEnergy !== false,
      status: "pending_review",
    });

    return res.status(201).json({
      message: "Service submitted for verification before it appears publicly.",
      service: { id: service._id, status: service.status },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/bookings", async (req, res, next) => {
  try {
    const serviceId = cleanText(req.body.serviceId, 80);
    if (!isObjectId(serviceId)) {
      return res.status(400).json({ message: "Invalid service selection." });
    }

    const service = await TengaHarvestService.findOne({
      _id: serviceId,
      status: "active",
    }).lean();

    if (!service) {
      return res.status(404).json({ message: "That service is not currently available for booking." });
    }

    const customerName = cleanText(req.body.customerName, 140);
    const phone = cleanText(req.body.phone, 40);
    const units = cleanNumber(req.body.units, 0);
    const startDate = new Date(req.body.startDate);

    if (customerName.length < 2 || phone.length < 7 || units <= 0 || Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ message: "Name, phone, quantity and service date are required." });
    }
    if (startDate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
      return res.status(400).json({ message: "Choose a current or future service date." });
    }

    const booking = await TengaHarvestBooking.create({
      service: service._id,
      customerName,
      phone,
      email: cleanText(req.body.email, 180),
      units,
      startDate,
      notes: cleanText(req.body.notes, 1000),
    });

    return res.status(201).json({
      message: "Booking request received. TengaHarvest will confirm availability with the provider.",
      booking: { reference: booking.reference, status: booking.status },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/impact", async (_req, res, next) => {
  try {
    const [farmers, providers, activeServices, completedBookings, farmSize] = await Promise.all([
      TengaHarvestParticipant.countDocuments({ role: "farmer" }),
      TengaHarvestParticipant.countDocuments({ role: "provider" }),
      TengaHarvestService.countDocuments({ status: "active" }),
      TengaHarvestBooking.countDocuments({ status: "completed" }),
      TengaHarvestParticipant.aggregate([
        { $match: { role: "farmer" } },
        { $group: { _id: null, hectares: { $sum: "$farmSizeHectares" } } },
      ]),
    ]);

    res.set("Cache-Control", "public, max-age=120");
    return res.json({
      farmers,
      providers,
      activeServices,
      completedBookings,
      registeredHectares: Number(farmSize?.[0]?.hectares || 0),
      note: "Verified operational and emissions metrics will be added as the Kaduna pilot completes service records.",
    });
  } catch (error) {
    return next(error);
  }
});

router.use("/admin", auth, requireAdmin);

router.get("/admin/overview", async (_req, res, next) => {
  try {
    const [participants, services, bookings] = await Promise.all([
      TengaHarvestParticipant.find({}).sort({ createdAt: -1 }).limit(250).lean(),
      TengaHarvestService.find({})
        .populate("participant", "fullName phone email organizationName state lga community")
        .sort({ createdAt: -1 })
        .limit(250)
        .lean(),
      TengaHarvestBooking.find({})
        .populate("service", "title providerName type state lga community")
        .sort({ createdAt: -1 })
        .limit(250)
        .lean(),
    ]);

    const summary = {
      farmers: participants.filter((item) => item.role === "farmer").length,
      providers: participants.filter((item) => item.role === "provider").length,
      pendingServices: services.filter((item) => item.status === "pending_review").length,
      activeServices: services.filter((item) => item.status === "active").length,
      requestedBookings: bookings.filter((item) => item.status === "requested").length,
      completedBookings: bookings.filter((item) => item.status === "completed").length,
    };

    res.set("Cache-Control", "no-store");
    return res.json({ summary, participants, services, bookings });
  } catch (error) {
    return next(error);
  }
});

router.patch("/admin/participants/:participantId/status", async (req, res, next) => {
  try {
    const participantId = cleanText(req.params.participantId, 80);
    const status = cleanText(req.body.status, 40);
    if (!isObjectId(participantId)) {
      return res.status(400).json({ message: "Invalid participant." });
    }
    if (!["pilot_lead", "contacted", "verified", "active", "paused"].includes(status)) {
      return res.status(400).json({ message: "Choose a valid participant status." });
    }

    const participant = await TengaHarvestParticipant.findByIdAndUpdate(
      participantId,
      { $set: { status } },
      { new: true, runValidators: true }
    ).lean();
    if (!participant) {
      return res.status(404).json({ message: "Participant not found." });
    }
    return res.json({ participant });
  } catch (error) {
    return next(error);
  }
});

router.patch("/admin/services/:serviceId/status", async (req, res, next) => {
  try {
    const serviceId = cleanText(req.params.serviceId, 80);
    const status = cleanText(req.body.status, 40);
    if (!isObjectId(serviceId)) {
      return res.status(400).json({ message: "Invalid service." });
    }
    if (!["pending_review", "active", "paused", "retired"].includes(status)) {
      return res.status(400).json({ message: "Choose a valid service status." });
    }

    const update = {
      status,
      verificationNote: cleanText(req.body.verificationNote, 1000),
      verifiedBy: req.user.id,
      verifiedAt: status === "active" ? new Date() : null,
    };

    const service = await TengaHarvestService.findByIdAndUpdate(
      serviceId,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();
    if (!service) {
      return res.status(404).json({ message: "Service not found." });
    }
    return res.json({ service });
  } catch (error) {
    return next(error);
  }
});

router.patch("/admin/bookings/:bookingId/status", async (req, res, next) => {
  try {
    const bookingId = cleanText(req.params.bookingId, 80);
    const status = cleanText(req.body.status, 40);
    if (!isObjectId(bookingId)) {
      return res.status(400).json({ message: "Invalid booking." });
    }
    if (!["requested", "confirmed", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Choose a valid booking status." });
    }

    const update = {
      status,
      operationsNote: cleanText(req.body.operationsNote, 1000),
      updatedBy: req.user.id,
      confirmedAt: status === "confirmed" || status === "completed" ? new Date() : null,
      completedAt: status === "completed" ? new Date() : null,
      cancelledAt: status === "cancelled" ? new Date() : null,
    };

    const booking = await TengaHarvestBooking.findByIdAndUpdate(
      bookingId,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }
    return res.json({ booking });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
