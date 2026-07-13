const ICON_PATHS = {
  arrowLeft: ["m15 18-6-6 6-6", "M9 12h10"],
  arrowUpRight: ["M7 17 17 7", "M8 7h9v9"],
  badgeCheck: [
    "m9.4 3.2 2.6-1 2.6 1 2.8-.2 1.4 2.5 2.2 1.8-.6 2.8.6 2.8-2.2 1.8-1.4 2.5-2.8-.2-2.6 1-2.6-1-2.8.2-1.4-2.5-2.2-1.8.6-2.8-.6-2.8 2.2-1.8 1.4-2.5Z",
    "m9 12 2 2 4-4",
  ],
  book: [
    "M5 4.5h5.5A2.5 2.5 0 0 1 13 7v12H7a2 2 0 0 0-2 2Z",
    "M19 4.5h-3.5A2.5 2.5 0 0 0 13 7v12h4a2 2 0 0 1 2 2Z",
  ],
  check: ["m5 12 4 4L19 6"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"],
  layers: ["m12 3-9 5 9 5 9-5Z", "m3 12 9 5 9-5", "m3 16 9 5 9-5"],
  mapPin: ["M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z", "M12 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"],
  microphone: [
    "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0Z",
    "M5.5 11.5a6.5 6.5 0 0 0 13 0",
    "M12 18v3",
  ],
  music: ["M9 18V5l10-2v13", "M6.5 21A2.5 2.5 0 1 0 9 18.5 2.5 2.5 0 0 0 6.5 21Z", "M16.5 19a2.5 2.5 0 1 0 2.5-2.5 2.5 2.5 0 0 0-2.5 2.5Z"],
  reset: ["M4 7v5h5", "M5.7 17.2A8 8 0 1 0 6 6.4L4 8"],
  search: ["m20 20-3.8-3.8", "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z"],
  sliders: ["M4 7h10", "M18 7h2", "M4 17h2", "M10 17h10", "M14 4v6", "M6 14v6"],
  sparkles: ["m12 3 1.2 3.3L16.5 8l-3.3 1.2L12 12.5l-1.2-3.3L7.5 8l3.3-1.7Z", "m18.5 13 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z", "m5.5 14 1 2.5L9 17.5l-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z"],
  userPlus: ["M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M3 21a7 7 0 0 1 14 0", "M19 8v6", "M16 11h6"],
  users: ["M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M3 21a6 6 0 0 1 12 0", "M16 4.5a3.5 3.5 0 0 1 0 6.5", "M17 15a5 5 0 0 1 4 5"],
  wallet: ["M4 6.5A2.5 2.5 0 0 1 6.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5Z", "M16 10h5v4h-5a2 2 0 0 1 0-4Z"],
  x: ["m7 7 10 10", "M17 7 7 17"],
};

export default function CreatorDiscoveryIcon({ name, size = 18, className = "" }) {
  const paths = ICON_PATHS[name] || ICON_PATHS.sparkles;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
