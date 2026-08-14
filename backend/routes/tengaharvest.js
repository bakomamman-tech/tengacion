const express = require("express");

const TengaHarvestParticipant = require("../models/TengaHarvestParticipant");
const TengaHarvestService = require("../models/TengaHarvestService");
const TengaHarvestBooking = require("../models/TengaHarvestBooking");

const router = express.Router();

const cleanText = (value, max = 200) => String(value || "").trim().slice(0, max);
const cleanArray = (value, maxItems = 12) =>
  Array.isArray(value)
    ? value.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, maxItems)
    : [];

router.get("/services", async (req, res, next) => {
  try {
    const query = { status: "active" };
    if (req.query.type) query.type = cleanText(req.query.type, 40);
    if (req.query.state) query.state = cleanText(req.query.state, 100);
    if (req.query.lga) query.lga = cleanText(req.query.lga, 120);

    const services = await TengaHarvestService.find(query)
      .sort({ createdAt: -1 })
      .limit(60)
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

    if (!["farmer", "provider", "cooperative", "buyer"].includes(role)) {
      return res.status(400).json({ message: "Choose a valid participant type." });
    }
    if (fullName.length < 2 || phone.length < 7) {
      return res.status(400).json({ message: "Full name and a valid phone number are required." });
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
      farmSizeHectares: Number(req.body.farmSizeHectares || 0),
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

    if (!["solar_irrigation", "cold_storage"].includes(type)) {
      return res.status(400).json({ message: "Choose solar irrigation or cold storage." });
    }
    if (!providerName || !title) {
      return res.status(400).json({ message: "Provider name and service title are required." });
    }

    let participant = null;
    if (participantId) {
      participant = await TengaHarvestParticipant.findById(participantId).lean();
      if (!participant || participant.role !== "provider") {
        return res.status(400).json({ message: "A valid provider pilot registration is required." });
      }
    }

    const service = await TengaHarvestService.create({
      providerName,
      participant: participant?._id || null,
      type,
      title,
      description: cleanText(req.body.description, 1200),
      state: cleanText(req.body.state, 100) || "Kaduna",
      lga: cleanText(req.body.lga, 120),
      community: cleanText(req.body.community, 160),
      capacity: Number(req.body.capacity || 0),
      capacityUnit: cleanText(req.body.capacityUnit, 40) || (type === "cold_storage" ? "crates" : "hectares_per_day"),
      pricePerUnitNgn: Number(req.body.pricePerUnitNgn || 0),
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
    const service = await TengaHarvestService.findOne({
      _id: cleanText(req.body.serviceId, 80),
      status: "active",
    }).lean();

    if (!service) {
      return res.status(404).json({ message: "That service is not currently available for booking." });
    }

    const customerName = cleanText(req.body.customerName, 140);
    const phone = cleanText(req.body.phone, 40);
    const units = Number(req.body.units || 0);
    const startDate = new Date(req.body.startDate);

    if (customerName.length < 2 || phone.length < 7 || units <= 0 || Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ message: "Name, phone, quantity and service date are required." });
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
    if (error?.name === "CastError") {
      return res.status(400).json({ message: "Invalid service selection." });
    }
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

module.exports = router;
