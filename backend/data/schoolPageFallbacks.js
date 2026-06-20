const KURAH_SCHOOL_ID = "665f00000000000000000001";
const KURAH_SCHOOL_SLUG = "kurahtechandartsacademy";

const normalizeSlug = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

const buildKurahSchoolFallback = () => ({
  _id: KURAH_SCHOOL_ID,
  owner: null,
  schoolName: "Kurah Tech and Arts Academy",
  slug: KURAH_SCHOOL_SLUG,
  logoUrl: "",
  coverImageUrl: "/assets/school-profile-hero-fallback.png",
  ogImageUrl: "/assets/school-profile-hero-fallback.png",
  motto: "Where discipline, technology, arts, and character grow together.",
  about:
    "Kurah Tech and Arts Academy is a modern learning community focused on strong academics, digital confidence, creativity, character formation, and parent partnership.",
  mission:
    "To help learners build academic excellence, moral discipline, technology skills, creativity, and confidence through careful teaching and meaningful school life.",
  vision:
    "To raise thoughtful, creative, future-ready learners who can lead with knowledge, character, and service.",
  values: ["Discipline", "Creativity", "Excellence", "Growth", "Service"],
  foundingYear: 2024,
  schoolCategory: "Nursery, Primary and Secondary",
  highlights: [
    {
      label: "Tech-enabled learning",
      description: "ICT exposure and digital literacy are part of the school identity.",
    },
    {
      label: "Creative arts focus",
      description: "Learners are encouraged to explore visual arts, music, and performance.",
    },
    {
      label: "Academic structure",
      description: "Clear routines, class progression, and assessment support steady growth.",
    },
    {
      label: "Character formation",
      description: "Discipline, confidence, respect, and service shape the school culture.",
    },
  ],
  principalMessage:
    "Every child deserves a school environment where learning is serious, creativity is respected, and character is formed daily. We welcome families who want a balanced academic and creative foundation for their children.",
  principalName: "School Proprietor",
  principalTitle: "Principal / Proprietor",
  principalPhotoUrl: "",
  contactEmail: "admissions@kurahtechandartsacademy.edu.ng",
  contactPhone: "+234 800 000 0000",
  whatsappNumber: "+234 800 000 0000",
  address: "Kaduna, Nigeria",
  officeHours: "Monday to Friday, 8:00 AM - 4:00 PM",
  mapUrl: "",
  directionsUrl: "",
  admissionInfo: {
    status: "Admission inquiry open",
    requirements: [
      "Birth certificate or age record",
      "Previous school records where applicable",
      "Recent passport photograph",
      "Parent or guardian contact details",
    ],
    availableClasses: ["Nursery", "Primary", "Junior Secondary", "Senior Secondary"],
    feesNote: "Fee details are shared directly with parents after inquiry.",
    procedure: [
      "Submit admission inquiry",
      "School admission office contacts parent or guardian",
      "Visit, interview, or assessment where required",
      "Admission decision and onboarding",
    ],
  },
  announcements: [
    {
      title: "Admission inquiries are open",
      date: new Date("2026-06-20T00:00:00.000Z"),
      description:
        "Parents can now begin admission conversations through the Tengacion-powered school page.",
      imageUrl: "",
    },
    {
      title: "ICT and creative arts focus",
      date: new Date("2026-06-20T00:00:00.000Z"),
      description:
        "The school profile highlights technology, arts, music, discipline, and academic growth.",
      imageUrl: "",
    },
  ],
  galleryImages: [
    {
      url: "/assets/school-profile-hero-fallback.png",
      alt: "Modern school campus",
      caption: "Learning environment",
    },
  ],
  staffDepartments: [
    {
      department: "Nursery",
      description: "Early learning, language, numeracy, and guided play.",
    },
    {
      department: "Primary",
      description: "Strong literacy, numeracy, science, culture, and character foundation.",
    },
    {
      department: "Junior Secondary",
      description: "Structured academic growth with practical ICT and arts exposure.",
    },
    {
      department: "Senior Secondary",
      description: "Exam readiness, leadership, projects, and career direction.",
    },
    {
      department: "ICT",
      description: "Digital confidence, computer literacy, and creative problem solving.",
    },
    {
      department: "Arts and Music",
      description: "Creative expression, performance, design, and cultural confidence.",
    },
  ],
  facilities: [
    {
      title: "ICT Lab",
      description: "Technology-enabled learning for digital skills and research.",
    },
    {
      title: "Library",
      description: "Reading culture, quiet study, and supervised academic resources.",
    },
    {
      title: "Creative Arts Studio",
      description: "Visual arts, performance, music, and hands-on creativity.",
    },
    {
      title: "Music Room",
      description: "A dedicated space for rhythm, voice, confidence, and performance.",
    },
    {
      title: "Safe Classrooms",
      description: "Organized learning spaces built for focus and supervision.",
    },
    {
      title: "Playground",
      description: "Structured play, movement, and social development.",
    },
  ],
  testimonials: [
    {
      name: "Parent testimonial",
      role: "Parent",
      quote:
        "The school vision gives families confidence: academics, discipline, creativity, and technology are presented as one balanced experience.",
      photoUrl: "",
    },
  ],
  whyChooseUs: [
    {
      label: "Academic discipline",
      description: "A structured learning culture that values preparation, focus, and measurable growth.",
    },
    {
      label: "Creative confidence",
      description: "Students are encouraged to think, make, perform, and communicate with purpose.",
    },
    {
      label: "Future-ready skills",
      description: "ICT, leadership, and practical learning prepare learners for the world ahead.",
    },
    {
      label: "Parent partnership",
      description: "Clear communication helps families stay connected to progress and school life.",
    },
  ],
  statistics: {
    students: 0,
    teachers: 0,
    yearsOfExcellence: 1,
    departments: 6,
  },
  themeColors: {
    primary: "#050505",
    accent: "#f2c94c",
    emphasis: "#c9302c",
    growth: "#1f8f4d",
  },
  isPublished: true,
  createdAt: new Date("2026-06-20T00:00:00.000Z"),
  updatedAt: new Date("2026-06-20T00:00:00.000Z"),
});

const getFallbackSchoolPageBySlug = (slug = "") => {
  const normalized = normalizeSlug(slug);
  if (normalized === KURAH_SCHOOL_SLUG || normalized === "kurahtechandartsacacemy") {
    return buildKurahSchoolFallback();
  }
  return null;
};

const listFallbackSchoolPages = () => [buildKurahSchoolFallback()];

module.exports = {
  KURAH_SCHOOL_SLUG,
  getFallbackSchoolPageBySlug,
  listFallbackSchoolPages,
};
