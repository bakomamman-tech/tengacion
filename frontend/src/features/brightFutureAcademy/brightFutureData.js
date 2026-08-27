export const CANONICAL_ROOT = "/Bright-Future-Academy";

export const CLASS_GROUPS = [
  { label: "Primary / Basic", values: ["Basic One", "Basic Two", "Basic Three", "Basic Four", "Basic Five", "Basic Six"] },
  { label: "Junior Secondary", values: ["JSS 1", "JSS 2", "JSS 3"] },
  { label: "Senior Secondary", values: ["SSS 1", "SSS 2", "SSS 3"] },
];

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Federal Capital Territory",
  "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers",
  "Sokoto", "Taraba", "Yobe", "Zamfara",
];

export const SUBJECTS = [
  { key: "nigerianEntertainment", name: "Nigerian Music & Movies", mark: "NG", tone: "gold", copy: "Challenging Nigerian music, film, filmmaker and entertainment-awards trivia." },
  { key: "football", name: "UEFA, LaLiga & African Football", mark: "Goal", tone: "green", copy: "European competitions, Spanish football, Nigerian teams and African football history." },
  { key: "technology", name: "Tech, Tengacion.com & Silicon Valley", mark: "Tech", tone: "blue", copy: "Internet foundations, Tengacion creator discovery and Silicon Valley history." },
  { key: "generalEnglish", name: "General English", mark: "Aa", tone: "violet", copy: "Advanced vocabulary, grammar, inference, punctuation and language reasoning." },
  { key: "stem", name: "Mathematics & Science/STEM", mark: "STEM", tone: "green", copy: "Multi-step mathematics, physics, chemistry, biology and scientific reasoning." },
];

export const LEGACY_SUBJECTS = [
  { key: "mathematics", name: "Mathematics", mark: "M", tone: "violet" },
  { key: "english", name: "English Language", mark: "Aa", tone: "blue" },
  { key: "basicScienceTechnology", name: "Basic Science & Technology", mark: "BST", tone: "green" },
  { key: "socialStudies", name: "Social Studies", mark: "SS", tone: "gold" },
];

export const PORTAL_NAV = [
  { key: "dashboard", label: "Overview", path: "/dashboard", icon: "⌂" },
  { key: "profile", label: "My Profile", path: "/profile", icon: "◉" },
  { key: "exam", label: "CBT Examination", path: "/exam/instructions", icon: "✦" },
  { key: "result", label: "My Result", path: "/result", icon: "▥" },
  { key: "subjects", label: "Subjects", path: "/subjects", icon: "◇" },
  { key: "assignments", label: "Assignments", path: "/assignments", icon: "✓" },
  { key: "attendance", label: "Attendance", path: "/attendance", icon: "▦" },
  { key: "announcements", label: "Announcements", path: "/announcements", icon: "◌" },
  { key: "teachers", label: "Teacher Directory", path: "/teachers", icon: "♙" },
  { key: "leaderboard", label: "Leaderboard", path: "/leaderboard", icon: "♛" },
];

export const ANNOUNCEMENTS = [
  { tag: "Competition", title: "National CBT Challenge registration is open", date: "18 August 2026", copy: "Eligible pupils and students from Basic One through SSS 3 can register without an email address." },
  { tag: "Examination", title: "Read the examination rules before starting", date: "18 August 2026", copy: "The challenge contains 50 questions, gives 50 seconds per question and permits one official attempt." },
  { tag: "Results", title: "Provisional results appear after submission", date: "18 August 2026", copy: "Scores and current rank update from verified server records. Final champion status follows publication by the school." },
  { tag: "Academic", title: "Independent reading hour every Wednesday", date: "12 August 2026", copy: "Students are encouraged to read one age-appropriate book and share a short reflection with their class." },
];

export const ASSIGNMENTS = [
  { subject: "Mathematics", title: "Patterns in everyday numbers", due: "28 Aug 2026", status: "In progress", copy: "Find three number patterns at home or in your community and explain the rule behind each." },
  { subject: "English Language", title: "A persuasive paragraph", due: "31 Aug 2026", status: "Not started", copy: "Write 180–250 words explaining one improvement you would make in your community." },
  { subject: "Basic Science & Technology", title: "Simple machines observation", due: "4 Sep 2026", status: "Not started", copy: "Identify four simple machines, sketch them and describe how each reduces effort." },
  { subject: "Social Studies", title: "Responsible citizenship", due: "7 Sep 2026", status: "Not started", copy: "Interview an adult about one civic duty and summarise what you learned." },
];

export const SAMPLE_TEACHERS = [
  { name: "Ms. Ada N.", subject: "Mathematics", qualification: "Sample profile · B.Ed. Mathematics", bio: "Guides learners through visual reasoning and practical problem-solving." },
  { name: "Mr. Tunde K.", subject: "English Language", qualification: "Sample profile · B.A. Education", bio: "Focuses on confident communication, close reading and clear writing." },
  { name: "Ms. Halima S.", subject: "Basic Science & Technology", qualification: "Sample profile · B.Sc. Ed.", bio: "Connects scientific ideas to safe experiments and everyday technology." },
  { name: "Mr. Chinedu O.", subject: "Social Studies", qualification: "Sample profile · B.Ed. Social Studies", bio: "Encourages thoughtful citizenship, cooperation and cultural respect." },
];
