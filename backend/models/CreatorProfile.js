const mongoose = require("mongoose");
const {
  calculateCreatorProfileCompletionScore,
  normalizeBooksProfile,
  normalizeCreatorTypes,
  normalizeGenres,
  normalizeMusicProfile,
  normalizePodcastsProfile,
  normalizeSocialHandles,
} = require("../services/creatorProfileService");

const SocialHandlesSchema = new mongoose.Schema(
  {
    facebook: { type: String, default: "", trim: true, maxlength: 120 },
    instagram: { type: String, default: "", trim: true, maxlength: 120 },
    linkedin: { type: String, default: "", trim: true, maxlength: 120 },
    x: { type: String, default: "", trim: true, maxlength: 120 },
    threads: { type: String, default: "", trim: true, maxlength: 120 },
    youtube: { type: String, default: "", trim: true, maxlength: 120 },
  },
  { _id: false }
);

const MusicProfileSchema = new mongoose.Schema(
  {
    primaryGenre: { type: String, default: "", trim: true, maxlength: 80 },
    recordLabel: { type: String, default: "", trim: true, maxlength: 120 },
    artistBio: { type: String, default: "", maxlength: 2000 },
  },
  { _id: false }
);

const BooksProfileSchema = new mongoose.Schema(
  {
    penName: { type: String, default: "", trim: true, maxlength: 120 },
    primaryGenre: { type: String, default: "", trim: true, maxlength: 80 },
    publisherName: { type: String, default: "", trim: true, maxlength: 120 },
    authorBio: { type: String, default: "", maxlength: 2000 },
  },
  { _id: false }
);

const PodcastsProfileSchema = new mongoose.Schema(
  {
    podcastName: { type: String, default: "", trim: true, maxlength: 120 },
    hostName: { type: String, default: "", trim: true, maxlength: 120 },
    themeOrTopic: { type: String, default: "", trim: true, maxlength: 160 },
    seriesTitle: { type: String, default: "", trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 2000 },
  },
  { _id: false }
);

const CreatorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    fullName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    phoneNumber: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
    accountNumber: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
    country: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    countryOfResidence: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    socialHandles: {
      type: SocialHandlesSchema,
      default: () => ({
        facebook: "",
        instagram: "",
        linkedin: "",
        x: "",
        threads: "",
        youtube: "",
      }),
    },
    musicProfile: {
      type: MusicProfileSchema,
      default: () => ({
        primaryGenre: "",
        recordLabel: "",
        artistBio: "",
      }),
    },
    booksProfile: {
      type: BooksProfileSchema,
      default: () => ({
        penName: "",
        primaryGenre: "",
        publisherName: "",
        authorBio: "",
      }),
    },
    podcastsProfile: {
      type: PodcastsProfileSchema,
      default: () => ({
        podcastName: "",
        hostName: "",
        themeOrTopic: "",
        seriesTitle: "",
        description: "",
      }),
    },
    creatorTypes: {
      type: [
        {
          type: String,
          enum: ["music", "bookPublishing", "podcast"],
          trim: true,
        },
      ],
      default: [],
    },
    acceptedTerms: {
      type: Boolean,
      default: false,
    },
    acceptedCopyrightDeclaration: {
      type: Boolean,
      default: false,
    },
    bio: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    coverImageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    links: [
      {
        label: { type: String, trim: true, maxlength: 60 },
        url: { type: String, trim: true, maxlength: 500 },
      },
    ],
    isCreator: {
      type: Boolean,
      default: true,
      index: true,
    },
    onboardingComplete: {
      type: Boolean,
      default: false,
      index: true,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    profileCompletionScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ["active", "pending_review", "restricted"],
      default: "active",
      index: true,
    },
    heroBannerUrl: {
      type: String,
      default: "",
      trim: true,
    },
    tagline: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    genres: [
      {
        type: String,
        trim: true,
        maxlength: 60,
      },
    ],
    paymentModeDefault: {
      type: String,
      enum: ["NG", "GLOBAL"],
      default: "NG",
    },
    subscriptionPrice: {
      type: Number,
      default: 2000,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

CreatorProfileSchema.pre("validate", function syncCreatorProfile(next) {
  this.fullName = String(this.fullName || this.displayName || "").trim().slice(0, 120);
  this.displayName = String(this.displayName || this.fullName || "").trim().slice(0, 120);
  this.phoneNumber = String(this.phoneNumber || "").trim().slice(0, 40);
  this.accountNumber = String(this.accountNumber || "").trim().slice(0, 40);
  this.country = String(this.country || "").trim().slice(0, 120);
  this.countryOfResidence = String(this.countryOfResidence || this.country || "").trim().slice(0, 120);
  this.socialHandles = normalizeSocialHandles(this.socialHandles);
  this.musicProfile = normalizeMusicProfile(this.musicProfile);
  this.booksProfile = normalizeBooksProfile(this.booksProfile);
  this.podcastsProfile = normalizePodcastsProfile(this.podcastsProfile);
  this.creatorTypes = normalizeCreatorTypes(this.creatorTypes);
  this.genres = normalizeGenres(this.genres);
  this.onboardingCompleted = Boolean(this.onboardingCompleted || this.onboardingComplete);
  this.onboardingComplete = Boolean(this.onboardingCompleted || this.onboardingComplete);
  this.profileCompletionScore = calculateCreatorProfileCompletionScore(this);
  if (!this.status) {
    this.status = "active";
  }
  if (typeof next === "function") {
    next();
  }
});

module.exports = mongoose.model("CreatorProfile", CreatorProfileSchema);
