import "./creator/creator-workspace.css";

export default function CopyrightPolicy() {
  return (
    <main className="creator-policy-shell">
      <section className="creator-policy-card card">
        <h1>Copyright Policy</h1>
        <p>
          Tengacion screens creator uploads with metadata and duplicate checks before publication. Content that appears
          suspicious, duplicated, or rights-sensitive may be flagged for review or blocked from automatic publication.
        </p>
        <p>
          Creators are responsible for ensuring that every upload is owned by them or licensed for use. Screening is
          designed to be expandable so Tengacion can integrate stronger fingerprinting and similarity systems over time.
        </p>
        <p>
          Flagged uploads remain visible inside the creator workspace with a verification status, notes, and a clear
          explanation of whether manual review is required.
        </p>
      </section>
    </main>
  );
}
