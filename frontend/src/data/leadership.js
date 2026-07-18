export const LEADERSHIP = [
  {
    id: "stephen-daniel-kurah",
    name: "Stephen Daniel Kurah",
    role: "Founder, Chairman and Chief Executive Officer",
    shortRole: "Founder, Chairman & CEO",
    image: "/assets/leadership/stephen-daniel-kurah.jpg",
    imageAlt: "Stephen Daniel Kurah, Founder, Chairman and Chief Executive Officer of Tengacion",
    bio:
      "Stephen Daniel Kurah founded Tengacion to build African-owned social infrastructure where creators, communities, buyers, and businesses can connect, publish, transact, and grow. He leads Tengacion's product vision, platform strategy, and long-term direction.",
    location: "Kaduna, Nigeria",
    isPlaceholder: false,
  },
];

export const TEAM_LEADS = [
  {
    id: "diana-comfort-danjuma",
    name: "Diana Comfort Danjuma",
    role: "Social Media Lead",
    image: "/assets/leadership/diana-comfort-danjuma.png",
    imageAlt: "Diana Comfort Danjuma, Social Media Lead at Tengacion",
    bio:
      "Diana Comfort Danjuma leads Tengacion's social media publishing, audience engagement, and campaign coordination across the company's social channels.",
  },
  {
    id: "vincent-bilat-danjuma",
    name: "Vincent Bilat Danjuma",
    role: "Customer Support Team Lead",
    image: "/assets/leadership/vincent-bilat-danjuma.png",
    imageAlt: "Vincent Bilat Danjuma, Customer Support Team Lead at Tengacion",
    bio:
      "Vincent Bilat Danjuma leads Tengacion's customer support team, helping customers and creators receive timely assistance and dependable issue resolution.",
  },
  {
    id: "christopher-ebere-chibuzor",
    name: "Christopher Ebere Chibuzor",
    role: "Abuja Creators Support Lead",
    image: "/assets/leadership/christopher-ebere-chibuzor.png",
    imageAlt: "Christopher Ebere Chibuzor, Abuja Creators Support Lead at Tengacion",
    bio:
      "Christopher Ebere Chibuzor leads Tengacion's creator support in Abuja, helping creators receive practical guidance, responsive assistance, and stronger connections to the platform.",
  },
];

export const INTERNS = [
  {
    id: "samuel-h-kaboshia",
    name: "Samuel H. Kaboshia",
    role: "Intern",
    image: "/assets/leadership/samuel-h-kaboshia.png",
    imageAlt: "Samuel H. Kaboshia, Intern at Tengacion",
    bio:
      "Samuel H. Kaboshia supports Tengacion's work while gaining practical experience and contributing to the platform's continued development.",
  },
  {
    id: "tengacion-intern",
    name: "Tengacion Intern",
    role: "Intern (Software Development)",
    image: "/assets/leadership/tengacion-intern.png",
    imageAlt: "Tengacion intern",
    bio:
      "Supporting Tengacion's software development work while gaining practical experience building and improving the platform.",
  },
];

export const FOUNDER = LEADERSHIP[0];
export const HOME_LEADERSHIP = [FOUNDER, ...TEAM_LEADS].slice(0, 4);
