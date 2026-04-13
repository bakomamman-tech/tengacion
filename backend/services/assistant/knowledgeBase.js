const normalizeText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const KNOWLEDGE_ARTICLES = [
  {
    id: "nigeria-basics",
    title: "Nigeria basics",
    tags: ["nigeria", "west africa", "geography", "country"],
    summary: "Nigeria is a West African country with Abuja as its capital and Lagos as a major economic hub.",
    bullets: [
      "Nigeria is one of Africa's most populous countries and is home to many languages and cultures.",
      "Abuja is the capital city, while Lagos is widely known for commerce, media, and creative industries.",
      "English is the official language, and many users also communicate in Hausa, Yoruba, Igbo, and other languages.",
    ],
  },
  {
    id: "africa-basics",
    title: "Africa basics",
    tags: ["africa", "continent", "geography"],
    summary: "Africa is a continent with 54 widely recognized countries and many histories, languages, and cultures.",
    bullets: [
      "Africa is a continent, not a single country.",
      "It contains many regions, languages, religions, and cultural traditions.",
      "Good explanations about Africa should stay specific and avoid stereotypes.",
    ],
  },
  {
    id: "world-history",
    title: "World history",
    tags: ["world history", "history", "civilization"],
    summary: "World history is easiest to explain by comparing eras, regions, trade, empire, and social change.",
    bullets: [
      "A useful answer should name the period and place being discussed.",
      "Trade routes, migration, empire, technology, and ideas all shaped world history.",
      "Modern history often links political change with industrial and scientific change.",
    ],
  },
  {
    id: "african-history",
    title: "African history",
    tags: ["history", "africa", "civilizations"],
    summary: "African history covers ancient kingdoms, trade networks, scholarship, colonial disruption, and independence movements.",
    bullets: [
      "Ancient and medieval African states contributed to trade, governance, scholarship, and art.",
      "The history of the continent is diverse, so it helps to name a region, kingdom, or country when discussing it.",
      "A balanced answer should include both continuity and change across time.",
    ],
  },
  {
    id: "nigerian-public-life",
    title: "Nigerian public life",
    tags: ["nigeria", "public figures", "culture", "media"],
    summary: "Safe discussion of Nigerian public life should stay factual, current, and non-defamatory.",
    bullets: [
      "When discussing public figures, keep the answer neutral and fact-based.",
      "Avoid rumor, speculation, or unverified claims.",
      "If the user wants a biography or summary, focus on verified public work and achievements.",
    ],
  },
  {
    id: "nigerian-culture",
    title: "Nigerian culture",
    tags: ["nigeria", "culture", "music", "food", "literature"],
    summary: "Nigerian culture is diverse and includes music, literature, food, fashion, film, faith, and local languages.",
    bullets: [
      "Popular Nigerian creative exports include music, film, fashion, and literature.",
      "Cultural expressions vary widely by region and community, so it is best to be specific.",
      "Respectful language matters because Nigeria is both culturally rich and highly diverse.",
    ],
  },
  {
    id: "nigerian-cities",
    title: "Nigerian cities",
    tags: ["nigeria", "cities", "geography"],
    summary: "Nigerian cities are diverse in economy, culture, and regional role.",
    bullets: [
      "Lagos is a major commercial and creative center.",
      "Abuja is the federal capital city.",
      "Other important cities include Port Harcourt, Kano, Ibadan, Enugu, and Kaduna, each with its own history and role.",
    ],
  },
  {
    id: "african-music",
    title: "African music",
    tags: ["music", "africa", "afrobeats", "entertainment"],
    summary: "African music covers many genres, from traditional forms to modern sounds like Afrobeats.",
    bullets: [
      "Africa's music scenes are local, regional, and globally influential.",
      "Modern African music often blends traditional rhythms, new production, and international collaboration.",
      "A helpful answer should name the genre, country, or era the user cares about.",
    ],
  },
  {
    id: "creator-economy-africa",
    title: "Creator economy in Africa",
    tags: ["creator economy", "africa", "business", "social media"],
    summary: "African creator economy answers work best when they emphasize distribution, trust, pricing, and community.",
    bullets: [
      "Creators often grow through strong relationships, direct distribution, and consistent posting.",
      "Clear pricing and clear value matter for sales and fan support.",
      "Localized language and audience trust can be a major advantage.",
    ],
  },
  {
    id: "science-basics",
    title: "Science basics",
    tags: ["science", "education", "explain simply"],
    summary: "Science explanations work best when they define the concept, show the mechanism, and use a simple example.",
    bullets: [
      "Start with a plain-language definition.",
      "Show how the idea works in real life.",
      "Use a short example before moving to deeper detail.",
    ],
  },
  {
    id: "technology-basics",
    title: "Technology basics",
    tags: ["technology", "ai", "apps", "engineering"],
    summary: "Technology answers should explain the problem, the tool, and the trade-off in simple terms.",
    bullets: [
      "Technical explanations should avoid jargon where possible.",
      "Use examples, comparisons, and step-by-step reasoning.",
      "When data is missing, state the assumption clearly instead of guessing.",
    ],
  },
  {
    id: "business-basics",
    title: "Business basics",
    tags: ["business", "startup", "marketing", "finance"],
    summary: "Business explanations are stronger when they define the offer, the audience, the value, and the next action.",
    bullets: [
      "A business idea should solve a real problem for a specific audience.",
      "Clear positioning matters more than clever language.",
      "When users ask for promotions or copy, keep the message direct and practical.",
    ],
  },
  {
    id: "literature-basics",
    title: "Literature basics",
    tags: ["literature", "books", "writing", "analysis"],
    summary: "Literature answers should discuss theme, structure, character, style, and context with simple examples.",
    bullets: [
      "Identify the main idea or theme first.",
      "Talk about structure, voice, or style if the question asks for analysis.",
      "Keep the explanation grounded in the text rather than making up details.",
    ],
  },
  {
    id: "civic-awareness",
    title: "Civic awareness",
    tags: ["civic", "citizenship", "neutral", "public issues"],
    summary: "Civic answers should stay factual, calm, neutral, and focused on public information.",
    bullets: [
      "Avoid propaganda framing or inflammatory language.",
      "Describe institutions, responsibilities, and processes in neutral language.",
      "If the issue is disputed, note the uncertainty rather than overstating certainty.",
    ],
  },
  {
    id: "religion-neutral-learning",
    title: "Religion-neutral learning",
    tags: ["religion", "belief", "neutral", "education"],
    summary: "Religion-neutral learning should explain beliefs, history, or culture respectfully without pushing a viewpoint.",
    bullets: [
      "Use respectful, neutral language.",
      "Explain terms carefully and avoid dismissive framing.",
      "When the topic is sensitive, keep the answer educational and balanced.",
    ],
  },
  {
    id: "study-strategy",
    title: "Study strategy",
    tags: ["study", "learning", "education", "revision"],
    summary: "Good study support breaks a topic into small parts, asks check questions, and uses short practice.",
    bullets: [
      "Summarize the topic in one sentence first.",
      "Break the lesson into small steps or examples.",
      "End with a quick check question or practice prompt.",
    ],
  },
];

const scoreKnowledgeArticle = (article, query) => {
  const needle = normalizeText(query);
  if (!needle) {
    return 0;
  }

  const searchable = [
    article.title,
    article.summary,
    ...(article.tags || []),
    ...(article.bullets || []),
  ]
    .map((entry) => normalizeText(entry))
    .join(" | ");

  let score = 0;
  if (searchable.includes(needle)) {
    score += 60;
  }

  for (const tag of article.tags || []) {
    const normalizedTag = normalizeText(tag);
    if (!normalizedTag) continue;
    if (needle === normalizedTag) {
      score += 28;
    } else if (needle.includes(normalizedTag) || normalizedTag.includes(needle)) {
      score += 14;
    }
  }

  if (normalizeText(article.title).includes(needle)) score += 18;
  if (normalizeText(article.summary).includes(needle)) score += 10;

  return score;
};

const searchKnowledgeArticles = (query = "", { limit = 4 } = {}) => {
  const scored = KNOWLEDGE_ARTICLES.map((article) => ({
    article,
    score: scoreKnowledgeArticle(article, query),
  }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);

  return scored.slice(0, limit).map(({ article }) => ({
    id: article.id,
    title: article.title,
    summary: article.summary,
    bullets: [...(article.bullets || [])],
  }));
};

module.exports = {
  KNOWLEDGE_ARTICLES,
  searchKnowledgeArticles,
};
