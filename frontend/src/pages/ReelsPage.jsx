import { Link } from "react-router-dom";
import Navbar from "../Navbar";
import Sidebar from "../Sidebar";

export default function ReelsPage({ user }) {
  return (
    <>
      <Navbar user={user} />
      <div className="app-shell">
        <aside className="sidebar">
          <Sidebar user={user} />
        </aside>

        <main className="feed">
          <section className="card media-page-header">
            <h2>Reels</h2>
            <p>
              Watch short-form videos, discover creators, and catch quick moments that matter.
            </p>
            <Link to="/home" className="btn-secondary media-page-home-link">
              Back to Home
            </Link>
          </section>

          <section className="card media-page-placeholder">
            <h3>Reels stream coming soon</h3>
            <p>Fresh creator reels and personalized recommendations will show here.</p>
          </section>
        </main>
      </div>
    </>
  );
}
