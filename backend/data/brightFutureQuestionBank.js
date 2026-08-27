const SUBJECT_DEFINITIONS = Object.freeze([
  { key: "nigerian_entertainment", label: "Nigerian Music and Movies Entertainment", shortLabel: "Entertainment" },
  { key: "football", label: "UEFA, LaLiga, Nigerian and African Football", shortLabel: "Football" },
  { key: "technology", label: "Tech, Tengacion.com and Silicon Valley", shortLabel: "Technology" },
  { key: "general_english", label: "General English", shortLabel: "English" },
  { key: "stem", label: "General Mathematics and Science/STEM", shortLabel: "Maths & STEM" },
]);

const QUESTION_CATALOG = Object.freeze([
  { questionId: "bfa-football-01", subject: "football", order: 1, prompt: "Which club won the first five editions of the European Cup, now called the UEFA Champions League?", options: ["AC Milan", "Bayern Munich", "Liverpool", "Real Madrid", "Sporting CP"], correctIndex: 3 },
  { questionId: "bfa-football-02", subject: "football", order: 2, prompt: "At which stadium was the dramatic 1999 UEFA Champions League final between Manchester United and Bayern Munich played?", options: ["Camp Nou", "Old Trafford", "San Siro", "Santiago Bernabeu", "Wembley"], correctIndex: 0 },
  { questionId: "bfa-football-03", subject: "football", order: 3, prompt: "Which club won the inaugural LaLiga championship in the 1928/29 season?", options: ["Athletic Club", "Atletico Madrid", "Barcelona", "Real Madrid", "Real Sociedad"], correctIndex: 2 },
  { questionId: "bfa-football-04", subject: "football", order: 4, prompt: "The Pichichi Trophy is awarded each LaLiga season for which achievement?", options: ["Best goalkeeper", "Highest goal scorer", "Most assists", "Most clean sheets", "Youngest debut"], correctIndex: 1 },
  { questionId: "bfa-football-05", subject: "football", order: 5, prompt: "In which year did Nigeria win the Africa Cup of Nations for the first time?", options: ["1960", "1976", "1980", "1994", "2013"], correctIndex: 2 },
  { questionId: "bfa-football-06", subject: "football", order: 6, prompt: "Which team did Nigeria defeat in the final to win men's Olympic football gold in 1996?", options: ["Argentina", "Brazil", "Germany", "Mexico", "Spain"], correctIndex: 0 },
  { questionId: "bfa-football-07", subject: "football", order: 7, prompt: "With which club did Nwankwo Kanu win the UEFA Champions League in 1995?", options: ["Ajax", "Arsenal", "Inter Milan", "Portsmouth", "West Bromwich Albion"], correctIndex: 0 },
  { questionId: "bfa-football-08", subject: "football", order: 8, prompt: "Which country has won the men's Africa Cup of Nations the most times?", options: ["Cameroon", "Egypt", "Ghana", "Ivory Coast", "Nigeria"], correctIndex: 1 },
  { questionId: "bfa-football-09", subject: "football", order: 9, prompt: "Which African country became the continent's first men's FIFA World Cup semi-finalist in 2022?", options: ["Cameroon", "Ghana", "Morocco", "Senegal", "South Africa"], correctIndex: 2 },
  { questionId: "bfa-football-10", subject: "football", order: 10, prompt: "Which African footballer became the first from the continent to win the Ballon d'Or in 1995?", options: ["Abedi Pele", "Didier Drogba", "George Weah", "Jay-Jay Okocha", "Roger Milla"], correctIndex: 2 },

  { questionId: "bfa-technology-01", subject: "technology", order: 1, prompt: "Which company owns and operates the Tengacion platform?", options: ["Africa Magic Limited", "Lagos Digital Studios", "Silicon Africa Incorporated", "Tengacion Technologies Limited", "Tengacion Telecoms Plc"], correctIndex: 3 },
  { questionId: "bfa-technology-02", subject: "technology", order: 2, prompt: "On Tengacion, what connects a public release back to the person behind it?", options: ["A creator profile", "A device serial number", "A government register", "A private browser cookie", "A school timetable"], correctIndex: 0 },
  { questionId: "bfa-technology-03", subject: "technology", order: 3, prompt: "Which group accurately lists media people can discover through Tengacion creator pages?", options: ["Flight schedules and weather maps", "Music, books, podcasts and videos", "Only live television channels", "Only printed newspapers", "Tax forms and court records"], correctIndex: 1 },
  { questionId: "bfa-technology-04", subject: "technology", order: 4, prompt: "Why are Tengacion's public creator and release pages designed to be indexable?", options: ["To disable sharing", "To help work appear in search and link previews", "To hide creator identities", "To replace internet browsers", "To store exam answers"], correctIndex: 1 },
  { questionId: "bfa-technology-05", subject: "technology", order: 5, prompt: "What is the main job of the Domain Name System (DNS)?", options: ["Compressing video files", "Encrypting every password", "Translating domain names into IP addresses", "Writing website layouts", "Removing computer viruses"], correctIndex: 2 },
  { questionId: "bfa-technology-06", subject: "technology", order: 6, prompt: "Which port is used by HTTPS by default?", options: ["21", "25", "80", "443", "8080"], correctIndex: 3 },
  { questionId: "bfa-technology-07", subject: "technology", order: 7, prompt: "In which US state is Silicon Valley located?", options: ["California", "Florida", "New York", "Texas", "Washington"], correctIndex: 0 },
  { questionId: "bfa-technology-08", subject: "technology", order: 8, prompt: "Why is silicon especially useful in manufacturing computer chips?", options: ["It is a semiconductor", "It is always magnetic", "It naturally stores software", "It produces unlimited energy", "It works without electricity"], correctIndex: 0 },
  { questionId: "bfa-technology-09", subject: "technology", order: 9, prompt: "Who co-founded Google while they were students at Stanford University?", options: ["Bill Gates and Paul Allen", "Larry Page and Sergey Brin", "Robert Noyce and Gordon Moore", "Steve Jobs and Steve Wozniak", "William Hewlett and David Packard"], correctIndex: 1 },
  { questionId: "bfa-technology-10", subject: "technology", order: 10, prompt: "Which pair co-founded Intel in Silicon Valley in 1968?", options: ["Larry Ellison and Marc Benioff", "Larry Page and Sergey Brin", "Robert Noyce and Gordon Moore", "Steve Jobs and Steve Wozniak", "William Hewlett and David Packard"], correctIndex: 2 },

  { questionId: "bfa-english-01-new", subject: "general_english", order: 1, prompt: "Choose the sentence with correct subject-verb agreement.", options: ["Neither of the reports have been submitted.", "Neither of the reports has been submitted.", "Neither of the report have been submitted.", "Neither reports has been submitted.", "Neither of reports were submitted."], correctIndex: 1 },
  { questionId: "bfa-english-02-new", subject: "general_english", order: 2, prompt: "Which word is closest in meaning to 'mitigate'?", options: ["Celebrate", "Intensify", "Postpone forever", "Reduce the severity of", "Reveal publicly"], correctIndex: 3 },
  { questionId: "bfa-english-03-new", subject: "general_english", order: 3, prompt: "Which word is the best antonym for 'ubiquitous'?", options: ["Common", "Hidden", "Rare", "Useful", "Visible"], correctIndex: 2 },
  { questionId: "bfa-english-04-new", subject: "general_english", order: 4, prompt: "Complete the sentence correctly: If Ada had studied the map, she _____ the wrong road.", options: ["did not take", "had not taken", "will not take", "would not have taken", "would not take"], correctIndex: 3 },
  { questionId: "bfa-english-05-new", subject: "general_english", order: 5, prompt: "Which sentence avoids a dangling modifier?", options: ["Running for the bus, the rain soaked Tunde.", "After reading the book, the film seemed disappointing.", "Walking through the market, Ada noticed the colourful fabrics.", "To finish early, the work was rushed.", "While eating dinner, the lights surprised us."], correctIndex: 2 },
  { questionId: "bfa-english-06-new", subject: "general_english", order: 6, prompt: "Choose the sentence in which the semicolon is used correctly.", options: ["Amina packed; because the trip was early.", "Amina packed her bag; the trip began at dawn.", "Amina; packed her bag before dawn.", "Because Amina packed; her bag was ready.", "The bag; that Amina packed was ready."], correctIndex: 1 },
  { questionId: "bfa-english-07-new", subject: "general_english", order: 7, prompt: "In the sentence 'What the coach decided surprised everyone,' what is the grammatical function of 'What the coach decided'?", options: ["Adjective clause", "Adverbial phrase", "Independent question", "Noun clause", "Prepositional phrase"], correctIndex: 3 },
  { questionId: "bfa-english-08-new", subject: "general_english", order: 8, prompt: "Which option correctly reports this statement: Ada said, 'I completed my homework yesterday'?", options: ["Ada said that I complete my homework yesterday.", "Ada said that she had completed her homework the previous day.", "Ada says she completed your homework tomorrow.", "Ada said she has complete her homework yesterday.", "Ada said that she would complete my homework the day before."], correctIndex: 1 },
  { questionId: "bfa-english-09-new", subject: "general_english", order: 9, prompt: "Complete the analogy: Opaque is to transparent as reluctant is to _____.", options: ["Eager", "Hesitant", "Patient", "Quiet", "Uncertain"], correctIndex: 0 },
  { questionId: "bfa-english-10-new", subject: "general_english", order: 10, prompt: "A notice says, 'Library books must be returned by Friday to avoid a fine.' What can be inferred?", options: ["All books become free on Friday.", "Books returned after Friday may attract a charge.", "The library closes permanently on Friday.", "Only new books can be returned.", "Students cannot borrow books before Friday."], correctIndex: 1 },

  { questionId: "bfa-stem-01", subject: "stem", order: 1, prompt: "A tablet priced at 7,500 naira is discounted by 20%. What is the new price?", options: ["5,500 naira", "6,000 naira", "6,250 naira", "6,500 naira", "7,300 naira"], correctIndex: 1 },
  { questionId: "bfa-stem-02", subject: "stem", order: 2, prompt: "If 2x + y = 11 and x - y = 1, what is the value of x?", options: ["2", "3", "4", "5", "6"], correctIndex: 2 },
  { questionId: "bfa-stem-03", subject: "stem", order: 3, prompt: "A bag contains 3 red balls and 5 blue balls. If one ball is chosen at random, what is the probability that it is red?", options: ["1/3", "3/5", "3/8", "5/8", "5/3"], correctIndex: 2 },
  { questionId: "bfa-stem-04", subject: "stem", order: 4, prompt: "Using pi = 22/7, what is the area of a circle with radius 7 cm?", options: ["44 square cm", "77 square cm", "144 square cm", "154 square cm", "308 square cm"], correctIndex: 3 },
  { questionId: "bfa-stem-05", subject: "stem", order: 5, prompt: "What is the next number in the sequence 3, 8, 15, 24, 35, ...?", options: ["44", "46", "47", "48", "50"], correctIndex: 3 },
  { questionId: "bfa-stem-06", subject: "stem", order: 6, prompt: "Which element has atomic number 8?", options: ["Carbon", "Hydrogen", "Nitrogen", "Oxygen", "Sodium"], correctIndex: 3 },
  { questionId: "bfa-stem-07", subject: "stem", order: 7, prompt: "Three bulbs are connected in a simple series circuit. What happens if one bulb is removed?", options: ["All the bulbs go off", "Only the removed bulb goes off", "The battery charges faster", "The other bulbs become twice as bright", "The wires produce more current"], correctIndex: 0 },
  { questionId: "bfa-stem-08", subject: "stem", order: 8, prompt: "A car's velocity changes from 10 m/s to 25 m/s in 5 seconds. What is its average acceleration?", options: ["2 m/s squared", "3 m/s squared", "5 m/s squared", "7 m/s squared", "15 m/s squared"], correctIndex: 1 },
  { questionId: "bfa-stem-09", subject: "stem", order: 9, prompt: "In which cell structure does photosynthesis mainly take place?", options: ["Cell membrane", "Chloroplast", "Mitochondrion", "Nucleus", "Vacuole"], correctIndex: 1 },
  { questionId: "bfa-stem-10", subject: "stem", order: 10, prompt: "A solution has a pH of 2. How should it be classified?", options: ["Acidic", "Alkaline", "Neutral", "Radioactive", "Saturated"], correctIndex: 0 },
  { questionId: "bfa-entertainment-01", subject: "nigerian_entertainment", order: 1, prompt: "What was Afrobeat pioneer Fela Kuti's first name at birth?", options: ["Adekunle", "Olufela", "Oluwaseun", "Temiloluwa", "Victor"], correctIndex: 1 },
  { questionId: "bfa-entertainment-02", subject: "nigerian_entertainment", order: 2, prompt: "Which Burna Boy album won the Grammy Award for Best Global Music Album in 2021?", options: ["African Giant", "Love, Damini", "On a Spaceship", "Outside", "Twice as Tall"], correctIndex: 4 },
  { questionId: "bfa-entertainment-03", subject: "nigerian_entertainment", order: 3, prompt: "Which Nigerian artiste recorded the global hit 'Love Nwantiti (Ah Ah Ah)'?", options: ["CKay", "Joeboy", "Mr Eazi", "Rema", "Tekno"], correctIndex: 0 },
  { questionId: "bfa-entertainment-04", subject: "nigerian_entertainment", order: 4, prompt: "Which Nigerian singer co-wrote Rihanna's song 'Lift Me Up' from 'Black Panther: Wakanda Forever'?", options: ["Ayra Starr", "Simi", "Tems", "Tiwa Savage", "Yemi Alade"], correctIndex: 2 },
  { questionId: "bfa-entertainment-05", subject: "nigerian_entertainment", order: 5, prompt: "Who directed the Nigerian film 'Lionheart'?", options: ["Funke Akindele", "Genevieve Nnaji", "Jade Osiberu", "Kemi Adetiba", "Mo Abudu"], correctIndex: 1 },
  { questionId: "bfa-entertainment-06", subject: "nigerian_entertainment", order: 6, prompt: "Who directed the Nigerian romantic comedy 'The Wedding Party'?", options: ["Biyi Bandele", "Kemi Adetiba", "Kunle Afolayan", "Tope Oshin", "Tunde Kelani"], correctIndex: 1 },
  { questionId: "bfa-entertainment-07", subject: "nigerian_entertainment", order: 7, prompt: "Which filmmaker directed the epic fantasy film 'Anikulapo'?", options: ["Akin Omotoso", "Kunle Afolayan", "Niyi Akinmolayan", "Ramsey Nouah", "Tade Ogidan"], correctIndex: 1 },
  { questionId: "bfa-entertainment-08", subject: "nigerian_entertainment", order: 8, prompt: "Which historical event provides the central backdrop for Kunle Afolayan's film 'October 1'?", options: ["Nigeria's amalgamation", "Nigeria's independence", "The Aba Women's Riot", "The FESTAC festival", "The Nigerian Civil War"], correctIndex: 1 },
  { questionId: "bfa-entertainment-09", subject: "nigerian_entertainment", order: 9, prompt: "Which filmmaker created and directed the political crime drama 'King of Boys'?", options: ["Funke Akindele", "Jade Osiberu", "Kemi Adetiba", "Mildred Okwo", "Tope Oshin"], correctIndex: 2 },
  { questionId: "bfa-entertainment-10", subject: "nigerian_entertainment", order: 10, prompt: "What does the film-awards abbreviation AMVCA stand for?", options: ["African Movie and Video Critics Association", "Africa Magic Viewers' Choice Awards", "African Music, Video and Cinema Awards", "Africa Media Viewers' Cinema Awards", "African Motion Visual Creators Awards"], correctIndex: 1 },
]);

const currentSubjectKeys = new Set(SUBJECT_DEFINITIONS.map((subject) => subject.key));
const QUESTIONS = Object.freeze(QUESTION_CATALOG.filter((question) => currentSubjectKeys.has(question.subject)));

const questionIds = new Set();
for (const question of QUESTIONS) {
  if (questionIds.has(question.questionId)) {
    throw new Error(`Duplicate Bright Future question id: ${question.questionId}`);
  }
  questionIds.add(question.questionId);
  if (!Array.isArray(question.options) || question.options.length !== 5) {
    throw new Error(`Bright Future question ${question.questionId} must have five options.`);
  }
  if (new Set(question.options.map((option) => option.trim().toLowerCase())).size !== 5) {
    throw new Error(`Bright Future question ${question.questionId} must have distinct options.`);
  }
  if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex > 4) {
    throw new Error(`Bright Future question ${question.questionId} has an invalid answer key.`);
  }
}

for (const subject of SUBJECT_DEFINITIONS) {
  const subjectQuestions = QUESTIONS.filter((question) => question.subject === subject.key);
  if (subjectQuestions.length !== 10) {
    throw new Error(`Bright Future subject ${subject.key} must contain exactly ten questions.`);
  }
}

module.exports = { QUESTIONS, SUBJECT_DEFINITIONS };
