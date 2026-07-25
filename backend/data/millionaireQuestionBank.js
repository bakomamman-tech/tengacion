const STAGES = Object.freeze([
  {
    number: 1,
    name: "The Spark",
    subtitle: "Build momentum",
    difficulty: "Foundation",
    timeLimitSeconds: 45,
  },
  {
    number: 2,
    name: "The Climb",
    subtitle: "Connect the ideas",
    difficulty: "Advanced",
    timeLimitSeconds: 35,
  },
  {
    number: 3,
    name: "The Summit",
    subtitle: "Think like a champion",
    difficulty: "Master",
    timeLimitSeconds: 30,
  },
]);

const PRIZE_LADDER = Object.freeze([
  100,
  150,
  200,
  300,
  500,
  650,
  800,
  1_000,
  1_250,
  1_500,
  1_800,
  2_200,
  3_000,
  4_000,
  5_000,
]);

const QUESTIONS = Object.freeze([
  {
    id: "spark-math-percent-01",
    stage: 1,
    category: "Mathematics",
    prompt: "What is 15% of 200?",
    options: ["15", "20", "30", "35"],
    correctIndex: 2,
    explanation: "Ten percent is 20 and five percent is 10, so fifteen percent is 30.",
  },
  {
    id: "spark-biology-organ-01",
    stage: 1,
    category: "Biology",
    prompt: "Which organ pumps blood around the human body?",
    options: ["Liver", "Heart", "Lung", "Kidney"],
    correctIndex: 1,
    explanation: "The heart contracts rhythmically to circulate blood through the body.",
  },
  {
    id: "spark-geography-ocean-01",
    stage: 1,
    category: "Geography",
    prompt: "Which is the largest ocean on Earth?",
    options: ["Atlantic Ocean", "Indian Ocean", "Pacific Ocean", "Arctic Ocean"],
    correctIndex: 2,
    explanation: "The Pacific Ocean is the world's largest and deepest ocean basin.",
  },
  {
    id: "spark-language-synonym-01",
    stage: 1,
    category: "Language",
    prompt: "Which word is closest in meaning to “brief”?",
    options: ["Lengthy", "Short", "Hidden", "Noisy"],
    correctIndex: 1,
    explanation: "When brief describes duration or length, it means short.",
  },
  {
    id: "spark-computing-cpu-01",
    stage: 1,
    category: "Computing",
    prompt: "What does CPU stand for in computing?",
    options: [
      "Central Processing Unit",
      "Computer Personal Utility",
      "Core Program Upload",
      "Central Power User",
    ],
    correctIndex: 0,
    explanation: "CPU is short for Central Processing Unit, which executes computer instructions.",
  },
  {
    id: "spark-chemistry-water-01",
    stage: 1,
    category: "Chemistry",
    prompt: "What is the chemical formula for water?",
    options: ["CO₂", "O₂", "H₂O", "NaCl"],
    correctIndex: 2,
    explanation: "A water molecule contains two hydrogen atoms and one oxygen atom.",
  },
  {
    id: "spark-civics-government-01",
    stage: 1,
    category: "Civics",
    prompt: "Which arm of government primarily interprets laws?",
    options: ["Executive", "Judiciary", "Legislature", "Civil service"],
    correctIndex: 1,
    explanation: "Courts in the judiciary interpret laws and apply them to cases.",
  },
  {
    id: "spark-music-tempo-01",
    stage: 1,
    category: "Music",
    prompt: "In music, what does tempo describe?",
    options: ["The speed of the music", "The lyrics", "The instrument's age", "The audience size"],
    correctIndex: 0,
    explanation: "Tempo is the speed or pace at which a piece of music is performed.",
  },
  {
    id: "spark-economics-scarcity-01",
    stage: 1,
    category: "Economics",
    prompt: "What basic economic problem exists because wants exceed available resources?",
    options: ["Inflation", "Scarcity", "Taxation", "Specialisation"],
    correctIndex: 1,
    explanation: "Scarcity means limited resources must be allocated among competing wants.",
  },
  {
    id: "spark-agriculture-germination-01",
    stage: 1,
    category: "Agriculture",
    prompt: "Which three things do most seeds need to begin germination?",
    options: [
      "Water, oxygen and suitable warmth",
      "Salt, darkness and wind",
      "Fertiliser, sunlight and frost",
      "Clay, carbon dioxide and cold",
    ],
    correctIndex: 0,
    explanation: "Most seeds begin germinating when moisture, oxygen and a suitable temperature are present.",
  },
  {
    id: "climb-physics-acceleration-01",
    stage: 2,
    category: "Physics",
    prompt: "A car changes velocity from 10 m/s to 30 m/s in 5 seconds. What is its average acceleration?",
    options: ["2 m/s²", "4 m/s²", "6 m/s²", "8 m/s²"],
    correctIndex: 1,
    explanation: "Acceleration is change in velocity divided by time: (30 − 10) ÷ 5 = 4 m/s².",
  },
  {
    id: "climb-history-berlin-01",
    stage: 2,
    category: "African History",
    prompt: "The Berlin Conference of 1884–1885 is most closely associated with what?",
    options: [
      "The abolition of all European monarchies",
      "Rules for European colonisation and trade in Africa",
      "The creation of the African Union",
      "The end of the First World War",
    ],
    correctIndex: 1,
    explanation: "European powers used the conference to set rules for claims and trade during the partition of Africa.",
  },
  {
    id: "climb-astronomy-lightyear-01",
    stage: 2,
    category: "Astronomy",
    prompt: "A light-year is a unit of what?",
    options: ["Time", "Brightness", "Distance", "Mass"],
    correctIndex: 2,
    explanation: "A light-year is the distance light travels through a vacuum in one year.",
  },
  {
    id: "climb-law-habeas-01",
    stage: 2,
    category: "Law",
    prompt: "What protection is associated with habeas corpus?",
    options: [
      "Protection against unlawful detention",
      "Automatic ownership of land",
      "Freedom from all taxation",
      "The right to ignore a court order",
    ],
    correctIndex: 0,
    explanation: "Habeas corpus allows a court to examine whether a person's detention is lawful.",
  },
  {
    id: "climb-statistics-median-01",
    stage: 2,
    category: "Statistics",
    prompt: "What is the median of 3, 7, 8, 12 and 20?",
    options: ["7", "8", "10", "12"],
    correctIndex: 1,
    explanation: "With five ordered values, the median is the middle value: 8.",
  },
  {
    id: "climb-visualart-chiaroscuro-01",
    stage: 2,
    category: "Visual Art",
    prompt: "In visual art, chiaroscuro refers to the strong contrast between what?",
    options: ["Warm and cool sounds", "Light and shadow", "Clay and stone", "Past and future"],
    correctIndex: 1,
    explanation: "Chiaroscuro models form and drama through contrasts of light and dark.",
  },
  {
    id: "climb-medicine-insulin-01",
    stage: 2,
    category: "Medicine",
    prompt: "Which organ produces insulin in the human body?",
    options: ["Pancreas", "Spleen", "Thyroid", "Gallbladder"],
    correctIndex: 0,
    explanation: "Beta cells in the pancreas produce insulin to help regulate blood glucose.",
  },
  {
    id: "climb-ecology-foodweb-01",
    stage: 2,
    category: "Ecology",
    prompt: "What best distinguishes a food web from a food chain?",
    options: [
      "It shows several interconnected feeding relationships",
      "It includes plants but never animals",
      "It measures only the mass of organisms",
      "It applies only to oceans",
    ],
    correctIndex: 0,
    explanation: "A food web links many food chains and shows multiple feeding relationships in an ecosystem.",
  },
  {
    id: "climb-finance-compound-01",
    stage: 2,
    category: "Finance",
    prompt: "What makes compound interest different from simple interest?",
    options: [
      "It is charged only once",
      "It is calculated on principal plus accumulated interest",
      "It can never increase a balance",
      "It applies only to coins and notes",
    ],
    correctIndex: 1,
    explanation: "Compound interest is calculated on both the original principal and interest already added.",
  },
  {
    id: "climb-linguistics-morpheme-01",
    stage: 2,
    category: "Linguistics",
    prompt: "What is a morpheme?",
    options: [
      "The smallest meaningful unit in a language",
      "Any sentence longer than ten words",
      "A mark used only in music",
      "The loudest sound in a word",
    ],
    correctIndex: 0,
    explanation: "A morpheme is the smallest linguistic unit that carries meaning or a grammatical function.",
  },
  {
    id: "summit-math-euler-01",
    stage: 3,
    category: "Mathematics",
    prompt: "In Euler's identity, e^(iπ) + 1 equals what?",
    options: ["−1", "0", "1", "π"],
    correctIndex: 1,
    explanation: "Euler's identity is e^(iπ) + 1 = 0.",
  },
  {
    id: "summit-computing-binarysearch-01",
    stage: 3,
    category: "Computer Science",
    prompt: "What is the usual worst-case time complexity of binary search on a sorted array?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
    correctIndex: 1,
    explanation: "Binary search halves the remaining search space at each step, giving O(log n).",
  },
  {
    id: "summit-genetics-codon-01",
    stage: 3,
    category: "Genetics",
    prompt: "How many nucleotide bases make up one codon in messenger RNA?",
    options: ["Two", "Three", "Four", "Six"],
    correctIndex: 1,
    explanation: "Each codon is a sequence of three RNA nucleotide bases.",
  },
  {
    id: "summit-philosophy-kant-01",
    stage: 3,
    category: "Philosophy",
    prompt: "The “categorical imperative” is most strongly associated with which philosopher?",
    options: ["Aristotle", "Immanuel Kant", "John Locke", "Friedrich Nietzsche"],
    correctIndex: 1,
    explanation: "Immanuel Kant developed the categorical imperative in his moral philosophy.",
  },
  {
    id: "summit-epidemiology-r0-01",
    stage: 3,
    category: "Epidemiology",
    prompt: "In epidemiology, what does the basic reproduction number R₀ estimate?",
    options: [
      "The average secondary cases caused by one case in a fully susceptible population",
      "The exact number of hospital beds required",
      "The percentage of a medicine absorbed by the body",
      "The age of the first identified patient",
    ],
    correctIndex: 0,
    explanation: "R₀ estimates how many secondary cases one typical case generates when the population is susceptible.",
  },
  {
    id: "summit-history-westphalia-01",
    stage: 3,
    category: "World History",
    prompt: "The Peace of Westphalia in 1648 ended which major European conflict?",
    options: ["The Hundred Years' War", "The Thirty Years' War", "The Crimean War", "The Seven Years' War"],
    correctIndex: 1,
    explanation: "The Westphalian treaties ended the Thirty Years' War in the Holy Roman Empire.",
  },
  {
    id: "summit-engineering-feedback-01",
    stage: 3,
    category: "Engineering",
    prompt: "In a control system, what is the usual purpose of negative feedback?",
    options: [
      "To increase deviation from the target",
      "To reduce error and stabilise the system",
      "To remove every sensor",
      "To guarantee unlimited energy",
    ],
    correctIndex: 1,
    explanation: "Negative feedback compares output with a target and acts to reduce the difference.",
  },
  {
    id: "summit-literature-soliloquy-01",
    stage: 3,
    category: "Literature",
    prompt: "What is a soliloquy in drama?",
    options: [
      "A speech revealing a character's thoughts while alone or unheard",
      "A comic dance performed by the audience",
      "A list of all stage equipment",
      "A conversation written only in rhyme",
    ],
    correctIndex: 0,
    explanation: "A soliloquy lets a character voice private thoughts directly to the audience.",
  },
  {
    id: "summit-economics-elasticity-01",
    stage: 3,
    category: "Economics",
    prompt: "Demand is called price inelastic when the absolute value of price elasticity is what?",
    options: ["Greater than 2", "Greater than 1", "Equal to infinity", "Less than 1"],
    correctIndex: 3,
    explanation: "Price-inelastic demand changes proportionally less than price, so absolute elasticity is below 1.",
  },
  {
    id: "summit-astronomy-redshift-01",
    stage: 3,
    category: "Cosmology",
    prompt: "The redshift of light from a distant galaxy is commonly interpreted as evidence that the galaxy is doing what?",
    options: [
      "Moving away from us",
      "Losing all of its mass",
      "Turning into a planet",
      "Stopping nuclear fusion everywhere",
    ],
    correctIndex: 0,
    explanation: "Cosmological redshift is associated with receding galaxies and the expansion of space.",
  },
]);

const QUESTION_BY_ID = new Map(QUESTIONS.map((question) => [question.id, question]));

const shuffle = (items = [], random = Math.random) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const selectQuestionsForAttempt = ({ random = Math.random } = {}) =>
  STAGES.flatMap((stage) =>
    shuffle(
      QUESTIONS.filter((question) => question.stage === stage.number),
      random
    )
      .slice(0, 5)
      .map((question) => question.id)
  );

const getQuestionById = (questionId = "") => QUESTION_BY_ID.get(String(questionId || "")) || null;

const getStageByNumber = (stageNumber) =>
  STAGES.find((stage) => stage.number === Number(stageNumber)) || STAGES[0];

module.exports = {
  PRIZE_LADDER,
  QUESTIONS,
  STAGES,
  getQuestionById,
  getStageByNumber,
  selectQuestionsForAttempt,
};
