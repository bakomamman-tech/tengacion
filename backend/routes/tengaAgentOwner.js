const express = require("express");

const auth = require("../middleware/auth");

const {
  createOrUpdateOwnerWorkspace,
  findOwnerWorkspace,
  listOwnerKnowledge,
  listOwnerLeads,
  setOwnerAgentPublication,
  syncOwnerKnowledge,
  updateOwnerLeadStatus,
} = require("../services/tengaAgent/ownerWorkspaceService");

const {
  listOwnerAppointments,
  rescheduleOwnerAppointment,
  updateOwnerAppointmentStatus,
} = require("../services/tengaAgent/appointmentService");

const router = express.Router();

router.use(auth);
router.use("/", require("./tengaAgentOwnerConfiguration"));
router.use("/", require("./tengaAgentOwnerHandoff"));
router.use("/", require("./tengaAgentOwnerAvailability"));

const serializeWorkspace = (workspace) => ({
  organization: {
    id: workspace.organization._id,
    name: workspace.organization.name,
    slug: workspace.organization.slug,
    website: workspace.organization.website,
    industry: workspace.organization.industry,
    countryCode: workspace.organization.countryCode,
    timezone: workspace.organization.timezone,
    plan: workspace.organization.plan,
    status: workspace.organization.status,
  },
  agent: workspace.agent
    ? {
        id: workspace.agent._id,
        key: workspace.agent.key,
        name: workspace.agent.name,
        role: workspace.agent.role,
        greeting: workspace.agent.greeting,
        tone: workspace.agent.tone,
        languages: workspace.agent.languages,
        systemInstructions:
          workspace.agent.systemInstructions,
        enabledTools: workspace.agent.enabledTools,
        status: workspace.agent.status,
        published:
          workspace.agent.status === "active",
        publicPath:
          `/tengaagent/${workspace.organization.slug}/${workspace.agent.key}`,
      }
    : null,
});

const serializeLead = (lead) => ({
  id: lead._id,
  agentId: lead.agentId,
  conversationId: lead.conversationId,
  name: lead.name,
  email: lead.email,
  phone: lead.phone,
  company: lead.company,
  projectSummary: lead.projectSummary,
  source: lead.source,
  status: lead.status,
  consentToContact: lead.consentToContact,
  createdAt: lead.createdAt,
  lastCapturedAt: lead.lastCapturedAt,
  updatedAt: lead.updatedAt,
});

const serializeAppointment = (appointment) => ({
  id: appointment._id,
  agentId: appointment.agentId,
  conversationId: appointment.conversationId,
  name: appointment.name,
  email: appointment.email,
  phone: appointment.phone,
  company: appointment.company,
  purpose: appointment.purpose,
  notes: appointment.notes,
  preferredStartAt: appointment.preferredStartAt,
  timezone: appointment.timezone,
  durationMinutes: appointment.durationMinutes,
  source: appointment.source,
  status: appointment.status,
  availabilityState:
    appointment.availabilityState || "not_checked",
  availabilitySource:
    appointment.availabilitySource || "request_only",
  availabilityCheckedAt:
    appointment.availabilityCheckedAt || null,
  confirmedAt:
    appointment.confirmedAt || null,
  rescheduledAt:
    appointment.rescheduledAt || null,
  rescheduleCount:
    Number(appointment.rescheduleCount || 0),
  consentToContact: appointment.consentToContact,
  requestedAt: appointment.requestedAt,
  createdAt: appointment.createdAt,
  updatedAt: appointment.updatedAt,
});

router.get("/workspace", async (req, res, next) => {
  try {
    const workspace = await findOwnerWorkspace(
      req.user._id
    );

    if (!workspace) {
      return res.status(404).json({
        ok: false,
        message: "TengaAgent workspace not found.",
      });
    }

    res.set("Cache-Control", "no-store");

    return res.json({
      ok: true,
      ...serializeWorkspace(workspace),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/workspace", async (req, res, next) => {
  try {
    const existing = await findOwnerWorkspace(
      req.user._id
    );

    const workspace = await createOrUpdateOwnerWorkspace({
      userId: req.user._id,
      name: req.body?.name,
      website: req.body?.website,
      industry: req.body?.industry,
      countryCode: req.body?.countryCode,
      timezone: req.body?.timezone,
    });

    res.set("Cache-Control", "no-store");

    return res.status(existing ? 200 : 201).json({
      ok: true,
      created: !existing,
      ...serializeWorkspace(workspace),
    });
  } catch (error) {
    if (/required|country code/i.test(error?.message || "")) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }

    return next(error);
  }
});

router.patch(
  "/agent/publication",
  async (req, res, next) => {
    try {
      if (typeof req.body?.published !== "boolean") {
        return res.status(400).json({
          ok: false,
          message: "published must be true or false.",
        });
      }

      const workspace =
        await setOwnerAgentPublication({
          userId: req.user._id,
          published: req.body.published,
        });

      if (!workspace) {
        return res.status(404).json({
          ok: false,
          message: "TengaAgent workspace not found.",
        });
      }

      res.set("Cache-Control", "no-store");

      return res.json({
        ok: true,
        ...serializeWorkspace(workspace),
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.get("/knowledge", async (req, res, next) => {
  try {
    const result = await listOwnerKnowledge({
      userId: req.user._id,
    });

    if (!result) {
      return res.status(404).json({
        ok: false,
        message: "TengaAgent workspace not found.",
      });
    }

    res.set("Cache-Control", "no-store");

    return res.json({
      ok: true,
      sources: result.sources.map((source) => ({
        id: source._id,
        type: source.type,
        title: source.title,
        sourceUrl: source.sourceUrl,
        status: source.status,
        chunkCount: source.chunkCount,
        updatedAt: source.updatedAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/knowledge", async (req, res, next) => {
  try {
    const result = await syncOwnerKnowledge({
      userId: req.user._id,
      type: req.body?.type,
      title: req.body?.title,
      text: req.body?.text,
    });

    res.set("Cache-Control", "no-store");

    return res.status(201).json({
      ok: true,
      source: {
        id: result.source._id,
        type: result.source.type,
        title: result.source.title,
        sourceUrl: result.source.sourceUrl,
        status: result.source.status,
        chunkCount: result.source.chunkCount,
        updatedAt: result.source.updatedAt,
      },
      chunksCreated: result.chunksCreated,
      unchanged: result.unchanged,
    });
  } catch (error) {
    if (/workspace first|required|unsupported/i.test(error?.message || "")) {
      return res.status(400).json({
        ok: false,
        message: error.message,
      });
    }

    return next(error);
  }
});

router.get("/leads", async (req, res, next) => {
  try {
    const result = await listOwnerLeads({
      userId: req.user._id,
      limit: req.query?.limit,
    });

    if (!result) {
      return res.status(404).json({
        ok: false,
        message: "TengaAgent workspace not found.",
      });
    }

    res.set("Cache-Control", "no-store");

    return res.json({
      ok: true,
      leads: result.leads.map(serializeLead),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch(
  "/leads/:leadId/status",
  async (req, res, next) => {
    try {
      const result = await updateOwnerLeadStatus({
        userId: req.user._id,
        leadId: req.params.leadId,
        status: req.body?.status,
      });

      if (!result) {
        return res.status(404).json({
          ok: false,
          message: "TengaAgent workspace not found.",
        });
      }

      if (!result.lead) {
        return res.status(404).json({
          ok: false,
          message: "TengaAgent lead not found.",
        });
      }

      res.set("Cache-Control", "no-store");

      return res.json({
        ok: true,
        lead: serializeLead(result.lead),
      });
    } catch (error) {
      if (/lead status/i.test(error?.message || "")) {
        return res.status(400).json({
          ok: false,
          message: error.message,
        });
      }

      return next(error);
    }
  }
);

router.get("/appointments", async (req, res, next) => {
  try {
    const result = await listOwnerAppointments({
      userId: req.user._id,
      limit: req.query?.limit,
    });

    if (!result) {
      return res.status(404).json({
        ok: false,
        message: "TengaAgent workspace not found.",
      });
    }

    res.set("Cache-Control", "no-store");

    return res.json({
      ok: true,
      appointments:
        result.appointments.map(
          serializeAppointment
        ),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch(
  "/appointments/:appointmentId/reschedule",
  async (req, res, next) => {
    try {
      const result =
        await rescheduleOwnerAppointment({
          userId: req.user._id,
          appointmentId:
            req.params.appointmentId,
          preferredStartAt:
            req.body?.preferredStartAt,
          timezone: req.body?.timezone,
          durationMinutes:
            req.body?.durationMinutes,
        });

      if (!result.workspaceFound) {
        return res.status(404).json({
          ok: false,
          message: "TengaAgent workspace not found.",
        });
      }

      if (!result.appointment) {
        return res.status(404).json({
          ok: false,
          message: "TengaAgent appointment not found.",
        });
      }

      res.set("Cache-Control", "no-store");

      return res.json({
        ok: true,
        appointment:
          serializeAppointment(
            result.appointment
          ),
      });
    } catch (error) {
      if (
        /appointment|reschedul|future|duration|timezone|available|availability|calendar|booking/i.test(
          error?.message || ""
        )
      ) {
        return res.status(400).json({
          ok: false,
          message: error.message,
        });
      }

      return next(error);
    }
  }
);

router.patch(
  "/appointments/:appointmentId/status",
  async (req, res, next) => {
    try {
      const result =
        await updateOwnerAppointmentStatus({
          userId: req.user._id,
          appointmentId:
            req.params.appointmentId,
          status: req.body?.status,
        });

      if (!result.workspaceFound) {
        return res.status(404).json({
          ok: false,
          message: "TengaAgent workspace not found.",
        });
      }

      if (!result.appointment) {
        return res.status(404).json({
          ok: false,
          message: "TengaAgent appointment not found.",
        });
      }

      res.set("Cache-Control", "no-store");

      return res.json({
        ok: true,
        appointment:
          serializeAppointment(
            result.appointment
          ),
      });
    } catch (error) {
      if (
        /appointment status|cannot move|unsupported appointment|available|availability/i.test(
          error?.message || ""
        )
      ) {
        return res.status(400).json({
          ok: false,
          message: error.message,
        });
      }

      return next(error);
    }
  }
);

module.exports = router;
