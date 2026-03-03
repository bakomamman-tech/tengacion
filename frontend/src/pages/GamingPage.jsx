import { Link } from "react-router-dom";
import Navbar from "../Navbar";
import Sidebar from "../Sidebar";

export default function GamingPage({ user }) {
  return (
    <>
      <Navbar user={user} />
      <div className="app-shell">
        <aside className="sidebar">
          <Sidebar user={user} />
        </aside>

        <main className="feed">
          <section className="card media-page-header">
            <h2>Gaming</h2>
            <p>
              Explore gaming clips, live highlights, and creator communities in one place.
            </p>
            <Link to="/home" className="btn-secondary media-page-home-link">
              Back to Home
            </Link>
          </section>

          <section className="card media-page-placeholder">
            <h3>Gaming feed coming soon</h3>
            <p>Curated streams, tournaments, and gameplay trends will appear here.</p>
          </section>
        </main>
      </div>
    </>
  );
}
