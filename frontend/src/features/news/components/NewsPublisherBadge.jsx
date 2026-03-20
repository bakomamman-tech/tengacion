const COPY = {
  licensed: "Licensed",
  partner: "Partner",
  discovery: "Discovery",
};

export default function NewsPublisherBadge({ tier = "discovery" }) {
  return (
    <span className={`news-publisher-badge ${tier}`}>
      {COPY[tier] || COPY.discovery}
    </span>
  );
}
