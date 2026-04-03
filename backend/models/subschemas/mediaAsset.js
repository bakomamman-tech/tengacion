const mongoose = require("mongoose");

const toTrimmedString = (value) => String(value || "").trim();

const createMediaAssetSchema = ({
  includeType = false,
  typeEnum = ["image", "video", "gif", "audio", "raw", "file"],
  defaultType = "image",
  ...extraFields
} = {}) => {
  const definition = {
    assetId: { type: String, default: "", trim: true },
    publicId: { type: String, default: "", trim: true },
    public_id: { type: String, default: "", trim: true },
    url: { type: String, default: "", trim: true },
    secureUrl: { type: String, default: "", trim: true },
    secure_url: { type: String, default: "", trim: true },
    resourceType: { type: String, default: "", trim: true },
    resource_type: { type: String, default: "", trim: true },
    format: { type: String, default: "", trim: true },
    bytes: { type: Number, default: 0, min: 0 },
    width: { type: Number, default: 0, min: 0 },
    height: { type: Number, default: 0, min: 0 },
    duration: { type: Number, default: 0, min: 0 },
    originalFilename: { type: String, default: "", trim: true },
    folder: { type: String, default: "", trim: true },
    provider: { type: String, default: "", trim: true },
    legacyPath: { type: String, default: "", trim: true },
    ...extraFields,
  };

  if (includeType) {
    definition.type = {
      type: String,
      enum: typeEnum,
      default: defaultType,
      trim: true,
    };
  }

  const schema = new mongoose.Schema(definition, { _id: false });

  schema.pre("validate", function syncAliases() {
    this.assetId = toTrimmedString(this.assetId);
    const publicId = toTrimmedString(this.publicId || this.public_id);
    const secureUrl = toTrimmedString(this.secureUrl || this.secure_url || this.url);
    const resourceType = toTrimmedString(this.resourceType || this.resource_type);

    this.publicId = publicId;
    this.public_id = publicId;
    this.url = secureUrl;
    this.secureUrl = secureUrl;
    this.secure_url = secureUrl;
    this.resourceType = resourceType;
    this.resource_type = resourceType;
    this.format = toTrimmedString(this.format);
    this.originalFilename = toTrimmedString(this.originalFilename);
    this.folder = toTrimmedString(this.folder);
    this.provider = toTrimmedString(this.provider).toLowerCase();
    this.legacyPath = toTrimmedString(this.legacyPath);

    if (includeType && !toTrimmedString(this.type)) {
      this.type = defaultType;
    }
  });

  return schema;
};

module.exports = {
  createMediaAssetSchema,
};
