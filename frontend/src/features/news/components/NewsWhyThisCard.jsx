export default function NewsWhyThisCard({ reasons = [], rights = {} }) {
  const canRenderFullText = Boolean(rights?.mode === "FULL_IN_APP" && rights?.allowBodyHtml);

  return (
    <div className="news-why-card">
      <strong>Why you're seeing this</strong>
      <ul>
        {(Array.isArray(reasons) && reasons.length
          ? reasons
          : ["Selected for relevance, recency, trust, and source diversity."]
        ).map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <p className="news-why-rights">
        {canRenderFullText
          ? "This publisher allows in-app article display for this story."
          : "Tengacion is showing a summary with source attribution and link-out access."}
      </p>
    </div>
  );
}
