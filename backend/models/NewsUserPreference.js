const mongoose = require("mongoose");

const NewsUserPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    hiddenStoryIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "NewsStory" }],
      default: [],
    },
    hiddenClusterIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "NewsCluster" }],
      default: [],
    },
    hiddenTopicSlugs: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    blockedTopicSlugs: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    followedTopicSlugs: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    followedSourceSlugs: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    mutedSourceSlugs: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    preferredTopics: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    preferredRegions: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    preferredCountries: [{ type: String, trim: true, maxlength: 120 }],
    preferredStates: [{ type: String, trim: true, maxlength: 120 }],
    preferredCities: [{ type: String, trim: true, maxlength: 120 }],
    preferredLanguage: { type: String, default: "en", trim: true, lowercase: true, maxlength: 12 },
    localBoostEnabled: { type: Boolean, default: true },
    worldBoostEnabled: { type: Boolean, default: true },
    personalizationEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

NewsUserPreferenceSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("NewsUserPreference", NewsUserPreferenceSchema);
