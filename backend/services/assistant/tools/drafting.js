const {
  ASSISTANT_TONES,
  draftPostCaptionToolInputSchema,
  explainFeatureToolInputSchema,
} = require("../schemas");
const { buildAction, buildCard, safeText } = require("./shared");

const tonePrefixes = {
  friendly: ["Bright day", "Good vibes", "Feeling good"],
  playful: ["Big mood", "Plot twist", "Tiny flex"],
  professional: ["Quick update", "Project note", "Focus mode"],
  inspiring: ["Keep going", "Build in public", "Momentum matters"],
  warm: ["Grateful", "Small win", "Today feels good"],
};

const draftPostCaptionTool = {
  name: "draftPostCaption",
  description: "Draft three short caption options for a post topic.",
  parameters: {
    type: "object",
    properties: {
      topic: { type: "string", minLength: 1, maxLength: 140 },
      tone: { type: "string", enum: ASSISTANT_TONES },
    },
    required: ["topic"],
    additionalProperties: false,
  },
  inputSchema: draftPostCaptionToolInputSchema,
  handler: async ({ topic, tone = "warm" }) => {
    const cleanTopic = safeText(topic, 110);
    const prefixList = tonePrefixes[tone] || tonePrefixes.warm;
    const [first, second, third] = prefixList;
    const captions = [
      `${first}: ${cleanTopic}.`,
      `${second} and grateful for ${cleanTopic}.`,
      `${third} - ${cleanTopic} is the focus today.`,
    ].map((entry) => safeText(entry, 120));

    return {
      message: `Here are three caption options for "${cleanTopic}".`,
      actions: [],
      cards: captions.map((caption, index) =>
        buildCard({
          type: "caption",
          title: `Caption ${index + 1}`,
          subtitle: tone,
          description: caption,
          route: "",
          payload: {
            text: caption,
            tone,
          },
        })
      ),
      requiresConfirmation: false,
      pendingAction: null,
    };
  },
};

const FEATURE_LIBRARY = [
  {
    key: "messages",
    aliases: ["message", "messages", "inbox", "chat", "dm", "dms"],
    title: "Messages",
    route: "/messages",
    description: "Your inbox lives inside Home, and Akuso can open it directly.",
  },
  {
    key: "notifications",
    aliases: ["notification", "notifications", "alerts"],
    title: "Notifications",
    route: "/notifications",
    description: "See likes, comments, follows, messages, and system updates.",
  },
  {
    key: "creator dashboard",
    aliases: ["creator dashboard", "creator hub", "creator home"],
    title: "Creator dashboard",
    route: "/creator/dashboard",
    description: "Manage uploads, earnings, and creator tools from one place.",
  },
  {
    key: "creator onboarding",
    aliases: ["creator onboarding", "become a creator", "creator signup", "become creator"],
    title: "Creator onboarding",
    route: "/creator",
    description: "Start the creator registration flow and finish setup.",
  },
  {
    key: "music upload",
    aliases: ["music upload", "upload a song", "upload song", "upload music", "track upload"],
    title: "Music upload",
    route: "/creator/music/upload",
    description: "Open the music upload studio for tracks or releases.",
  },
  {
    key: "book publishing",
    aliases: ["book publishing", "publish a book", "books", "book upload"],
    title: "Book publishing",
    route: "/creator/books/upload",
    description: "Open the book publishing workspace.",
  },
  {
    key: "podcast upload",
    aliases: ["podcast upload", "upload podcast", "podcast", "episode upload"],
    title: "Podcast upload",
    route: "/creator/podcasts/upload",
    description: "Open the podcast upload studio for episodes.",
  },
  {
    key: "purchases",
    aliases: ["purchase", "purchases", "orders", "library"],
    title: "Purchases",
    route: "/purchases",
    description: "Review items you bought and open unlocked content.",
  },
  {
    key: "search",
    aliases: ["search", "find", "discover"],
    title: "Search",
    route: "/search",
    description: "Search people, posts, hashtags, and rooms.",
  },
  {
    key: "find creators",
    aliases: ["find creators", "creator discovery", "discover creators"],
    title: "Find creators",
    route: "/find-creators",
    description: "Browse creators by name, handle, genre, and category.",
  },
  {
    key: "home",
    aliases: ["home", "feed"],
    title: "Home",
    route: "/home",
    description: "Go back to the main Tengacion feed.",
  },
  {
    key: "settings",
    aliases: ["settings", "preferences"],
    title: "Settings",
    route: "/settings",
    description: "Open account and app settings.",
  },
];

const explainFeatureTool = {
  name: "explainFeature",
  description: "Explain how a Tengacion feature works based on the current app.",
  parameters: {
    type: "object",
    properties: {
      featureName: { type: "string", minLength: 1, maxLength: 140 },
    },
    required: ["featureName"],
    additionalProperties: false,
  },
  inputSchema: explainFeatureToolInputSchema,
  handler: async ({ featureName }) => {
    const normalized = safeText(featureName, 140).toLowerCase();
    const match = FEATURE_LIBRARY.find((feature) =>
      feature.aliases.some((alias) => normalized.includes(alias))
    );

    if (!match) {
      return {
        message:
          "I can explain messages, notifications, creator onboarding, uploads, purchases, search, profile, settings, and home.",
        actions: [],
        cards: [],
        requiresConfirmation: false,
        pendingAction: null,
      };
    }

    return {
      message: `${match.title}: ${match.description}`,
      actions: [buildAction(match.route)],
      cards: [
        buildCard({
          type: "quick-link",
          title: match.title,
          subtitle: "Open feature",
          description: match.description,
          route: match.route,
          payload: {
            featureName: match.key,
          },
        }),
      ],
      requiresConfirmation: false,
      pendingAction: null,
    };
  },
};

module.exports = {
  draftPostCaptionTool,
  explainFeatureTool,
};
