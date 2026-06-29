const SchoolTuitionPayment = require("../models/SchoolTuitionPayment");
const { config } = require("../config/env");
const { getPublicSchoolPage } = require("./schoolPageService");
const {
  generatePaymentReference,
  initializeTransaction,
  verifyTransaction,
} = require("./paystackService");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_AMOUNT_NGN = 100;
const MAX_AMOUNT_NGN = 10000000;

const createServiceError = (message, status = 400, details = null) => {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  error.isOperational = true;
  if (details) {
    error.details = details;
  }
  return error;
};

const toText = (value = "", maxLength = 240) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const normalizeEmail = (value = "") => toText(value, 160).toLowerCase();
const normalizeAmount = (value) => Math.round(Number(value) * 100) / 100;
const toIdString = (value) => value?._id?.toString?.() || value?.toString?.() || "";

const buildCallbackUrl = (schoolSlug = "") => {
  const origin = String(config.APP_URL || config.appUrl || "https://tengacion.com").replace(/\/+$/, "");
  const path = schoolSlug === "kurahtechandartsacademy"
    ? `/${schoolSlug}`
    : `/schools/${schoolSlug}`;
  const url = new URL(path, `${origin}/`);
  url.searchParams.set("tuition", "verify");
  return url.toString();
};

const validatePaymentPayload = (payload = {}) => {
  const values = {
    parentName: toText(payload.parentName, 160),
    childName: toText(payload.childName, 160),
    childClass: toText(payload.childClass, 120),
    bankName: toText(payload.bankName, 160),
    email: normalizeEmail(payload.email),
    homeAddress: toText(payload.homeAddress, 500),
    phoneNumber: toText(payload.phoneNumber, 60),
    amount: normalizeAmount(payload.amount),
  };

  const errors = [];
  if (!values.parentName) errors.push("Parent or guardian name is required.");
  if (!values.childName) errors.push("Child name is required.");
  if (!values.childClass) errors.push("Child class is required.");
  if (!values.bankName) errors.push("Bank name is required.");
  if (!EMAIL_PATTERN.test(values.email)) errors.push("A valid email is required.");
  if (!values.homeAddress) errors.push("Home address is required.");
  if (!values.phoneNumber || values.phoneNumber.replace(/\D/g, "").length < 7) {
    errors.push("A valid phone number is required.");
  }
  if (!Number.isFinite(values.amount) || values.amount < MIN_AMOUNT_NGN) {
    errors.push(`Amount must be at least NGN ${MIN_AMOUNT_NGN.toLocaleString()}.`);
  }
  if (Number.isFinite(values.amount) && values.amount > MAX_AMOUNT_NGN) {
    errors.push(`Amount cannot exceed NGN ${MAX_AMOUNT_NGN.toLocaleString()}.`);
  }

  if (errors.length) {
    throw createServiceError("Tuition payment validation failed", 400, errors);
  }

  return values;
};

const serializePublicPayment = (payment = {}) => ({
  reference: payment.reference || "",
  status: payment.status || "pending",
  amount: Number(payment.amount || 0),
  currency: payment.currency || "NGN",
  schoolName: payment.schoolName || "",
  childName: payment.childName || "",
  childClass: payment.childClass || "",
  paidAt: payment.paidAt || null,
  createdAt: payment.createdAt || null,
  updatedAt: payment.updatedAt || null,
});

const serializeAdminPayment = (payment = {}) => {
  const doc = typeof payment.toObject === "function" ? payment.toObject() : payment;
  return {
    _id: toIdString(doc._id),
    schoolSlug: doc.schoolSlug || "",
    schoolName: doc.schoolName || "",
    parentName: doc.parentName || "",
    childName: doc.childName || "",
    childClass: doc.childClass || "",
    bankName: doc.bankName || "",
    email: doc.email || "",
    homeAddress: doc.homeAddress || "",
    phoneNumber: doc.phoneNumber || "",
    amount: Number(doc.amount || 0),
    currency: doc.currency || "NGN",
    provider: doc.provider || "paystack",
    reference: doc.reference || "",
    status: doc.status || "pending",
    gatewayStatus: doc.gatewayStatus || "",
    paymentChannel: doc.paymentChannel || "",
    verifiedBankName: doc.verifiedBankName || "",
    providerTransactionId: doc.providerTransactionId || "",
    failureReason: doc.failureReason || "",
    paidAt: doc.paidAt || null,
    lastVerifiedAt: doc.lastVerifiedAt || null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
};

const initializeSchoolTuitionPayment = async ({ slug = "", payload = {}, req = null } = {}) => {
  const school = await getPublicSchoolPage(slug);
  const values = validatePaymentPayload(payload);
  const reference = generatePaymentReference("school_tuition");
  const currency = String(config.PAYSTACK_CURRENCY || "NGN").trim().toUpperCase() || "NGN";

  const record = await SchoolTuitionPayment.create({
    schoolSlug: school.slug,
    schoolName: school.schoolName,
    ...values,
    currency,
    provider: "paystack",
    reference,
    status: "initiated",
    metadata: {
      ip: toText(req?.ip || req?.headers?.["x-forwarded-for"] || "", 120),
      userAgent: toText(req?.headers?.["user-agent"] || "", 260),
      sourcePath: toText(payload.sourcePath || req?.originalUrl || "", 260),
    },
  });

  try {
    const checkout = await initializeTransaction({
      email: values.email,
      amountNgn: values.amount,
      reference,
      callbackUrl: buildCallbackUrl(school.slug),
      metadata: {
        app: "tengacion",
        paymentType: "school_tuition",
        tuitionPaymentId: toIdString(record._id),
        schoolSlug: school.slug,
        schoolName: school.schoolName,
        childName: values.childName,
        childClass: values.childClass,
      },
    });

    record.status = "pending";
    record.providerAccessCode = checkout.access_code || "";
    record.gatewayStatus = checkout.status || "pending";
    await record.save();

    return {
      success: true,
      authorization_url: checkout.authorization_url,
      checkoutUrl: checkout.authorization_url,
      reference,
      amount: values.amount,
      currency,
      payment: serializePublicPayment(record),
    };
  } catch (error) {
    record.status = "failed";
    record.failureReason = toText(error?.message || "Paystack initialization failed", 500);
    await record.save().catch(() => null);
    throw error;
  }
};

const reconcileSchoolTuitionPayment = async ({ payment = null, reference = "" } = {}) => {
  const record = payment || await SchoolTuitionPayment.findOne({ reference: toText(reference, 180) });
  if (!record) {
    throw createServiceError("Tuition payment not found", 404);
  }

  if (record.status === "paid") {
    return { success: true, verified: true, payment: record };
  }

  const verified = await verifyTransaction(record.reference);
  const expectedAmountKobo = Math.round(Number(record.amount || 0) * 100);
  const verifiedCurrency = String(verified.currency || "").trim().toUpperCase();
  const expectedCurrency = String(record.currency || "NGN").trim().toUpperCase();
  const now = new Date();

  record.lastVerifiedAt = now;
  record.gatewayStatus = verified.status || "pending";
  record.providerTransactionId = toText(verified.raw?.id || verified.id || "", 160);
  record.paymentChannel = toText(verified.raw?.channel || verified.channel || "", 80);
  record.verifiedBankName = toText(
    verified.raw?.authorization?.bank || verified.raw?.bank || "",
    160
  );

  if (verified.reference && verified.reference !== record.reference) {
    record.status = "failed";
    record.failureReason = "Paystack returned a different payment reference.";
  } else if (Number(verified.amountKobo || 0) !== expectedAmountKobo) {
    record.status = "failed";
    record.failureReason = "Paystack amount did not match the tuition payment record.";
  } else if (verifiedCurrency !== expectedCurrency) {
    record.status = "failed";
    record.failureReason = "Paystack currency did not match the tuition payment record.";
  } else if (verified.status === "success") {
    record.status = "paid";
    record.paidAt = new Date(verified.raw?.paid_at || verified.raw?.transaction_date || now);
    record.failureReason = "";
  } else if (verified.status === "failed") {
    record.status = "failed";
    record.failureReason = "Paystack reported that the payment failed.";
  } else if (verified.status === "abandoned") {
    record.status = "abandoned";
  } else {
    record.status = "pending";
  }

  await record.save();
  return {
    success: record.status === "paid",
    verified: record.status === "paid",
    payment: record,
  };
};

const verifySchoolTuitionPayment = async ({ slug = "", reference = "" } = {}) => {
  const normalizedSlug = toText(slug, 120).toLowerCase();
  const normalizedReference = toText(reference, 180);
  const record = await SchoolTuitionPayment.findOne({
    schoolSlug: normalizedSlug,
    reference: normalizedReference,
  });
  if (!record) {
    throw createServiceError("Tuition payment not found", 404);
  }

  const result = await reconcileSchoolTuitionPayment({ payment: record });
  return {
    success: result.success,
    verified: result.verified,
    status: result.payment.status,
    payment: serializePublicPayment(result.payment),
  };
};

const escapeRegex = (value = "") => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const listAdminSchoolTuitionPayments = async ({
  page = 1,
  limit = 20,
  status = "",
  schoolSlug = "",
  childClass = "",
  search = "",
} = {}) => {
  const safePage = Math.max(Number(page || 1), 1);
  const safeLimit = Math.min(Math.max(Number(limit || 20), 1), 100);
  const baseQuery = {};
  const normalizedSchoolSlug = toText(schoolSlug, 120).toLowerCase();
  const normalizedClass = toText(childClass, 120);
  const normalizedSearch = toText(search, 180);
  if (normalizedSchoolSlug) baseQuery.schoolSlug = normalizedSchoolSlug;
  if (normalizedClass) baseQuery.childClass = normalizedClass;
  if (normalizedSearch) {
    const pattern = new RegExp(escapeRegex(normalizedSearch), "i");
    baseQuery.$or = [
      { parentName: pattern },
      { childName: pattern },
      { email: pattern },
      { phoneNumber: pattern },
      { reference: pattern },
    ];
  }

  const query = { ...baseQuery };
  const normalizedStatus = toText(status, 40).toLowerCase();
  if (["initiated", "pending", "paid", "failed", "abandoned"].includes(normalizedStatus)) {
    query.status = normalizedStatus;
  }

  const [payments, total, summaryRows, classes] = await Promise.all([
    SchoolTuitionPayment.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    SchoolTuitionPayment.countDocuments(query),
    SchoolTuitionPayment.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          paidRecords: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
          pendingRecords: {
            $sum: { $cond: [{ $in: ["$status", ["initiated", "pending", "abandoned"]] }, 1, 0] },
          },
          paidAmount: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0] } },
        },
      },
    ]),
    SchoolTuitionPayment.distinct("childClass", normalizedSchoolSlug ? { schoolSlug: normalizedSchoolSlug } : {}),
  ]);

  const summary = summaryRows[0] || {};
  return {
    payments: payments.map(serializeAdminPayment),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.max(1, Math.ceil(total / safeLimit)),
    },
    summary: {
      totalRecords: Number(summary.totalRecords || 0),
      paidRecords: Number(summary.paidRecords || 0),
      pendingRecords: Number(summary.pendingRecords || 0),
      paidAmount: Number(summary.paidAmount || 0),
      currency: "NGN",
    },
    classes: classes.filter(Boolean).sort((a, b) => a.localeCompare(b)),
  };
};

module.exports = {
  initializeSchoolTuitionPayment,
  listAdminSchoolTuitionPayments,
  reconcileSchoolTuitionPayment,
  serializeAdminPayment,
  serializePublicPayment,
  verifySchoolTuitionPayment,
};
