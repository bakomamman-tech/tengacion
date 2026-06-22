const mongoose = require("mongoose");

const boundedText = (maxlength = 240, extra = {}) => ({
  type: String,
  default: "",
  trim: true,
  maxlength,
  ...extra,
});

const imageEntrySchema = new mongoose.Schema(
  {
    url: boundedText(500, { required: true }),
    alt: boundedText(180),
    caption: boundedText(220),
  },
  { _id: false }
);

const announcementSchema = new mongoose.Schema(
  {
    title: boundedText(160, { required: true }),
    date: { type: Date, default: null },
    description: boundedText(700),
    imageUrl: boundedText(500),
    imagePosition: boundedText(40),
  },
  { _id: false }
);

const staffDepartmentSchema = new mongoose.Schema(
  {
    name: boundedText(140),
    role: boundedText(140),
    photoUrl: boundedText(500),
    department: boundedText(120),
    description: boundedText(500),
  },
  { _id: false }
);

const facilitySchema = new mongoose.Schema(
  {
    title: boundedText(140, { required: true }),
    description: boundedText(500),
    imageUrl: boundedText(500),
  },
  { _id: false }
);

const testimonialSchema = new mongoose.Schema(
  {
    name: boundedText(140, { required: true }),
    role: boundedText(120),
    quote: boundedText(700, { required: true }),
    photoUrl: boundedText(500),
  },
  { _id: false }
);

const highlightSchema = new mongoose.Schema(
  {
    label: boundedText(120, { required: true }),
    description: boundedText(360),
  },
  { _id: false }
);

const studentPhotoSchema = new mongoose.Schema(
  {
    name: boundedText(160, { required: true }),
    photoUrl: boundedText(500, { required: true }),
  },
  { _id: false }
);

const classPhotoSchema = new mongoose.Schema(
  {
    className: boundedText(120, { required: true }),
    students: [studentPhotoSchema],
  },
  { _id: false }
);

const admissionInfoSchema = new mongoose.Schema(
  {
    status: boundedText(120),
    requirements: [boundedText(220)],
    availableClasses: [boundedText(120)],
    feesNote: boundedText(360),
    procedure: [boundedText(260)],
  },
  { _id: false }
);

const schoolStatisticsSchema = new mongoose.Schema(
  {
    students: { type: Number, default: 0, min: 0 },
    teachers: { type: Number, default: 0, min: 0 },
    yearsOfExcellence: { type: Number, default: 0, min: 0 },
    departments: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const themeColorsSchema = new mongoose.Schema(
  {
    primary: { type: String, default: "#050505", trim: true, maxlength: 32 },
    accent: { type: String, default: "#f2c94c", trim: true, maxlength: 32 },
    emphasis: { type: String, default: "#c9302c", trim: true, maxlength: 32 },
    growth: { type: String, default: "#1f8f4d", trim: true, maxlength: 32 },
  },
  { _id: false }
);

const SchoolPageSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    schoolName: boundedText(180, { required: true, index: true }),
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
      index: true,
    },
    logoUrl: boundedText(500),
    coverImageUrl: boundedText(500),
    ogImageUrl: boundedText(500),
    motto: boundedText(180),
    about: boundedText(2400),
    mission: boundedText(900),
    vision: boundedText(900),
    values: [boundedText(120)],
    foundingYear: { type: Number, default: 0, min: 0, max: 9999 },
    schoolCategory: boundedText(140),
    highlights: [highlightSchema],
    principalMessage: boundedText(1400),
    principalName: boundedText(140),
    principalTitle: boundedText(120),
    principalPhotoUrl: boundedText(500),
    contactEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    contactPhone: boundedText(60),
    whatsappNumber: boundedText(60),
    address: boundedText(500),
    officeHours: boundedText(180),
    mapUrl: boundedText(600),
    directionsUrl: boundedText(600),
    admissionInfo: {
      type: admissionInfoSchema,
      default: () => ({}),
    },
    announcements: [announcementSchema],
    galleryImages: [imageEntrySchema],
    staffDepartments: [staffDepartmentSchema],
    facilities: [facilitySchema],
    curriculumHighlights: [highlightSchema],
    extracurricularActivities: [highlightSchema],
    classPhotos: [classPhotoSchema],
    testimonials: [testimonialSchema],
    whyChooseUs: [highlightSchema],
    statistics: {
      type: schoolStatisticsSchema,
      default: () => ({}),
    },
    themeColors: {
      type: themeColorsSchema,
      default: () => ({}),
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

SchoolPageSchema.index({
  schoolName: "text",
  slug: "text",
  about: "text",
  address: "text",
});

module.exports = mongoose.model("SchoolPage", SchoolPageSchema);
