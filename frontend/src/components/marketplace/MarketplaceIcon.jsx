const ICON_PATHS = {
  arrowRight: ["M5 12h14", "m13 6 6 6-6 6"],
  badgeCheck: [
    "m9.4 3.2 2.6-1 2.6 1 2.8-.2 1.4 2.5 2.2 1.8-.6 2.8.6 2.8-2.2 1.8-1.4 2.5-2.8-.2-2.6 1-2.6-1-2.8.2-1.4-2.5-2.2-1.8.6-2.8-.6-2.8 2.2-1.8 1.4-2.5Z",
    "m9 12 2 2 4-4",
  ],
  compass: [
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
    "m15.5 8.5-2 5-5 2 2-5Z",
  ],
  grid: ["M4 4h6v6H4Z", "M14 4h6v6h-6Z", "M4 14h6v6H4Z", "M14 14h6v6h-6Z"],
  mapPin: [
    "M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z",
    "M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  ],
  package: [
    "m4 7 8-4 8 4-8 4Z",
    "M4 7v10l8 4 8-4V7",
    "M12 11v10",
    "m8 5 8 4",
  ],
  plus: ["M12 5v14", "M5 12h14"],
  receipt: [
    "M6 3v18l3-2 3 2 3-2 3 2V3l-3 2-3-2-3 2Z",
    "M9 9h6",
    "M9 13h5",
  ],
  search: ["m20 20-3.8-3.8", "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z"],
  shieldCheck: ["M12 3 5 6v5c0 4.6 2.9 8.2 7 10 4.1-1.8 7-5.4 7-10V6Z", "m9 12 2 2 4-4"],
  sliders: ["M4 7h10", "M18 7h2", "M4 17h2", "M10 17h10", "M14 4v6", "M6 14v6"],
  sparkles: [
    "m12 3 1.2 3.3L16.5 8l-3.3 1.2L12 12.5l-1.2-3.3L7.5 8l3.3-1.7Z",
    "m18.5 13 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z",
    "m5.5 14 1 2.5L9 17.5l-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z",
  ],
  store: [
    "M4 10v10h16V10",
    "M3 10l2-6h14l2 6",
    "M8 20v-6h8v6",
    "M3 10a3 3 0 0 0 5 2 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 5-2",
  ],
  truck: [
    "M3 6h11v11H3Z",
    "M14 10h4l3 3v4h-7Z",
    "M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
    "M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  ],
  wallet: [
    "M4 6.5A2.5 2.5 0 0 1 6.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5Z",
    "M16 10h5v4h-5a2 2 0 0 1 0-4Z",
  ],
  x: ["m7 7 10 10", "M17 7 7 17"],
};

export default function MarketplaceIcon({ name, size = 18, className = "" }) {
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
