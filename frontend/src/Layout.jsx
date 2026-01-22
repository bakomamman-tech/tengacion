export default function Layout({ left, center, right }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        {left}
      </aside>

      <main className="main-feed">
        {center}
      </main>

      <section className="messenger">
        {right}
      </section>
    </div>
  );
}

