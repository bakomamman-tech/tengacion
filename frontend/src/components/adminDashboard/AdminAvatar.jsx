const gradients = [
  "linear-gradient(135deg, #8fb7ff 0%, #5a7fff 100%)",
  "linear-gradient(135deg, #88e0d0 0%, #3a8f8f 100%)",
  "linear-gradient(135deg, #ffc28c 0%, #d96b5b 100%)",
  "linear-gradient(135deg, #d1a4ff 0%, #6a7bff 100%)",
  "linear-gradient(135deg, #9feaa8 0%, #2e8f64 100%)",
];

const getInitials = (name = "") =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

const getGradient = (name = "") => {
  const score = [...String(name || "")].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return gradients[score % gradients.length];
};

export default function AdminAvatar({ name, src = "", size = 44, status = false, className = "" }) {
  const resolvedSize = `${size}px`;
  const initials = getInitials(name);

  return (
    <span
      className={`tdash-avatar ${className}`.trim()}
      style={{ width: resolvedSize, height: resolvedSize, backgroundImage: src ? "none" : getGradient(name) }}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" /> : <span className="tdash-avatar__initials">{initials}</span>}
      {status ? <span className="tdash-avatar__status" /> : null}
    </span>
  );
}
