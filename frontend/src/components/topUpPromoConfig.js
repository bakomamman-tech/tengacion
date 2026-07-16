export const TOTAL_DISCOVERY_STARS = 103;

const BASE_STAR_COORDINATES = [
  [47, 8], [10, 28], [88, 8], [32, 20], [53, 34],
  [9, 42], [90, 49], [8, 76], [90, 80], [10, 55],
  [73, 14], [88, 42], [9, 35], [81, 86], [88, 24],
  [42, 45], [62, 81], [10, 18], [20, 21], [79, 57],
  [69, 9], [65, 90], [22, 19], [72, 29], [76, 72],
  [34, 15], [84, 64], [76, 68], [12, 56], [85, 48],
  [58, 20], [75, 84], [90, 52], [38, 14], [20, 61],
  [18, 48], [72, 18], [32, 39], [28, 20], [84, 69],
  [52, 15], [19, 76], [11, 32], [83, 62], [9, 57],
  [69, 48], [12, 30], [81, 44], [77, 73], [88, 34],
];

const keepInViewport = (value) => Math.max(6, Math.min(94, value));

const STAR_COORDINATES = Array.from({ length: TOTAL_DISCOVERY_STARS }, (_, index) => {
  const [baseX, baseY] = BASE_STAR_COORDINATES[index % BASE_STAR_COORDINATES.length];
  const placementRound = Math.floor(index / BASE_STAR_COORDINATES.length);

  if (placementRound === 0) {
    return [baseX, baseY];
  }

  const xOffset = placementRound === 1 ? (index % 2 === 0 ? 7 : -7) : 12;
  const yOffset = placementRound === 1 ? (index % 3 === 0 ? 8 : -8) : 13;
  return [keepInViewport(baseX + xOffset), keepInViewport(baseY + yOffset)];
});

export const STAR_POSITIONS = STAR_COORDINATES.map(([x, y], index) => ({
  x,
  y,
  delay: Number(((index * 0.37) % 4.4).toFixed(2)),
  scale: Number((0.72 + (index % 5) * 0.04).toFixed(2)),
}));

const BASE_PLACEMENT_DEFINITIONS = [
  ["Search", "/search", "exact", "Navbar search and results header", "search"],
  ["Messages", "/messages", "exact", "Conversation sidebar", "messages"],
  ["Notifications", "/notifications", "exact", "Navbar notification corner", "notifications"],
  ["Home", "/home", "exact", "Stories tray", "homeStories"],
  ["Home", "/home", "exact", "Post composer", "homePost"],
  ["Friends", "/friends", "exact", "Left navigation sidebar", "friends"],
  ["Home", "/home", "exact", "Right quick-navigation sidebar", "creatorDiscovery"],
  ["Reels", "/reels", "exact", "Reels navigation rail", "reels"],
  ["Live", "/live", "prefix", "Live session actions", "live"],
  ["Gaming", "/gaming", "exact", "Game library sidebar", "gaming"],
  ["News", "/news", "prefix", "Topics and source header", "news"],
  ["Purchases", "/purchases", "prefix", "Receipt and access panel", "purchases"],
  ["Trending", "/trending", "exact", "Trending sidebar", "trending"],
  ["Rooms", "/rooms", "exact", "Room controls", "rooms"],
  ["Profile", "/profile/", "prefix", "Profile action corner", "profile"],
  ["Home", "/home", "exact", "Feed filter tabs", "homeFeed"],
  ["Home", "/home", "exact", "Post reactions row", "homeFeed"],
  ["Home", "/home", "exact", "Account sidebar card", "profile"],
  ["Search", "/search", "exact", "Search type filters", "search"],
  ["Search", "/search", "exact", "Search result list edge", "search"],
  ["Messages", "/messages", "exact", "Chat header actions", "messages"],
  ["Messages", "/messages", "exact", "Message composer", "messages"],
  ["Notifications", "/notifications", "exact", "Notification filter tabs", "notifications"],
  ["Friends", "/friends", "exact", "Friend requests panel", "friends"],
  ["Friends", "/friends", "exact", "People suggestions panel", "friends"],
  ["Find Friends", "/find-friends", "exact", "People discovery filters", "findFriends"],
  ["Find Friends", "/find-friends", "exact", "Suggested person card", "findFriends"],
  ["Trending", "/trending", "exact", "Trending topic cards", "trending"],
  ["News", "/news", "prefix", "Top story rail", "news"],
  ["News", "/news", "prefix", "News source list", "news"],
  ["Gaming", "/gaming", "exact", "Featured game banner", "gaming"],
  ["Gaming", "/gaming", "exact", "Game control area", "gaming"],
  ["Reels", "/reels", "exact", "Playback action controls", "reels"],
  ["Live", "/live", "prefix", "Live directory header", "live"],
  ["Live", "/live", "prefix", "Broadcast cards", "live"],
  ["Rooms", "/rooms", "exact", "Room discovery list", "rooms"],
  ["Profile", "/profile/", "prefix", "Cover and profile controls", "profile"],
  ["Profile", "/profile/", "prefix", "Profile content tabs", "profile"],
  ["Dashboard", "/dashboard", "exact", "Professional insights header", "dashboard"],
  ["Dashboard", "/dashboard", "exact", "Dashboard action panel", "dashboard"],
  ["Memories", "/memories", "exact", "Year and date filters", "memories"],
  ["Memories", "/memories", "exact", "Memory collection grid", "memories"],
  ["Saved", "/saved", "exact", "Saved collection sidebar", "saved"],
  ["Saved", "/saved", "exact", "Saved item cards", "saved"],
  ["Groups", "/groups", "exact", "Group navigation sidebar", "groups"],
  ["Groups", "/groups", "exact", "Group discovery cards", "groups"],
  ["Settings", "/settings", "exact", "Settings hub menu", "settings"],
  ["Display Settings", "/settings/display", "exact", "Theme and accessibility controls", "display"],
  ["Events", "/events", "exact", "Events calendar and list", "events"],
  ["Birthdays", "/birthdays", "exact", "Upcoming birthdays sidebar", "birthdays"],
];

const PLACEMENT_DEFINITIONS = Array.from(
  { length: TOTAL_DISCOVERY_STARS },
  (_, index) => BASE_PLACEMENT_DEFINITIONS[index % BASE_PLACEMENT_DEFINITIONS.length]
);

export const DISCOVERY_PLACEMENTS = PLACEMENT_DEFINITIONS.map(
  ([page, route, match, zone, tipKey], index) => ({
    id: index + 1,
    page,
    route,
    match,
    zone,
    tipKey,
    ...STAR_POSITIONS[index],
  })
);

const LEARNING_GUIDES = {
  search: { title: "Search across Tengacion", description: "Use Search and its filters to find people, posts, music, books, and more.", actionLabel: "Open Search", path: "/search" },
  messages: { title: "Keep conversations together", description: "Messages lets you open recent chats, use conversation actions, and send new messages.", actionLabel: "Open Messages", path: "/messages" },
  notifications: { title: "See what needs your attention", description: "Notifications collects reactions, requests, updates, and account activity in one place.", actionLabel: "Open Notifications", path: "/notifications" },
  homeStories: { title: "Discover Stories", description: "Stories appear near the top of Home for watching and sharing short updates.", actionLabel: "Show me Stories", path: "/home", action: "stories" },
  homePost: { title: "Share from the Home feed", description: "The post composer lets you publish text, photos, videos, and reels.", actionLabel: "Create a Post", path: "/home", action: "create_post" },
  friends: { title: "Manage your friendships", description: "Friends brings requests, current connections, and people suggestions together.", actionLabel: "Open Friends", path: "/friends" },
  creatorDiscovery: { title: "Find Tengacion creators", description: "Creator discovery lets you browse talent and open public creator pages.", actionLabel: "Find Creators", path: "/find-creators" },
  reels: { title: "Watch short-form Reels", description: "Reels provides vertical video playback and interaction controls.", actionLabel: "Open Reels", path: "/reels" },
  live: { title: "Explore live broadcasts", description: "Live shows active sessions, upcoming broadcasts, and viewing controls.", actionLabel: "Open Live", path: "/live" },
  gaming: { title: "Play inside Gaming", description: "Gaming combines featured titles, the game library, and playable controls.", actionLabel: "Open Gaming", path: "/gaming" },
  news: { title: "Read trusted News", description: "News organizes current stories by topic, source, and publisher context.", actionLabel: "Open News", path: "/news" },
  purchases: { title: "Review your purchases", description: "Purchases keeps receipts and access details connected to your account.", actionLabel: "Open Purchases", path: "/purchases" },
  trending: { title: "See what is trending", description: "Trending highlights active conversations and popular content across Tengacion.", actionLabel: "Open Trending", path: "/trending" },
  rooms: { title: "Join community Rooms", description: "Rooms helps you discover topic spaces and enter community conversations.", actionLabel: "Open Rooms", path: "/rooms" },
  profile: { title: "Know your Profile space", description: "Your profile controls how your identity, details, and activity appear on Tengacion.", actionLabel: "Open My Profile", path: "/profile/:username" },
  homeFeed: { title: "Navigate the Home feed", description: "Feed controls help you browse posts and interact through reaction and sharing actions.", actionLabel: "Open Home", path: "/home" },
  findFriends: { title: "Discover people", description: "Find Friends provides filters and suggestions for building new connections.", actionLabel: "Find Friends", path: "/find-friends" },
  dashboard: { title: "Understand your Dashboard", description: "The professional dashboard brings account insights and useful actions together.", actionLabel: "Open Dashboard", path: "/dashboard" },
  memories: { title: "Return to Memories", description: "Memories groups earlier posts and moments with helpful date filters.", actionLabel: "Open Memories", path: "/memories" },
  saved: { title: "Organize Saved content", description: "Saved keeps bookmarked items and collections ready for later.", actionLabel: "Open Saved", path: "/saved" },
  groups: { title: "Explore Groups", description: "Groups brings community navigation, discovery, and membership spaces together.", actionLabel: "Open Groups", path: "/groups" },
  settings: { title: "Control your account settings", description: "The Settings hub links security, privacy, notifications, display, and sound controls.", actionLabel: "Open Settings", path: "/settings" },
  display: { title: "Choose your display experience", description: "Display settings let you change themes and accessibility preferences.", actionLabel: "Open Display Settings", path: "/settings/display" },
  events: { title: "Discover Events", description: "Events helps you review upcoming activities and community dates.", actionLabel: "Open Events", path: "/events" },
  birthdays: { title: "Remember Birthdays", description: "Birthdays highlights upcoming celebrations and related actions.", actionLabel: "Open Birthdays", path: "/birthdays" },
};

export const DISCOVERY_TIPS = DISCOVERY_PLACEMENTS.map((placement) => ({
  ...LEARNING_GUIDES[placement.tipKey],
  description: `${LEARNING_GUIDES[placement.tipKey].description} This checkpoint is near the ${placement.zone.toLowerCase()}.`,
}));

export const speakOutcome = ({ name, won, customerCarePhone }) => {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    typeof window.SpeechSynthesisUtterance !== "function"
  ) {
    return;
  }

  const safeName = String(name || "friend").trim().slice(0, 80) || "friend";
  const message = won
    ? `Congratulations! ${safeName}, you won five thousand Naira. Kindly contact the Customer Care team via ${customerCarePhone} to claim your winnings.`
    : `Keep searching, ${safeName}. You might just be lucky.`;
  const utterance = new window.SpeechSynthesisUtterance(message);
  utterance.rate = 0.92;
  utterance.pitch = won ? 1.08 : 1;
  utterance.volume = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
};
