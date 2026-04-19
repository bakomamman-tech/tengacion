const { sanitizeMultilineText, sanitizePlainText } = require("../services/assistant/outputSanitizer");
const { isValidPhoneNumber, normalizePhoneNumber } = require("../utils/phone");

const DELIVERY_OPTIONS = ["pickup", "local_delivery", "nationwide_delivery"];
const PRODUCT_CONDITIONS = ["new", "used"];
const CAC_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const toText = (value = "") => String(value ?? "").trim();
const toBoolean = (value) =>
  value === true ||
  value === "true" ||
  value === "on" ||
  value === 1 ||
  value === "1";

const toInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toMoney = (value, fallback = NaN) => {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.round(parsed);
};

const parseList = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  const text = toText(value);
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return text
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
};

const sanitizeState = (value = "") => sanitizePlainText(value, 120);
const sanitizeCity = (value = "") => sanitizePlainText(value, 120);

const normalizeDeliveryOptions = (value) =>
  [...new Set(
    parseList(value)
      .map((entry) => sanitizePlainText(entry, 40).toLowerCase())
      .filter((entry) => DELIVERY_OPTIONS.includes(entry))
  )];

const normalizeCategory = (value = "") => sanitizePlainText(value, 120);

const validateCacFile = (file) => {
  if (!file) {
    return "";
  }

  const mimeType = String(file.mimetype || "").trim().toLowerCase();
  if (!CAC_ALLOWED_MIME_TYPES.has(mimeType)) {
    return "CAC certificate must be a PDF, JPG, PNG, or WEBP file";
  }
  return "";
};

const normalizeSellerPayload = (payload = {}) => ({
  fullName: sanitizePlainText(payload.fullName, 140),
  storeName: sanitizePlainText(payload.storeName, 160),
  phoneNumber: normalizePhoneNumber(payload.phoneNumber),
  bankName: sanitizePlainText(payload.bankName, 120),
  accountNumber: toText(payload.accountNumber).replace(/\D/g, "").slice(0, 30),
  accountName: sanitizePlainText(payload.accountName, 140),
  residentialAddress: sanitizeMultilineText(payload.residentialAddress, 300),
  businessAddress: sanitizeMultilineText(payload.businessAddress, 300),
  state: sanitizeState(payload.state),
  city: sanitizeCity(payload.city),
  acceptedTerms: toBoolean(payload.acceptedTerms),
});

const validateSellerDraftPayload = ({ payload = {}, file = null } = {}) => {
  const normalized = normalizeSellerPayload(payload);
  const errors = [];
  const cacFileError = validateCacFile(file);
  if (cacFileError) {
    errors.push(cacFileError);
  }

  if (normalized.accountNumber && !/^\d{10,20}$/.test(normalized.accountNumber)) {
    errors.push("Account number must contain 10 to 20 digits");
  }

  if (normalized.phoneNumber && !isValidPhoneNumber(normalized.phoneNumber)) {
    errors.push("Enter a valid Nigerian phone number");
  }

  return { errors, value: normalized };
};

const validateSellerSubmissionPayload = ({
  payload = {},
  file = null,
  hasExistingCac = false,
} = {}) => {
  const { errors, value } = validateSellerDraftPayload({ payload, file });

  if (!value.fullName) {
    errors.push("Full name is required");
  }
  if (!value.storeName) {
    errors.push("Store or business name is required");
  }
  if (!value.phoneNumber || !isValidPhoneNumber(value.phoneNumber)) {
    errors.push("A valid phone number is required");
  }
  if (!value.bankName) {
    errors.push("Bank name is required");
  }
  if (!/^\d{10,20}$/.test(value.accountNumber)) {
    errors.push("A valid account number is required");
  }
  if (!value.accountName) {
    errors.push("Account name is required");
  }
  if (!value.residentialAddress) {
    errors.push("Residential address is required");
  }
  if (!value.businessAddress) {
    errors.push("Business address is required");
  }
  if (!value.state) {
    errors.push("State or location is required");
  }
  if (!value.city) {
    errors.push("City is required");
  }
  if (!hasExistingCac && !file) {
    errors.push("CAC certificate upload is required before submission");
  }
  if (!value.acceptedTerms) {
    errors.push("You must accept the marketplace seller terms");
  }

  return { errors, value };
};

const normalizeProductPayload = (payload = {}) => ({
  title: sanitizePlainText(payload.title, 180),
  description: sanitizeMultilineText(payload.description, 6000),
  category: normalizeCategory(payload.category),
  price: toMoney(payload.price),
  stock: Math.max(0, toInteger(payload.stock, 0)),
  condition: sanitizePlainText(payload.condition || "new", 20).toLowerCase() || "new",
  state: sanitizeState(payload.state),
  city: sanitizeCity(payload.city),
  deliveryOptions: normalizeDeliveryOptions(payload.deliveryOptions),
  deliveryNotes: sanitizeMultilineText(payload.deliveryNotes, 400),
  isPublished: toBoolean(payload.isPublished),
});

const validateProductPayload = ({
  payload = {},
  files = [],
  requireImages = false,
  hasExistingImages = false,
} = {}) => {
  const value = normalizeProductPayload(payload);
  const errors = [];

  if (!value.title) {
    errors.push("Product title is required");
  }
  if (!value.description) {
    errors.push("Product description is required");
  }
  if (!value.category) {
    errors.push("Product category is required");
  }
  if (!Number.isFinite(value.price)) {
    errors.push("Product price is required");
  } else if (value.price < 300) {
    errors.push("Product price must be at least NGN 300");
  }
  if (!Number.isFinite(value.stock) || value.stock < 0) {
    errors.push("Stock must be zero or greater");
  }
  if (!PRODUCT_CONDITIONS.includes(value.condition)) {
    errors.push("Product condition must be new or used");
  }
  if (!value.state) {
    errors.push("Product state is required");
  }
  if (!value.city) {
    errors.push("Product city is required");
  }
  if (!value.deliveryOptions.length) {
    errors.push("Choose at least one delivery option");
  }

  const hasImages = Array.isArray(files) && files.length > 0;
  if (requireImages && !hasImages && !hasExistingImages) {
    errors.push("Upload at least one product image");
  }

  return { errors, value };
};

const validateCheckoutPayload = ({
  payload = {},
  product = null,
  seller = null,
} = {}) => {
  const quantity = Math.max(1, toInteger(payload.quantity, 1));
  const deliveryMethod = sanitizePlainText(payload.deliveryMethod, 40).toLowerCase();
  const deliveryAddress = sanitizeMultilineText(payload.deliveryAddress, 320);
  const deliveryContactPhone = normalizePhoneNumber(payload.deliveryContactPhone);
  const errors = [];

  if (!product) {
    errors.push("Marketplace product not found");
  }
  if (product && !product.isPublished) {
    errors.push("This product is not available right now");
  }
  if (product && product.isHidden) {
    errors.push("This product is not available right now");
  }
  if (seller && seller.status !== "approved") {
    errors.push("Only approved sellers can receive marketplace orders");
  }
  if (!DELIVERY_OPTIONS.includes(deliveryMethod)) {
    errors.push("Choose a valid delivery option");
  }
  if (product && !product.deliveryOptions?.includes(deliveryMethod)) {
    errors.push("The selected delivery option is not available for this product");
  }
  if (quantity < 1) {
    errors.push("Quantity must be at least 1");
  }
  if (product && Number(product.stock || 0) < quantity) {
    errors.push("Requested quantity is not in stock");
  }
  if (deliveryMethod !== "pickup" && !deliveryAddress) {
    errors.push("Delivery address is required for delivery orders");
  }
  if (deliveryMethod !== "pickup" && !isValidPhoneNumber(deliveryContactPhone)) {
    errors.push("Delivery contact phone is required for delivery orders");
  }

  return {
    errors,
    value: {
      quantity,
      deliveryMethod,
      deliveryAddress,
      deliveryContactPhone,
    },
  };
};

module.exports = {
  DELIVERY_OPTIONS,
  normalizeDeliveryOptions,
  normalizeProductPayload,
  normalizeSellerPayload,
  parseList,
  validateCheckoutPayload,
  validateProductPayload,
  validateSellerDraftPayload,
  validateSellerSubmissionPayload,
};
