const STAGES = Object.freeze([
  {
    number: 1,
    name: "The Crucible",
    subtitle: "Precision under pressure",
    difficulty: "Challenging",
    timeLimitSeconds: 20,
  },
  {
    number: 2,
    name: "The Gauntlet",
    subtitle: "Connect difficult ideas",
    difficulty: "Expert",
    timeLimitSeconds: 20,
  },
  {
    number: 3,
    name: "The Apex",
    subtitle: "Reason at elite speed",
    difficulty: "Elite",
    timeLimitSeconds: 20,
  },
]);

const STANDARD_PRIZE_LADDER = Object.freeze([
  100,
  100,
  125,
  150,
  175,
  200,
  225,
  250,
  275,
  300,
  325,
  350,
  375,
  390,
  400,
]);

const DAILY_PREMIUM_PRIZE_LADDER = Object.freeze([
  100,
  125,
  150,
  200,
  250,
  300,
  350,
  400,
  450,
  500,
  600,
  700,
  800,
  900,
  1_000,
]);

const QUESTIONS = Object.freeze([
  {
    id: "spark-math-percent-01",
    stage: 1,
    category: "Number Theory",
    prompt:
      "Without expanding every power, what remainder is obtained when 3⁷ + 2⁵ is divided by 7?",
    options: ["1", "2", "5", "0"],
    correctIndex: 3,
    explanation:
      "Fermat's theorem gives 3⁶ ≡ 1 (mod 7), so 3⁷ ≡ 3; 2⁵ = 32 ≡ 4. Their sum is 7 ≡ 0.",
  },
  {
    id: "spark-biology-organ-01",
    stage: 1,
    category: "Cell Biology",
    prompt:
      "During which substage of meiotic prophase I is crossing-over between homologous chromosomes chiefly completed?",
    options: ["Leptotene", "Pachytene", "Diplotene", "Diakinesis"],
    correctIndex: 1,
    explanation:
      "Synapsis is complete and crossing-over chiefly occurs during pachytene; chiasmata become visible later in diplotene.",
  },
  {
    id: "spark-geography-ocean-01",
    stage: 1,
    category: "Political Geography",
    prompt:
      "The oil-producing exclave of Cabinda is separated from the rest of which African country by a narrow strip of the Democratic Republic of the Congo?",
    options: ["Republic of the Congo", "Gabon", "Angola", "Namibia"],
    correctIndex: 2,
    explanation:
      "Cabinda is an Angolan exclave separated from mainland Angola by the DRC's short Atlantic corridor.",
  },
  {
    id: "spark-language-synonym-01",
    stage: 1,
    category: "Rhetoric",
    prompt:
      "In the sentence “She broke his car and his heart,” one verb governs two objects in different senses. Which figure of speech is this?",
    options: ["Zeugma", "Anaphora", "Litotes", "Chiasmus"],
    correctIndex: 0,
    explanation:
      "Zeugma uses one word, usually a verb, with two others in grammatically parallel but semantically different ways.",
  },
  {
    id: "spark-computing-cpu-01",
    stage: 1,
    category: "Databases",
    prompt:
      "Which ACID isolation level requires concurrent transactions to produce a result equivalent to some serial ordering of those transactions?",
    options: ["Read uncommitted", "Read committed", "Repeatable read", "Serializable"],
    correctIndex: 3,
    explanation:
      "Serializable is the strongest standard isolation level and requires an outcome equivalent to serial execution.",
  },
  {
    id: "spark-chemistry-water-01",
    stage: 1,
    category: "Chemistry",
    prompt:
      "For a weak-acid buffer at 25°C, what is true when the molar concentrations of the acid and its conjugate base are equal?",
    options: ["pH = 7 in every case", "pH = pKa", "pOH = pKa", "The buffer capacity is zero"],
    correctIndex: 1,
    explanation:
      "The Henderson–Hasselbalch equation becomes pH = pKa + log(1), so pH equals pKa.",
  },
  {
    id: "spark-civics-government-01",
    stage: 1,
    category: "Government",
    prompt:
      "When two chambers of a bicameral legislature pass different versions of the same bill, which temporary body commonly reconciles the texts?",
    options: ["Electoral commission", "Judicial council", "Conference committee", "Cabinet secretariat"],
    correctIndex: 2,
    explanation:
      "A conference committee is commonly formed from members of both chambers to negotiate one agreed text.",
  },
  {
    id: "spark-music-tempo-01",
    stage: 1,
    category: "Music Theory",
    prompt:
      "A composition is written in E-flat major. Which key is its relative minor, sharing the same three-flat key signature?",
    options: ["E-flat minor", "C minor", "G minor", "B-flat minor"],
    correctIndex: 1,
    explanation:
      "The relative minor begins on the sixth degree of the major scale; the sixth degree of E-flat major is C.",
  },
  {
    id: "spark-economics-scarcity-01",
    stage: 1,
    category: "Economics",
    prompt:
      "Country A sacrifices two tonnes of cocoa to produce one machine; Country B sacrifices five. Who has the comparative advantage in machines?",
    options: ["Country A", "Country B", "Both equally", "Neither without wage data"],
    correctIndex: 0,
    explanation:
      "Comparative advantage belongs to the producer with the lower opportunity cost, which is Country A.",
  },
  {
    id: "spark-agriculture-germination-01",
    stage: 1,
    category: "Agricultural Science",
    prompt:
      "Which bacterial genus forms root nodules on many legumes and converts atmospheric nitrogen into biologically useful compounds?",
    options: ["Lactobacillus", "Nitrosomonas", "Rhizobium", "Streptococcus"],
    correctIndex: 2,
    explanation:
      "Rhizobium species live symbiotically in legume root nodules and fix atmospheric nitrogen.",
  },
  {
    id: "climb-physics-acceleration-01",
    stage: 2,
    category: "Electromagnetism",
    prompt:
      "A conducting loop experiences a changing magnetic flux. Which quantity directly determines the magnitude of the induced electromotive force?",
    options: [
      "The flux alone",
      "The rate of change of flux linkage",
      "The loop's absolute temperature only",
      "The magnetic field's direction only",
    ],
    correctIndex: 1,
    explanation:
      "Faraday's law states that induced emf equals the magnitude of the rate of change of magnetic flux linkage.",
  },
  {
    id: "climb-history-berlin-01",
    stage: 2,
    category: "African History",
    prompt:
      "Which Ethiopian emperor led the forces that defeated Italy at the Battle of Adwa in 1896, preserving Ethiopian sovereignty?",
    options: ["Tewodros II", "Haile Selassie", "Menelik II", "Yohannes IV"],
    correctIndex: 2,
    explanation:
      "Emperor Menelik II led Ethiopia during the decisive victory over Italy at Adwa.",
  },
  {
    id: "climb-astronomy-lightyear-01",
    stage: 2,
    category: "Astrophysics",
    prompt:
      "If a non-rotating black hole's mass is doubled while all else is idealised, how does its Schwarzschild radius change?",
    options: ["It doubles", "It quadruples", "It halves", "It is unchanged"],
    correctIndex: 0,
    explanation:
      "The Schwarzschild radius is 2GM/c² and therefore scales linearly with mass.",
  },
  {
    id: "climb-law-habeas-01",
    stage: 2,
    category: "Criminal Law",
    prompt:
      "Which Latin term describes the culpable mental element that usually accompanies a prohibited act for criminal liability?",
    options: ["Stare decisis", "Actus reus", "Ultra vires", "Mens rea"],
    correctIndex: 3,
    explanation:
      "Mens rea is the guilty or culpable mental state; actus reus is the prohibited conduct.",
  },
  {
    id: "climb-statistics-median-01",
    stage: 2,
    category: "Bayesian Statistics",
    prompt:
      "A condition affects 1% of people. A test is 99% sensitive and 95% specific. Approximately what is P(condition | positive)?",
    options: ["1%", "5%", "16.7%", "95%"],
    correctIndex: 2,
    explanation:
      "Among 10,000 people, about 99 true positives and 495 false positives occur; 99/(99+495) is about 16.7%.",
  },
  {
    id: "climb-visualart-chiaroscuro-01",
    stage: 2,
    category: "Art History",
    prompt:
      "Which Renaissance technique creates soft, smoky transitions between colours and tones without sharp outlines, as seen in Leonardo's work?",
    options: ["Impasto", "Sfumato", "Frottage", "Pointillism"],
    correctIndex: 1,
    explanation:
      "Sfumato blends tones into one another with extremely soft edges and atmospheric transitions.",
  },
  {
    id: "climb-medicine-insulin-01",
    stage: 2,
    category: "Human Physiology",
    prompt:
      "Which property best distinguishes the thin descending limb of the loop of Henle from its ascending limb?",
    options: [
      "High water permeability with relatively low solute permeability",
      "Active sodium pumping with high water permeability",
      "Secretion of insulin into the filtrate",
      "Complete impermeability to water and ions",
    ],
    correctIndex: 0,
    explanation:
      "The thin descending limb is highly permeable to water, whereas the ascending limb reabsorbs salts and is water-impermeable.",
  },
  {
    id: "climb-ecology-foodweb-01",
    stage: 2,
    category: "Ecology",
    prompt:
      "Gause's competitive-exclusion principle predicts what when two species occupy exactly the same limiting niche in a stable environment?",
    options: [
      "Both must evolve identical genomes",
      "Predators immediately disappear",
      "One will eventually exclude the other",
      "Both populations become unlimited",
    ],
    correctIndex: 2,
    explanation:
      "Complete competitors cannot coexist indefinitely under stable limiting conditions; one outcompetes the other.",
  },
  {
    id: "climb-finance-compound-01",
    stage: 2,
    category: "Finance",
    prompt:
      "For an existing fixed-coupon bond with unchanged credit risk, what normally happens to its market price when prevailing interest rates rise?",
    options: ["It rises", "It becomes exactly par", "It is unaffected", "It falls"],
    correctIndex: 3,
    explanation:
      "Bond prices and market yields move inversely because older fixed coupons become less attractive when rates rise.",
  },
  {
    id: "climb-linguistics-morpheme-01",
    stage: 2,
    category: "Linguistics",
    prompt:
      "Two speech sounds are allophones of one phoneme when they are phonetically distinct but do what in that language?",
    options: [
      "Always change lexical meaning",
      "Do not create a contrast in meaning",
      "Occur only in written form",
      "Belong to unrelated languages",
    ],
    correctIndex: 1,
    explanation:
      "Allophones are context-dependent realisations of one phoneme and do not distinguish words by meaning.",
  },
  {
    id: "summit-math-euler-01",
    stage: 3,
    category: "Linear Algebra",
    prompt:
      "A symmetric matrix has rows [2, 1] and [1, 2]. Which pair gives its two eigenvalues?",
    options: ["2 and 2", "4 and 0", "3 and 1", "√3 and −√3"],
    correctIndex: 2,
    explanation:
      "The characteristic polynomial is (2−λ)²−1, whose roots are 3 and 1.",
  },
  {
    id: "summit-computing-binarysearch-01",
    stage: 3,
    category: "Algorithms",
    prompt:
      "Why can the standard Dijkstra algorithm return an incorrect shortest path when a reachable edge has negative weight?",
    options: [
      "A vertex treated as final may later receive a shorter path",
      "Its priority queue cannot store zero",
      "Negative edges always create negative cycles",
      "It searches breadth-first rather than by distance",
    ],
    correctIndex: 0,
    explanation:
      "Dijkstra relies on non-negative edges so a settled minimum cannot later be improved; a negative edge breaks that invariant.",
  },
  {
    id: "summit-genetics-codon-01",
    stage: 3,
    category: "Population Genetics",
    prompt:
      "Under Hardy–Weinberg equilibrium, a recessive phenotype occurs in 9% of a population. What proportion is expected to be heterozygous?",
    options: ["0.09", "0.18", "0.30", "0.42"],
    correctIndex: 3,
    explanation:
      "q² = 0.09 gives q = 0.3 and p = 0.7; the heterozygous proportion 2pq is 0.42.",
  },
  {
    id: "summit-philosophy-kant-01",
    stage: 3,
    category: "Political Philosophy",
    prompt:
      "The “veil of ignorance,” used to derive principles of justice without knowledge of one's social position, is associated with whom?",
    options: ["Robert Nozick", "John Rawls", "David Hume", "Thomas Hobbes"],
    correctIndex: 1,
    explanation:
      "John Rawls uses the veil of ignorance in the original position to reason impartially about justice.",
  },
  {
    id: "summit-epidemiology-r0-01",
    stage: 3,
    category: "Epidemiology",
    prompt:
      "Incidence is 30 per 1,000 among an exposed group and 10 per 1,000 among an unexposed group. What is the attributable risk?",
    options: ["3 per 1,000", "10 per 1,000", "20 per 1,000", "40 per 1,000"],
    correctIndex: 2,
    explanation:
      "Attributable risk is the risk difference: 30 per 1,000 minus 10 per 1,000 equals 20 per 1,000.",
  },
  {
    id: "summit-history-westphalia-01",
    stage: 3,
    category: "World History",
    prompt:
      "The 1494 Treaty of Tordesillas attempted to divide newly encountered lands outside Europe chiefly between which two kingdoms?",
    options: [
      "Spain and Portugal",
      "France and England",
      "Venice and the Ottoman Empire",
      "Austria and Prussia",
    ],
    correctIndex: 0,
    explanation:
      "The treaty drew a demarcation line assigning overseas spheres chiefly to Spain and Portugal.",
  },
  {
    id: "summit-engineering-feedback-01",
    stage: 3,
    category: "Signal Processing",
    prompt:
      "An ideal band-limited signal contains frequencies up to 8 kHz. Which sampling rate satisfies the strict Nyquist condition?",
    options: ["Exactly 8 kHz", "Any rate greater than 16 kHz", "Exactly 12 kHz", "Any rate below 16 kHz"],
    correctIndex: 1,
    explanation:
      "The sampling rate must be strictly greater than twice the highest frequency, so it must exceed 16 kHz.",
  },
  {
    id: "summit-literature-soliloquy-01",
    stage: 3,
    category: "Narrative Theory",
    prompt:
      "Which description best defines free indirect discourse in fiction?",
    options: [
      "A first-person narrator quoting every thought",
      "Dialogue presented only as a stage direction",
      "An omniscient narrator who never reflects character language",
      "Third-person narration coloured by a character's idiom and perceptions",
    ],
    correctIndex: 3,
    explanation:
      "Free indirect discourse blends third-person narration with a character's vocabulary, judgments, and inner perspective.",
  },
  {
    id: "summit-economics-elasticity-01",
    stage: 3,
    category: "Microeconomics",
    prompt:
      "Holding the tax rate constant, a commodity tax generally creates a larger deadweight loss when supply and demand are what?",
    options: [
      "Both perfectly inelastic",
      "Less responsive to price",
      "More elastic",
      "Identical in quantity at every price",
    ],
    correctIndex: 2,
    explanation:
      "More elastic supply and demand produce a larger reduction in traded quantity and therefore a larger deadweight loss.",
  },
  {
    id: "summit-astronomy-redshift-01",
    stage: 3,
    category: "Cosmology",
    prompt:
      "The cosmic microwave background last scattered near recombination. Approximately what cosmological redshift corresponds to that epoch?",
    options: ["z ≈ 11", "z ≈ 1,100", "z ≈ 110,000", "z ≈ 0.11"],
    correctIndex: 1,
    explanation:
      "Recombination and photon decoupling occurred at a redshift of roughly 1,100.",
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

const getQuestionById = (questionId = "") =>
  QUESTION_BY_ID.get(String(questionId || "")) || null;

const getStageByNumber = (stageNumber) =>
  STAGES.find((stage) => stage.number === Number(stageNumber)) || STAGES[0];

module.exports = {
  DAILY_PREMIUM_PRIZE_LADDER,
  QUESTIONS,
  STANDARD_PRIZE_LADDER,
  STAGES,
  getQuestionById,
  getStageByNumber,
  selectQuestionsForAttempt,
};
