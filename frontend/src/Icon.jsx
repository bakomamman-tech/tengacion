export const Icon = ({ name, size = 22, active }) => {
  const color = active ? "#1877f2" : "#65676b";

  const icons = {
    home: (
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z" />
    ),
    watch: (
      <path d="M2 7h20v13H2z M7 3h10 M7 23h10" />
    ),
    groups: (
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" />
    ),
    market: (
      <path d="M3 6h18l-2 10H5L3 6z M7 20a1 1 0 1 0 0 2 1 1 0 0 0 0-2z M17 20a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
    ),
    games: (
      <path d="M21 6H3v12h18V6z M8 12h.01 M16 12h.01" />
    ),
    bell: (
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0" />
    ),
    message: (
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    )
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icons[name]}
    </svg>
  );
};
