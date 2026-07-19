const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");

let rateLimit;
try {
  rateLimit = require("express-rate-limit");
} catch {
  rateLimit = () => (_req, _res, next) => next();
}

const AuthService = require("../../apps/api/services/authService");
const auth = require("../middleware/auth");
const moderateUpload = require("../middleware/moderateUpload");
const optionalAuth = require("../middleware/optionalAuth");
const requireRole = require("../middleware/requireRole");
const privateUpload = require("../middleware/privateUpload");
const SummerBootcampRegistration = require("../models/SummerBootcampRegistration");
const { BOOTCAMP_STATUS_VALUES, BOOTCAMP_TRACK_VALUES } = require("../models/SummerBootcampRegistration");
const User = require("../models/User");
const { deleteUploadedMedia, saveUploadedMediaToGridFs } = require("../services/mediaStore");
const {
  deletePrivateBootcampPhoto,
  getPrivateBootcampPhoto,
  openPrivateBootcampPhotoStream,
  savePrivateBootcampPhoto,
} = require("../services/summerBootcampMediaService");
const { clearStepUpCookie, setRefreshCookie } = require("../services/authTokens");
const { isValidPhoneNumber, normalizePhoneNumber } = require("../utils/phone");
const { normalizeMediaValue } = require("../utils/userMedia");

const router = express.Router();

const CAMPAIGN_SLUG = "summer-bootcamp-2026";
const CAMPAIGN_TITLE = "Tengacion Virtual Summer Bootcamp";
const PROGRAMME_START = new Date("2026-08-01T00:00:00.000Z");
const PROGRAMME_END = new Date("2026-08-30T23:59:59.999Z");
const FEE_PER_PARTICIPANT_NGN = 50000;
const NEGOTIABLE_FAMILY_SIZE = 3;
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,30}$/;
const GENDER_VALUES = new Set(["female", "male", "custom", "prefer_not_to_say"]);
const CONTACT_VALUES = new Set(["phone", "whatsapp", "email"]);
const DEVICE_VALUES = new Set(["smartphone", "tablet", "computer", "shared_device", "other"]);
const INTERNET_VALUES = new Set(["reliable", "mostly_reliable", "limited", "needs_support"]);
const SCHEDULE_VALUES = new Set([
  "weekday_morning",
  "weekday_afternoon",
  "weekday_evening",
  "weekend",
  "flexible",
]);
const TRACK_VALUES = new Set(BOOTCAMP_TRACK_VALUES);
const STATUS_VALUES = new Set(BOOTCAMP_STATUS_VALUES);

const submissionLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many bootcamp registration attempts. Please try again later." },
});

const normalizeText = (value = "", maxLength = 1600) =>
  String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);

const normalizeEmail = (value = "") => normalizeText(value, 160).toLowerCase();

const parseJsonPayload = (body = {}) => {
  try {
    const parsed = JSON.parse(String(body?.payload || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return null;
  }
};

const parseDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const calculateAge = (birthDate, today = new Date()) => {
  if (!birthDate) return -1;
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - birthDate.getUTCMonth();
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && today.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
};

const normalizeGender = (value) => {
  const normalized = normalizeText(value, 40).toLowerCase();
  return GENDER_VALUES.has(normalized) ? normalized : "prefer_not_to_say";
};

const normalizeChoice = (value, allowedValues, fallback = "") => {
  const normalized = normalizeText(value, 80).toLowerCase();
  return allowedValues.has(normalized) ? normalized : fallback;
};

const validateApplication = (payload = {}, { accountRequired = true } = {}) => {
  const parentSource = payload?.parent || {};
  const accountSource = payload?.account || {};
  const emergencySource = payload?.emergencyContact || {};
  const householdSource = payload?.household || {};
  const consentSource = payload?.consent || {};
  const parentDob = parseDate(parentSource.dateOfBirth);
  const parentPhone = normalizePhoneNumber(parentSource.phone);
  const parentEmail = normalizeEmail(parentSource.email);
  const username = normalizeText(accountSource.username, 30).toLowerCase();

  const parent = {
    fullName: normalizeText(parentSource.fullName, 140),
    email: parentEmail,
    normalizedEmail: parentEmail,
    phone: parentPhone,
    dateOfBirth: parentDob,
    gender: normalizeGender(parentSource.gender),
    relationshipToStudents: normalizeText(parentSource.relationshipToStudents, 80),
    country: normalizeText(parentSource.country, 120),
    stateOfOrigin: normalizeText(parentSource.stateOfOrigin, 120),
    city: normalizeText(parentSource.city, 120),
    homeAddress: normalizeText(parentSource.homeAddress, 320),
    occupation: normalizeText(parentSource.occupation, 140),
    preferredContactMethod: normalizeChoice(
      parentSource.preferredContactMethod,
      CONTACT_VALUES,
      "whatsapp"
    ),
  };

  const emergencyContact = {
    fullName: normalizeText(emergencySource.fullName, 140),
    phone: normalizeText(emergencySource.phone, 40),
    relationship: normalizeText(emergencySource.relationship, 80),
  };

  const household = {
    learningDevice: normalizeChoice(householdSource.learningDevice, DEVICE_VALUES),
    internetReliability: normalizeChoice(
      householdSource.internetReliability,
      INTERNET_VALUES
    ),
    schedulePreference: normalizeChoice(
      householdSource.schedulePreference,
      SCHEDULE_VALUES
    ),
    goals: normalizeText(householdSource.goals, 1600),
  };

  const studentSources = Array.isArray(payload?.students) ? payload.students : [];
  const students = studentSources
    .slice(0, 3)
    .map((entry) => {
      const dateOfBirth = parseDate(entry?.dateOfBirth);
      const learningTracks = [...new Set(
        (Array.isArray(entry?.learningTracks) ? entry.learningTracks : [])
          .map((track) => normalizeText(track, 60).toLowerCase())
          .filter((track) => TRACK_VALUES.has(track))
      )];
      return {
        studentId: new mongoose.Types.ObjectId(),
        fullName: normalizeText(entry?.fullName, 140),
        preferredName: normalizeText(entry?.preferredName, 80),
        dateOfBirth,
        gender: normalizeGender(entry?.gender),
        currentSchool: normalizeText(entry?.currentSchool, 180),
        classLevel: normalizeText(entry?.classLevel, 100),
        learningTracks,
        learningGoals: normalizeText(entry?.learningGoals, 1200),
        additionalNeeds: normalizeText(entry?.additionalNeeds, 1200),
      };
    });

  const consent = {
    guardianAuthority: consentSource.guardianAuthority === true,
    virtualLearning: consentSource.virtualLearning === true,
    childDataProcessing: consentSource.childDataProcessing === true,
    profilePhotoUse: consentSource.profilePhotoUse === true,
    feeAcknowledged: consentSource.feeAcknowledged === true,
    termsAccepted: consentSource.termsAccepted === true,
    communicationsAccepted: consentSource.communicationsAccepted === true,
    acceptedAt: new Date(),
  };

  const errors = [];
  if (!parent.fullName) errors.push("Parent or guardian full name is required.");
  if (!EMAIL_REGEX.test(parent.email)) errors.push("A valid parent email address is required.");
  if (!parent.phone || !isValidPhoneNumber(parent.phone)) {
    errors.push("Enter the parent's phone number in international format.");
  }
  if (!parent.dateOfBirth || calculateAge(parent.dateOfBirth) < 18) {
    errors.push("The registering parent or guardian must be at least 18 years old.");
  }
  if (!parent.relationshipToStudents) errors.push("Relationship to the students is required.");
  if (!parent.country) errors.push("Country is required.");
  if (!parent.stateOfOrigin) errors.push("State or region is required.");
  if (!parent.city) errors.push("City is required.");
  if (!parent.homeAddress) errors.push("Home address is required.");
  if (!parent.occupation) errors.push("Parent or guardian occupation is required.");
  if (!emergencyContact.fullName || !emergencyContact.relationship) {
    errors.push("Complete the emergency contact details.");
  }
  if (!emergencyContact.phone || emergencyContact.phone.length < 7) {
    errors.push("A reachable emergency contact phone number is required.");
  }
  if (!household.learningDevice) errors.push("Select the learning device available at home.");
  if (!household.internetReliability) errors.push("Select your internet reliability.");
  if (!household.schedulePreference) errors.push("Select a preferred class schedule.");
  if (!household.goals || household.goals.length < 30) {
    errors.push("Tell us what your family hopes to achieve in at least 30 characters.");
  }
  if (studentSources.length < 1 || studentSources.length > 3) {
    errors.push("Register between one and three students.");
  }
  students.forEach((student, index) => {
    const label = `Student ${index + 1}`;
    if (!student.fullName) errors.push(`${label} full name is required.`);
    const age = calculateAge(student.dateOfBirth, PROGRAMME_START);
    if (!student.dateOfBirth || age < 5 || age > 18) {
      errors.push(`${label} must be between 5 and 18 years old.`);
    }
    if (!student.currentSchool) errors.push(`${label} current school is required.`);
    if (!student.classLevel) errors.push(`${label} class or grade is required.`);
    if (student.learningTracks.length < 1) {
      errors.push(`Choose at least one learning track for ${label.toLowerCase()}.`);
    }
    if (!student.learningGoals || student.learningGoals.length < 15) {
      errors.push(`Describe ${label.toLowerCase()}'s learning goals in at least 15 characters.`);
    }
  });
  if (!consent.guardianAuthority) errors.push("Confirm that you are authorized to register the children.");
  if (!consent.virtualLearning) errors.push("Consent to participation in virtual classes is required.");
  if (!consent.childDataProcessing) errors.push("Consent to securely process the children's enrolment data is required.");
  if (!consent.profilePhotoUse) errors.push("Consent to use the parent photo as the Tengacion profile photo is required.");
  if (!consent.feeAcknowledged) {
    errors.push("Confirm the programme dates and ₦50,000 per-participant fee.");
  }
  if (!consent.termsAccepted) errors.push("Accept Tengacion's terms and privacy policy to continue.");

  const account = {
    username,
    password: String(accountSource.password || ""),
  };
  if (accountRequired) {
    if (!USERNAME_REGEX.test(account.username)) {
      errors.push("Choose a 3-30 character username using letters, numbers, dots, or underscores.");
    }
    if (account.password.length < 8) {
      errors.push("Password must be at least 8 characters.");
    }
  }

  return {
    errors,
    values: { account, consent, emergencyContact, household, parent, students },
  };
};

const getFiles = (req, fieldName) =>
  Array.isArray(req.files?.[fieldName]) ? req.files[fieldName].filter(Boolean) : [];

const validatePhotos = ({ parentFiles, studentFiles, studentCount }) => {
  const errors = [];
  if (parentFiles.length !== 1) errors.push("Upload one clear parent or guardian photo.");
  if (studentFiles.length !== studentCount) {
    errors.push("Upload one clear photo for every student being registered.");
  }
  [...parentFiles, ...studentFiles].forEach((file) => {
    if (!String(file?.mimetype || "").toLowerCase().startsWith("image/")) {
      errors.push("Only image files are accepted for registration photos.");
    }
  });
  return errors;
};

const buildReferenceCode = () =>
  `TGSB-2026-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

const photoUrl = (registrationId, fileId) =>
  `/api/summer-bootcamp/applications/${registrationId}/photos/${fileId}`;

const serializeRegistration = (entry = {}) => {
  const id = entry?._id?.toString?.() || "";
  return {
    _id: id,
    campaignSlug: entry?.campaignSlug || CAMPAIGN_SLUG,
    campaignTitle: entry?.campaignTitle || CAMPAIGN_TITLE,
    programme: entry?.programme || {},
    referenceCode: entry?.referenceCode || "",
    parentUserId: entry?.parentUserId?._id?.toString?.() || entry?.parentUserId?.toString?.() || "",
    parent: {
      fullName: entry?.parent?.fullName || "",
      email: entry?.parent?.email || "",
      phone: entry?.parent?.phone || "",
      relationshipToStudents: entry?.parent?.relationshipToStudents || "",
      city: entry?.parent?.city || "",
      stateOfOrigin: entry?.parent?.stateOfOrigin || "",
      country: entry?.parent?.country || "",
      preferredContactMethod: entry?.parent?.preferredContactMethod || "whatsapp",
      photoUrl: entry?.parentPhoto?.fileId ? photoUrl(id, entry.parentPhoto.fileId) : "",
    },
    students: (Array.isArray(entry?.students) ? entry.students : []).map((student) => ({
      studentId: student?.studentId?.toString?.() || "",
      fullName: student?.fullName || "",
      preferredName: student?.preferredName || "",
      dateOfBirth: student?.dateOfBirth || null,
      gender: student?.gender || "prefer_not_to_say",
      currentSchool: student?.currentSchool || "",
      classLevel: student?.classLevel || "",
      learningTracks: Array.isArray(student?.learningTracks) ? student.learningTracks : [],
      learningGoals: student?.learningGoals || "",
      additionalNeeds: student?.additionalNeeds || "",
      photoUrl: student?.photo?.fileId ? photoUrl(id, student.photo.fileId) : "",
    })),
    household: entry?.household || {},
    emergencyContact: entry?.emergencyContact || {},
    status: entry?.status || "submitted",
    createdAt: entry?.createdAt || null,
    updatedAt: entry?.updatedAt || null,
  };
};

router.get("/application", auth, async (req, res) => {
  try {
    const application = await SummerBootcampRegistration.findOne({
      campaignSlug: CAMPAIGN_SLUG,
      parentUserId: req.user.id,
    }).lean();
    return res.json({
      application: application ? serializeRegistration(application) : null,
    });
  } catch (error) {
    console.error("Summer bootcamp application fetch failed:", error);
    return res.status(500).json({ error: "Failed to load the bootcamp registration." });
  }
});

router.post(
  "/register",
  submissionLimiter,
  optionalAuth,
  privateUpload.fields([
    { name: "parentPhoto", maxCount: 1 },
    { name: "studentPhotos", maxCount: 3 },
  ]),
  moderateUpload({
    sourceType: "summer_bootcamp_registration",
    titleFields: ["campaignTitle"],
    descriptionFields: ["payload"],
    deferDecisionResponse: true,
  }),
  async (req, res) => {
    const privatePhotos = [];
    let publicProfilePhoto = null;
    let application = null;
    let createdUserId = "";
    let avatarUpdated = false;
    let previousAvatar = null;

    try {
      const payload = parseJsonPayload(req.body || {});
      if (!payload) {
        return res.status(400).json({ error: "Registration details are not valid JSON." });
      }

      const existingUser = req.user?.id ? await User.findById(req.user.id) : null;
      const { errors, values } = validateApplication(payload, {
        accountRequired: !existingUser,
      });
      const parentFiles = getFiles(req, "parentPhoto");
      const studentFiles = getFiles(req, "studentPhotos");
      errors.push(
        ...validatePhotos({
          parentFiles,
          studentFiles,
          studentCount: values.students.length,
        })
      );

      if (errors.length > 0) {
        return res.status(400).json({ error: errors[0], details: errors });
      }

      if (existingUser && normalizeEmail(existingUser.email) !== values.parent.email) {
        return res.status(400).json({
          error: "Use the email address already linked to your signed-in Tengacion account.",
        });
      }

      if (existingUser) {
        const duplicate = await SummerBootcampRegistration.exists({
          campaignSlug: CAMPAIGN_SLUG,
          parentUserId: existingUser._id,
        });
        if (duplicate) {
          return res.status(409).json({
            error: "A Summer Bootcamp registration already exists for this Tengacion account.",
          });
        }
      } else {
        const [emailExists, usernameExists] = await Promise.all([
          User.exists({ email: values.parent.email }),
          User.exists({ username: values.account.username }),
        ]);
        if (emailExists) {
          return res.status(409).json({
            error: "This email already has a Tengacion account. Log in, then return to register the children.",
          });
        }
        if (usernameExists) {
          return res.status(409).json({ error: "That Tengacion username is already taken." });
        }
      }

      const moderationDecision = req.moderationUpload?.decision || "approve";
      if (moderationDecision === "reject") {
        return res.status(422).json({
          error: "One or more photos could not be accepted under Tengacion's safety rules.",
        });
      }

      const registrationId = new mongoose.Types.ObjectId();
      const ownerHint = existingUser?._id?.toString?.() || values.parent.email;
      const parentPhoto = await savePrivateBootcampPhoto(parentFiles[0], {
        applicationId: registrationId.toString(),
        ownerHint,
        role: "parent",
      });
      privatePhotos.push(parentPhoto);

      const studentsWithPhotos = [];
      for (let index = 0; index < values.students.length; index += 1) {
        const student = values.students[index];
        const storedPhoto = await savePrivateBootcampPhoto(studentFiles[index], {
          applicationId: registrationId.toString(),
          ownerHint,
          role: "student",
          studentId: student.studentId.toString(),
        });
        privatePhotos.push(storedPhoto);
        studentsWithPhotos.push({ ...student, photo: storedPhoto });
      }

      if (moderationDecision === "approve") {
        publicProfilePhoto = normalizeMediaValue(
          await saveUploadedMediaToGridFs(parentFiles[0], {
            source: "summer_bootcamp_parent_avatar",
            metadata: {
              applicationId: registrationId.toString(),
              ownerHint,
            },
          })
        );
      }

      let accountUser = existingUser;
      let authPayload = null;
      if (!accountUser) {
        authPayload = await AuthService.register({
          name: values.parent.fullName,
          username: values.account.username,
          email: values.parent.email,
          password: values.account.password,
          phone: values.parent.phone,
          country: values.parent.country,
          stateOfOrigin: values.parent.stateOfOrigin,
          dob: values.parent.dateOfBirth.toISOString(),
          gender: values.parent.gender,
          reminderContext: {
            io: req.app.get("io"),
            onlineUsers: req.app.get("onlineUsers"),
          },
          sessionMeta: {
            deviceName: "Summer Bootcamp registration",
            ip: req.ip || req.headers["x-forwarded-for"] || "",
            userAgent: req.headers["user-agent"] || "",
            headers: req.headers,
          },
        });
        createdUserId = authPayload?.user?._id || authPayload?.user?.id || "";
        accountUser = await User.findById(createdUserId);
      }

      if (!accountUser) {
        throw new Error("The parent Tengacion account could not be created");
      }
      previousAvatar = accountUser.avatar;

      application = await SummerBootcampRegistration.create({
        _id: registrationId,
        campaignSlug: CAMPAIGN_SLUG,
        campaignTitle: CAMPAIGN_TITLE,
        programme: {
          startsOn: PROGRAMME_START,
          endsOn: PROGRAMME_END,
          feePerParticipantNgn: FEE_PER_PARTICIPANT_NGN,
          standardTotalNgn: FEE_PER_PARTICIPANT_NGN * studentsWithPhotos.length,
          participantCount: studentsWithPhotos.length,
          familyRateNegotiable: studentsWithPhotos.length === NEGOTIABLE_FAMILY_SIZE,
          familyRateNote:
            studentsWithPhotos.length === NEGOTIABLE_FAMILY_SIZE
              ? "A negotiated family rate is available for three registered children."
              : "The standard fee is ₦50,000 per participant.",
        },
        referenceCode: buildReferenceCode(),
        parentUserId: accountUser._id,
        parent: values.parent,
        emergencyContact: values.emergencyContact,
        household: values.household,
        parentPhoto,
        publishedProfilePhoto: publicProfilePhoto || normalizeMediaValue(),
        students: studentsWithPhotos,
        consent: values.consent,
        status: moderationDecision === "quarantine" ? "reviewing" : "submitted",
        photoModeration: {
          decision: moderationDecision,
          labels: Array.isArray(req.moderationUpload?.labels)
            ? req.moderationUpload.labels.slice(0, 12)
            : [],
          reason: normalizeText(req.moderationUpload?.reason, 600),
          confidence: Math.max(0, Math.min(1, Number(req.moderationUpload?.confidence || 0))),
        },
        metadata: {
          ip: normalizeText(req.ip || req.headers["x-forwarded-for"], 180),
          userAgent: normalizeText(req.headers["user-agent"], 400),
          sourcePath: "/summer-bootcamp/register",
        },
      });

      if (publicProfilePhoto?.url) {
        const updated = await User.findByIdAndUpdate(
          accountUser._id,
          {
            $set: {
              avatar: publicProfilePhoto,
              "onboarding.steps.avatar": true,
            },
          },
          { returnDocument: "after", runValidators: true }
        );
        if (!updated) {
          throw new Error("The parent profile photo could not be applied");
        }
        avatarUpdated = true;
      }

      const user = await AuthService.getProfile(accountUser._id);
      if (authPayload?.refreshToken) {
        setRefreshCookie(res, authPayload.refreshToken);
        clearStepUpCookie(res);
      }
      if (avatarUpdated && previousAvatar) {
        deleteUploadedMedia(previousAvatar).catch(() => null);
      }

      return res.status(201).json({
        success: true,
        createdAccount: Boolean(authPayload),
        token: authPayload?.token || "",
        sessionId: authPayload?.sessionId || "",
        user,
        application: serializeRegistration(application),
      });
    } catch (error) {
      if (application?._id) {
        await SummerBootcampRegistration.deleteOne({ _id: application._id }).catch(() => null);
      }
      if (avatarUpdated && !createdUserId && req.user?.id) {
        await User.updateOne(
          { _id: req.user.id },
          { $set: { avatar: previousAvatar || normalizeMediaValue() } }
        ).catch(() => null);
      }
      await Promise.all(
        privatePhotos.map((photo) => deletePrivateBootcampPhoto(photo.fileId).catch(() => null))
      );
      if (publicProfilePhoto) {
        await deleteUploadedMedia(publicProfilePhoto).catch(() => null);
      }
      if (createdUserId) {
        await User.deleteOne({ _id: createdUserId }).catch(() => null);
      }

      if (error?.code === 11000) {
        return res.status(409).json({
          error: "A Summer Bootcamp registration already exists for this account.",
        });
      }
      const statusCode = Number(error?.statusCode || error?.status || 0);
      if (statusCode >= 400 && statusCode < 500) {
        return res.status(statusCode).json({ error: error.message || "Registration could not be completed." });
      }
      console.error("Summer bootcamp registration failed:", error);
      return res.status(500).json({
        error: "The bootcamp registration could not be completed. Please try again.",
      });
    }
  }
);

router.get(
  "/applications",
  auth,
  requireRole(["admin", "super_admin"]),
  async (req, res) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
      const status = normalizeChoice(req.query.status, STATUS_VALUES);
      const search = normalizeText(req.query.search, 120);
      const query = { campaignSlug: CAMPAIGN_SLUG };
      if (status) query.status = status;
      if (search) {
        query.$or = [
          { referenceCode: { $regex: search, $options: "i" } },
          { "parent.fullName": { $regex: search, $options: "i" } },
          { "parent.normalizedEmail": { $regex: search, $options: "i" } },
          { "students.fullName": { $regex: search, $options: "i" } },
        ];
      }
      const [entries, total] = await Promise.all([
        SummerBootcampRegistration.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        SummerBootcampRegistration.countDocuments(query),
      ]);
      return res.json({
        page,
        limit,
        total,
        applications: entries.map(serializeRegistration),
      });
    } catch (error) {
      console.error("Summer bootcamp admin list failed:", error);
      return res.status(500).json({ error: "Failed to load bootcamp registrations." });
    }
  }
);

router.get("/applications/:applicationId/photos/:fileId", auth, async (req, res) => {
  try {
    if (
      !mongoose.Types.ObjectId.isValid(req.params.applicationId) ||
      !mongoose.Types.ObjectId.isValid(req.params.fileId)
    ) {
      return res.status(404).json({ error: "Photo not found" });
    }

    const registration = await SummerBootcampRegistration.findById(req.params.applicationId).lean();
    if (!registration) {
      return res.status(404).json({ error: "Photo not found" });
    }
    const isOwner = String(registration.parentUserId || "") === String(req.user.id || "");
    const isAdmin = ["admin", "super_admin"].includes(String(req.user.role || ""));
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "You do not have access to this registration photo." });
    }

    const allowedPhotoIds = new Set([
      String(registration.parentPhoto?.fileId || ""),
      ...(registration.students || []).map((student) => String(student?.photo?.fileId || "")),
    ]);
    if (!allowedPhotoIds.has(String(req.params.fileId))) {
      return res.status(404).json({ error: "Photo not found" });
    }

    const file = await getPrivateBootcampPhoto(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: "Photo not found" });
    }
    res.setHeader("Content-Type", file.contentType || "image/jpeg");
    res.setHeader("Content-Length", String(file.length || 0));
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Content-Disposition", `inline; filename="${normalizeText(file.filename, 180)}"`);
    const stream = openPrivateBootcampPhotoStream(req.params.fileId);
    stream.on("error", (error) => {
      if (!res.headersSent) {
        res.status(404).end();
      } else {
        res.destroy(error);
      }
    });
    return stream.pipe(res);
  } catch (error) {
    console.error("Summer bootcamp private photo fetch failed:", error);
    return res.status(500).json({ error: "Failed to load the registration photo." });
  }
});

module.exports = router;
