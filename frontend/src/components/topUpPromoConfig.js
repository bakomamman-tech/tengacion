export const STAR_POSITIONS = [
  { x: 91, y: 8, delay: 0.4, scale: 0.78 },
  { x: 3.5, y: 24, delay: 2.1, scale: 0.66 },
  { x: 96, y: 10, delay: 4.3, scale: 0.72 },
  { x: 18, y: 20, delay: 1.2, scale: 0.84 },
  { x: 53, y: 33, delay: 5.4, scale: 0.64 },
  { x: 4, y: 63, delay: 3.2, scale: 0.7 },
  { x: 95, y: 49, delay: 0.8, scale: 0.62 },
  { x: 8, y: 82, delay: 4.8, scale: 0.82 },
  { x: 91, y: 73, delay: 2.8, scale: 0.74 },
  { x: 15, y: 49, delay: 6.1, scale: 0.68 },
  { x: 82, y: 19, delay: 1.7, scale: 0.8 },
  { x: 91, y: 49, delay: 3.7, scale: 0.64 },
  { x: 3.5, y: 40, delay: 5.8, scale: 0.76 },
  { x: 78, y: 84, delay: 2.4, scale: 0.7 },
  { x: 95, y: 87, delay: 4.9, scale: 0.82 },
];

export const DISCOVERY_PLACEMENTS = [
  { id: 1, page: "Search", route: "/search", match: "exact", zone: "Navbar search and results header" },
  { id: 2, page: "Messages", route: "/messages", match: "exact", zone: "Conversation sidebar" },
  { id: 3, page: "Notifications", route: "/notifications", match: "exact", zone: "Navbar notification corner" },
  { id: 4, page: "Home", route: "/home", match: "exact", zone: "Stories tray" },
  { id: 5, page: "Home", route: "/home", match: "exact", zone: "Post composer" },
  { id: 6, page: "Friends", route: "/friends", match: "exact", zone: "Left navigation sidebar" },
  { id: 7, page: "Home", route: "/home", match: "exact", zone: "Right quick-navigation sidebar" },
  { id: 8, page: "Reels", route: "/reels", match: "exact", zone: "Reels navigation rail" },
  { id: 9, page: "Live", route: "/live", match: "prefix", zone: "Live session actions" },
  { id: 10, page: "Gaming", route: "/gaming", match: "exact", zone: "Game library sidebar" },
  { id: 11, page: "News", route: "/news", match: "prefix", zone: "Topics and source header" },
  { id: 12, page: "Purchases", route: "/purchases", match: "prefix", zone: "Receipt and access panel" },
  { id: 13, page: "Trending", route: "/trending", match: "exact", zone: "Trending sidebar" },
  { id: 14, page: "Rooms", route: "/rooms", match: "exact", zone: "Room controls" },
  { id: 15, page: "Profile", route: "/profile/", match: "prefix", zone: "Profile action corner" },
].map((placement, index) => ({ ...placement, ...STAR_POSITIONS[index] }));

export const DISCOVERY_TIPS = [
  {
    title: "Search across Tengacion",
    description: "Use Search to find people, creators, posts, music, books, and more from one place.",
    actionLabel: "Open Search",
    path: "/search",
  },
  {
    title: "Keep conversations together",
    description: "Messages is your private space for opening conversations and returning to recent chats.",
    actionLabel: "Open Messages",
    path: "/messages",
  },
  {
    title: "See what needs your attention",
    description: "Notifications collects reactions, requests, updates, and activity around your account.",
    actionLabel: "Open Notifications",
    path: "/notifications",
  },
  {
    title: "Discover Stories",
    description: "Stories appear near the top of Home. Tap a story to watch it or use the create tile to share yours.",
    actionLabel: "Show me Stories",
    path: "/home",
    action: "stories",
  },
  {
    title: "Share from the Home feed",
    description: "The “What's on your mind?” space opens the post composer for text, photos, videos, and reels.",
    actionLabel: "Create a Post",
    path: "/home",
    action: "create_post",
  },
  {
    title: "Manage your friendships",
    description: "Friends brings your connections, requests, and people discovery into one clear workspace.",
    actionLabel: "Open Friends",
    path: "/friends",
  },
  {
    title: "Find Tengacion creators",
    description: "Creator discovery lets you browse talent and open public creator pages without placing promo chests there.",
    actionLabel: "Find Creators",
    path: "/find-creators",
  },
  {
    title: "Watch short-form Reels",
    description: "Reels is the fast, vertical viewing space for short videos and creator moments.",
    actionLabel: "Open Reels",
    path: "/reels",
  },
  {
    title: "Explore live rooms",
    description: "Live shows active sessions and upcoming broadcasts, with controls for watching or going live.",
    actionLabel: "Open Live",
    path: "/live",
  },
  {
    title: "Play inside Gaming",
    description: "Gaming brings Tengacion's playable experiences and game controls into one dedicated space.",
    actionLabel: "Open Gaming",
    path: "/gaming",
  },
  {
    title: "Read trusted News",
    description: "News brings current stories, topics, sources, and publisher context into one discovery space.",
    actionLabel: "Open News",
    path: "/news",
  },
  {
    title: "Review your purchases",
    description: "Purchases keeps receipts and access details for the content and products connected to your account.",
    actionLabel: "Open Purchases",
    path: "/purchases",
  },
  {
    title: "See what is trending",
    description: "Trending highlights active conversations and popular content across Tengacion.",
    actionLabel: "Open Trending",
    path: "/trending",
  },
  {
    title: "Join community Rooms",
    description: "Rooms helps you discover topic spaces and enter conversations with other Tengacion users.",
    actionLabel: "Open Rooms",
    path: "/rooms",
  },
  {
    title: "Know your Profile space",
    description: "Your profile is where you review how your identity, details, and activity appear on Tengacion.",
    actionLabel: "Open My Profile",
    path: "/profile/:username",
  },
];

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
