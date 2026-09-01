const label = (value = "") => String(value || "")
  .replace(/_/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function CreatorServicesPanel({ creatorServices = {} }) {
  const programs = Array.isArray(creatorServices.programs) ? creatorServices.programs : [];
  const enrollments = Array.isArray(creatorServices.enrollments) ? creatorServices.enrollments : [];

  return (
    <section className="creator-panel" data-testid="creator-services-panel">
      <div className="creator-panel-head">
        <div>
          <h2>Creator services</h2>
          <p>Structured business support with a named owner, measurable outcome, review date, and clear escalation path.</p>
        </div>
        <span className="creator-status-badge neutral">{Number(creatorServices.summary?.active || 0)} active</span>
      </div>

      {enrollments.length ? (
        <div className="creator-launch-plan-list">
          {enrollments.map((enrollment) => (
            <article key={enrollment.id} className="creator-launch-plan-card">
              <div>
                <strong>{label(enrollment.programKey)}</strong>
                <p>{label(enrollment.status)} · owner {enrollment.ownerName || enrollment.ownerRole}</p>
                <small>{enrollment.progress?.completedSteps || 0} of {enrollment.progress?.totalSteps || 0} steps · review {enrollment.reviewAt ? new Date(enrollment.reviewAt).toLocaleDateString() : "not set"}</small>
              </div>
              <span className={`creator-status-badge ${enrollment.status === "completed" ? "success" : "neutral"}`}>{label(enrollment.serviceTier)}</span>
            </article>
          ))}
        </div>
      ) : (
        <div className="creator-empty-card">No service enrollment is active. Basic creator support remains available; premium services are never implied or auto-enrolled.</div>
      )}

      <details>
        <summary>View available program definitions</summary>
        <div className="creator-launch-playbook-grid">
          {programs.map((program) => (
            <article key={program.key} className="creator-launch-playbook">
              <strong>{program.title}</strong>
              <span>{program.expectedOutcome}</span>
              <small>Owner: {program.supportOwner}</small>
            </article>
          ))}
        </div>
      </details>
    </section>
  );
}
