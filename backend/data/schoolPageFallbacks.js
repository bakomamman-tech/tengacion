const KURAH_SCHOOL_ID = "665f00000000000000000001";
const KURAH_SCHOOL_SLUG = "kurahtechandartsacademy";
const KURAH_ASSET_ROOT = "/assets/kurah-academy";

const normalizeSlug = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

const student = (name, fileName) => ({
  name,
  photoUrl: `${KURAH_ASSET_ROOT}/${fileName}`,
});

const buildKurahSchoolFallback = () => ({
  _id: KURAH_SCHOOL_ID,
  owner: null,
  schoolName: "Kurah Tech and Arts Academy",
  slug: KURAH_SCHOOL_SLUG,
  logoUrl: `${KURAH_ASSET_ROOT}/logo.jpg`,
  coverImageUrl: `${KURAH_ASSET_ROOT}/hero.jpg`,
  ogImageUrl: `${KURAH_ASSET_ROOT}/hero.jpg`,
  motto: "Quality, inclusive education through technology, arts, and practical skills.",
  about:
    "Kurah Tech and Arts Academy is an inclusive learning community founded on 7 January 2021 in Narayi, Chikun Local Government Area, Kaduna State. Established by Mr. Stephen Daniel Kurah, the academy combines strong basic education with technology, creative arts, vocational skills, character formation, and support for learners with mild special educational needs.",
  mission:
    "To provide qualitative and equitable education to boys, girls, and learners with special needs, working with families and relevant stakeholders so every learner can develop their potential, moral uprightness, practical skills, and respect for diversity.",
  vision:
    "To provide accessible, quality, and inclusive education irrespective of financial status or physical ability.",
  values: ["Professionalism", "Integrity", "Accountability", "Teamwork", "Equity"],
  foundingYear: 2021,
  schoolCategory: "Inclusive Nursery, Primary and Junior Secondary School",
  highlights: [
    {
      label: "Inclusive education",
      description: "Mainstream learning is supported by thoughtful inclusion for pupils with mild physical, sensory, speech, learning, or other educational support needs.",
    },
    {
      label: "Technology skills",
      description: "Computer appreciation, Java programming, electronics, graphics, photography, and video editing build practical digital confidence.",
    },
    {
      label: "Creative arts",
      description: "Music, theatre, dance, painting, paper art, fashion, and design give learners room to create and perform.",
    },
    {
      label: "Vocational learning",
      description: "Hands-on activities introduce carpentry, shoe design, tie-dye, first aid, and other useful life and career skills.",
    },
  ],
  principalMessage:
    "Education opens opportunities. Our purpose is to help every learner grow in knowledge, character, creativity, and practical ability, so they can participate confidently in society and build productive futures.",
  principalName: "Stephen Daniel Kurah",
  principalTitle: "Founder and Proprietor",
  principalPhotoUrl: `${KURAH_ASSET_ROOT}/stephen-daniel-kurah.jpg`,
  contactEmail: "bakomamman@gmail.com",
  contactPhone: "08061201090",
  whatsappNumber: "08061201090",
  address: "Narayi, Chikun Local Government Area, Kaduna State, Nigeria",
  officeHours: "Monday to Friday, 8:00 AM - 4:00 PM",
  mapUrl: "",
  directionsUrl:
    "https://www.google.com/maps/search/?api=1&query=Narayi%2C%20Kaduna%2C%20Nigeria",
  admissionInfo: {
    status: "Admission inquiries are open",
    requirements: [
      "Birth certificate or age record",
      "Previous school records where applicable",
      "Recent passport photograph",
      "Parent or guardian contact details",
    ],
    availableClasses: ["Nursery 1-3", "Primary 1-6", "Junior Secondary 1-3"],
    feesNote: "Class availability, fees, and learner-support arrangements are confirmed directly by the school.",
    procedure: [
      "Submit an admission inquiry",
      "The admission office contacts the parent or guardian",
      "Visit the school and complete any required learner assessment",
      "Receive the admission decision and onboarding information",
    ],
  },
  announcements: [
    {
      title: "2025 Speech and Prize Day celebration",
      date: new Date("2025-07-26T00:00:00.000Z"),
      description:
        "Learners, staff, and families gathered to recognize academic effort, creativity, growth, and achievement.",
      imageUrl: `${KURAH_ASSET_ROOT}/speech-prize-day-graduates.jpg`,
    },
    {
      title: "Cultural Day celebration",
      date: new Date("2025-07-26T00:00:00.000Z"),
      description:
        "The academy celebrated Nigerian culture through traditional dress, shared learning, and community participation.",
      imageUrl: `${KURAH_ASSET_ROOT}/cultural-day-celebration.jpg`,
    },
    {
      title: "Community learning visit",
      date: new Date("2022-07-04T00:00:00.000Z"),
      description:
        "An Indomie visitation gave pupils another memorable opportunity to learn, participate, and connect beyond daily lessons.",
      imageUrl: `${KURAH_ASSET_ROOT}/community-visitation.jpg`,
      imagePosition: "center 10%",
    },
  ],
  galleryImages: [
    {
      url: `${KURAH_ASSET_ROOT}/speech-prize-day-graduates.jpg`,
      alt: "Kurah Tech and Arts Academy learners at Speech and Prize Day",
      caption: "Speech and Prize Day graduates",
    },
    {
      url: `${KURAH_ASSET_ROOT}/speech-prize-day-stage.jpg`,
      alt: "Learners assembled for the academy Speech and Prize Day",
      caption: "Celebrating learner achievement",
    },
    {
      url: `${KURAH_ASSET_ROOT}/hero.jpg`,
      alt: "Kurah Tech and Arts Academy school community",
      caption: "Our school community",
    },
    {
      url: `${KURAH_ASSET_ROOT}/cultural-day-celebration.jpg`,
      alt: "Kurah Tech and Arts Academy Cultural Day celebration",
      caption: "Cultural Day celebration",
    },
    {
      url: `${KURAH_ASSET_ROOT}/teachers-cultural-day.jpg`,
      alt: "Teachers dressed for Cultural Day",
      caption: "Teachers on Cultural Day",
    },
    {
      url: `${KURAH_ASSET_ROOT}/cultural-day-01.jpg`,
      alt: "Learners and staff in traditional dress",
      caption: "Culture, confidence, and community",
    },
    {
      url: `${KURAH_ASSET_ROOT}/cultural-day-02.jpg`,
      alt: "Pupils wearing traditional Nigerian attire",
      caption: "Celebrating Nigerian heritage",
    },
    {
      url: `${KURAH_ASSET_ROOT}/cultural-day-03.jpg`,
      alt: "Pupils participating in Cultural Day",
      caption: "Learning through culture",
    },
    {
      url: `${KURAH_ASSET_ROOT}/cultural-day-04.jpg`,
      alt: "Young learners in cultural attire",
      caption: "Cultural expression",
    },
    {
      url: `${KURAH_ASSET_ROOT}/cultural-day-05.jpg`,
      alt: "A learner and teacher during Cultural Day",
      caption: "Shared school experiences",
    },
    {
      url: `${KURAH_ASSET_ROOT}/cultural-day-06.jpg`,
      alt: "Learners dressed for the academy Cultural Day",
      caption: "Proud of our heritage",
    },
    {
      url: `${KURAH_ASSET_ROOT}/staff-and-students.jpg`,
      alt: "Kurah Tech and Arts Academy staff and pupils",
      caption: "Staff and pupils",
    },
  ],
  staffDepartments: [
    {
      name: "Stephen Daniel Kurah",
      role: "Founder and Proprietor",
      photoUrl: `${KURAH_ASSET_ROOT}/stephen-daniel-kurah.jpg`,
      department: "School Leadership",
      description: "B.Sc. and PGDE qualified educator leading the academy's inclusive, practical, and creative learning vision.",
    },
    {
      name: "Diana Comfort Danjuma",
      role: "Teacher",
      photoUrl: `${KURAH_ASSET_ROOT}/diana-comfort-danjuma.jpg`,
      department: "Teaching Staff",
      description: "Supporting learners through attentive classroom teaching and school activities.",
    },
    {
      name: "Vincent Bilat Danjuma",
      role: "Teacher",
      photoUrl: `${KURAH_ASSET_ROOT}/vincent-bilat-danjuma.jpg`,
      department: "Teaching Staff",
      description: "Supporting academic learning, practical development, and student participation.",
    },
    {
      name: "Mrs. Gift James",
      role: "Teacher",
      photoUrl: `${KURAH_ASSET_ROOT}/teacher-gift-james.jpg`,
      department: "Teaching Staff",
      description: "Supporting learners through attentive classroom teaching and school activities.",
    },
  ],
  facilities: [
    {
      title: "Inclusive classrooms",
      description: "Structured basic education with attention to different learning and support needs.",
      imageUrl: `${KURAH_ASSET_ROOT}/staff-and-students.jpg`,
    },
    {
      title: "Technology learning",
      description: "Computer appreciation, programming, electronics, graphics, photography, and video skills.",
      imageUrl: `${KURAH_ASSET_ROOT}/speech-prize-day-stage.jpg`,
    },
    {
      title: "Arts and performance",
      description: "Music, theatre, dance, drawing, painting, craft, and cultural expression.",
      imageUrl: `${KURAH_ASSET_ROOT}/teachers-cultural-day.jpg`,
    },
  ],
  curriculumHighlights: [
    {
      label: "Early years foundation",
      description: "Number and reading readiness, phonics, writing, elementary science, health, social habits, rhymes, drawing, and computer learning.",
    },
    {
      label: "Primary academics",
      description: "Mathematics, English, basic science and technology, social studies, civic education, agriculture, health, home economics, and religious knowledge.",
    },
    {
      label: "Reasoning and communication",
      description: "Verbal and quantitative reasoning, writing, reading, and classroom projects strengthen confident thinking and expression.",
    },
    {
      label: "Creative and digital learning",
      description: "Computer studies, cultural and creative arts, drawing, design, and practical projects connect classroom knowledge to real skills.",
    },
  ],
  extracurricularActivities: [
    {
      label: "Computing and programming",
      description: "Computer appreciation, Java programming, graphics design, and practical digital projects.",
    },
    {
      label: "Electrical and media technology",
      description: "Electrical and electronics engineering, cinematography, video editing, and photography.",
    },
    {
      label: "Music and performing arts",
      description: "Music production, theatre, performing arts, and dance develop creative confidence.",
    },
    {
      label: "Fine art and craft",
      description: "Papier-mache, paper art, freehand drawing, painting, printing, and tie-dye.",
    },
    {
      label: "Design and production",
      description: "Fashion design, shoe design and production, and hands-on creative making.",
    },
    {
      label: "Practical vocational skills",
      description: "Carpentry and other guided vocational projects introduce useful tools and productive skills.",
    },
    {
      label: "Health and first aid",
      description: "Age-appropriate biomedical awareness and first-aid learning support responsible action.",
    },
  ],
  classPhotos: [
    {
      className: "Nursery 1",
      students: [
        student("Anastasia Victor", "student-nursery-1-anastasia-victor.jpg"),
        student("Chrystabel Ezekiel", "student-nursery-1-chrystabel-ezekiel.jpg"),
        student("Ellah Sunday", "student-nursery-1-ellah-sunday.jpg"),
        student("Favour James", "student-nursery-1-favour-james.jpg"),
        student("Isaac Emmanuel", "student-nursery-1-isaac-emmanuel.jpg"),
        student("Jaydee Musa", "student-nursery-1-jaydee-musa.jpg"),
        student("Kelvin Lawrence", "student-nursery-1-kelvin-lawrence.jpg"),
        student("Mitchell Solomon", "student-nursery-1-mitchell-solomon.jpg"),
      ],
    },
    {
      className: "Nursery 2",
      students: [
        student("Akam Gideon", "student-nursery-2-akam-gideon.jpg"),
        student("Angel Ephraim", "student-nursery-2-angel-ephraim.jpg"),
        student("Bethel Fumen", "student-nursery-2-bethel-fumen.jpg"),
        student("Beyond Kurah", "student-nursery-2-beyond-kurah.jpg"),
        student("Comfort Levi", "student-nursery-2-comfort-levi.jpg"),
        student("Dideskenan Lepan", "student-nursery-2-dideskenan-lepan.jpg"),
        student("Elizabeth Francis", "student-nursery-2-elizabeth-francis.jpg"),
        student("Israel Maiwa'azi", "student-nursery-2-israel-maiwa-azi.jpg"),
        student("Michael I. Adigwu", "student-nursery-2-michael-i-adigwu.jpg"),
        student("Miracle Ikenna", "student-nursery-2-miracle-ikenna.jpg"),
        student("Nathan Chris", "student-nursery-2-nathan-chris.jpg"),
        student("Onyinye Chukwu", "student-nursery-2-onyinye-chukwu.jpg"),
        student("Samuel Jonathan", "student-nursery-2-samuel-jonathan.jpg"),
      ],
    },
    {
      className: "Nursery 3",
      students: [
        student("Kellah Sunday", "student-nursery-3-kellah-sunday.jpg"),
        student("Olatunji Ezekiel", "student-nursery-3-olatunji-ezekiel.jpg"),
        student("Praise Arinze", "student-nursery-3-praise-arinze.jpg"),
        student("Rachael Samaila", "student-nursery-3-rachael-samaila.jpg"),
        student("Sarah Sunday", "student-nursery-3-sarah-sunday.jpg"),
        student("Shepherd Sunday", "student-nursery-3-shepherd-sunday.jpg"),
        student("Success K. Noah", "student-nursery-3-success-k-noah.jpg"),
        student("Treasure Michael", "student-nursery-3-treasure-michael.jpg"),
      ],
    },
    {
      className: "Primary 1",
      students: [
        student("Divine Abumere", "student-primary-1-divine-abumere.jpg"),
        student("Doosey Agee", "student-primary-1-doosey-agee.jpg"),
        student("Dunamis Edosomwan", "student-primary-1-dunamis-edosomwan.jpg"),
        student("Genius Marshal", "student-primary-1-genius-marshal.jpg"),
        student("Glory Kurah", "student-primary-1-glory-kurah.jpg"),
        student("Israel Ajayi", "student-primary-1-israel-ajayi.jpg"),
        student("Joseph Adigwu", "student-primary-1-joseph-adigwu.jpg"),
        student("Miracle Solomon", "student-primary-1-miracle-solomon.jpg"),
        student("Pascal John", "student-primary-1-pascal-john.jpg"),
      ],
    },
    {
      className: "Primary 2",
      students: [
        student("Ariana Ayuba", "student-primary-2-ariana-ayuba.jpg"),
        student("Doris Chizaram", "student-primary-2-doris-chizaram.jpg"),
        student("Emmanuel Francis", "student-primary-2-emmanuel-francis.jpg"),
        student("Francis Igwe", "student-primary-2-francis-igwe.jpg"),
        student("Jester Austin", "student-primary-2-jester-austin.jpg"),
        student("Joel Benjamin", "student-primary-2-joel-benjamin.jpg"),
        student("Joshua Paul", "student-primary-2-joshua-paul.jpg"),
        student("Salome Sunday", "student-primary-2-salome-sunday.jpg"),
        student("Saviour Anthony", "student-primary-2-saviour-anthony.jpg"),
      ],
    },
    {
      className: "Primary 4",
      students: [
        student("Blessing Jude", "student-primary-4-blessing-jude.jpg"),
        student("Divine Michael", "student-primary-4-divine-michael.jpg"),
        student("Joan Friday", "student-primary-4-joan-friday.jpg"),
        student("Joseph Musa", "student-primary-4-joseph-musa.jpg"),
        student("Joshua Bage", "student-primary-4-joshua-bage.jpg"),
        student("Laraba Iliya", "student-primary-4-laraba-iliya.jpg"),
        student("Lordswill Kurah", "student-primary-4-lordswill-kurah.jpg"),
        student("Miracle Okachie", "student-primary-4-miracle-okachie.jpg"),
        student("Mitchel M. Agee", "student-primary-4-mitchel-m-agee.jpg"),
        student("Precious Micah", "student-primary-4-precious-micah.jpg"),
        student("Winner Arinze", "student-primary-4-winner-arinze.jpg"),
        student("Zanang Augustine", "student-primary-4-zanang-augustine.jpg"),
      ],
    },
    {
      className: "Primary 5",
      students: [
        student("Benedicta Benjamin", "student-primary-5-benedicta-benjamin.jpg"),
        student("Daniel Jonathan", "student-primary-5-daniel-jonathan.jpg"),
        student("Dorcas Z. Sunday", "student-primary-5-dorcas-z-sunday.jpg"),
        student("Emmanuella Chris", "student-primary-5-emmanuella-chris.jpg"),
        student("Evelyn Emmanuel", "student-primary-5-evelyn-emmanuel.jpg"),
        student("Faith G. Renner", "student-primary-5-faith-g-renner.jpg"),
        student("Joshua G. Shimfo", "student-primary-5-joshua-g-shimfo.jpg"),
        student("Lucky Bello", "student-primary-5-lucky-bello.jpg"),
        student("Sapphire Bulus", "student-primary-5-sapphire-bulus.jpg"),
        student("Stephenie Lawrence", "student-primary-5-stephenie-lawrence.jpg"),
        student("Success S. Samuel", "student-primary-5-success-s-samuel.jpg"),
        student("Victory Sunday", "student-primary-5-victory-sunday.jpg"),
        student("Emmanuella Ajayi", "student-primary-5-emmanuella-ajayi.jpg"),
      ],
    },
    {
      className: "Primary 6",
      students: [
        student("Amazing Grace Abumere", "student-primary-6-amazing-grace-abumere.jpg"),
        student("Blessed Shogo", "student-primary-6-blessed-shogo.jpg"),
        student("Chrystabel Marshal", "student-primary-6-chrystabel-marshal.jpg"),
        student("Chrystabel W. Gwan", "student-primary-6-chrystabel-w-gwan.jpg"),
        student("Esther Titus", "student-primary-6-esther-titus.jpg"),
        student("Isaac Ajayi", "student-primary-6-isaac-ajayi.jpg"),
        student("Japhet Bage", "student-primary-6-japhet-bage.jpg"),
        student("Jesse O. Benjamin", "student-primary-6-jesse-o-benjamin.jpg"),
        student("Victor Kazah", "student-primary-6-victor-kazah.jpg"),
        student("Victor Okachie", "student-primary-6-victor-okachie.jpg"),
      ],
    },
    {
      className: "JSS 1",
      students: [
        student("Joseph Adewale", "student-jss-1-joseph-adewale.jpg"),
        student("Stephen Agama David", "student-jss-1-stephen-agama-david.jpg"),
      ],
    },
    {
      className: "JSS 2",
      students: [
        student("Chinedu John", "student-jss-2-chinedu-john.jpg"),
        student("Dominion Thomas", "student-jss-2-dominion-thomas.jpg"),
        student("Edison George", "student-jss-2-edison-george.jpg"),
        student("Elijah O. Ajayi", "student-jss-2-elijah-o-ajayi.jpg"),
        student("Grace James", "student-jss-2-grace-james.jpg"),
        student("Joshua G. Renner", "student-jss-2-joshua-g-renner.jpg"),
        student("Nelson Marshal", "student-jss-2-nelson-marshal.jpg"),
        student("Nene Aliyu Eleb", "student-jss-2-nene-aliyu-eleb.jpg"),
        student("Salim Musa", "student-jss-2-salim-musa.jpg"),
        student("Veronica D. Adah", "student-jss-2-veronica-d-adah.jpg"),
      ],
    },
    {
      className: "JSS 3",
      students: [
        student("Daniel G. Renner", "student-jss-3-daniel-g-renner.jpg"),
        student("Emmanuel David", "student-jss-3-emmanuel-david.jpg"),
        student("Ezekiel Raphael", "student-jss-3-ezekiel-raphael.jpg"),
        student("Kuyet F. Didam", "student-jss-3-kuyet-f-didam.jpg"),
        student("Naomi O. Benjamin", "student-jss-3-naomi-o-benjamin.jpg"),
        student("Onyinye Eneh", "student-jss-3-onyinye-eneh.jpg"),
        student("Peter A. Onoja", "student-jss-3-peter-a-onoja.jpg"),
      ],
    },
  ],
  testimonials: [],
  whyChooseUs: [
    {
      label: "Inclusive access",
      description: "The academy was founded to make quality education more accessible across financial circumstances and physical ability.",
    },
    {
      label: "Qualified educators",
      description: "Teaching staff bring NCE, B.Ed, B.Sc, and PGDE backgrounds to classroom and learner support.",
    },
    {
      label: "Whole-child development",
      description: "Academics, moral formation, social growth, technology, arts, and practical skills are developed together.",
    },
    {
      label: "Future-ready skills",
      description: "Digital, vocational, creative, and communication experiences help learners see productive possibilities for their future.",
    },
  ],
  statistics: {
    students: 104,
    teachers: 12,
    yearsOfExcellence: 5,
    departments: 6,
  },
  themeColors: {
    primary: "#071d12",
    accent: "#f4ca3a",
    emphasis: "#d92966",
    growth: "#258a45",
  },
  isPublished: true,
  createdAt: new Date("2021-01-07T00:00:00.000Z"),
  updatedAt: new Date("2026-07-07T00:00:00.000Z"),
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
