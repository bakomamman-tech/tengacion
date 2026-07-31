import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import { loadKadahiveAdmin, loadKadahiveMembers, updateKadahiveMember } from "../../api";
import AdminShell from "../../components/AdminShell";
import "./kadahive.css";

const formatDate = (value) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

export default function KadahiveSuperAdminPage({ user }) {
  const [overview, setOverview] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewPayload, memberPayload] = await Promise.all([
        loadKadahiveAdmin(),
        loadKadahiveMembers(),
      ]);
      setOverview(overviewPayload);
      setMembers(memberPayload?.members || []);
    } catch (error) {
      toast.error(error?.message || "Unable to load Kadahive oversight");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateMember = async (member, patch) => {
    try {
      await updateKadahiveMember(member._id, patch);
      toast.success("Kadahive authority updated");
      await load();
    } catch (error) {
      toast.error(error?.message || "Unable to update this member");
    }
  };

  return (
    <AdminShell
      title="Kadahive Institution"
      subtitle="Tengacion super-admin oversight for Kadahive access, governance and operations."
      user={user}
      actions={
        <div className="kh-super-actions">
          <Link to="/kadahive">Public site</Link>
          <Link to="/kadahive/admin">Open institution console</Link>
        </div>
      }
    >
      <div className="kh-super">
        <section className="kh-super__banner">
          <div>
            <span>Connected institution · Active</span>
            <h2>KADA Hive Innovation &amp; Tech Hub</h2>
            <p>
              11B Sambo Road, City Centre, Kaduna · Institution admins can manage Kadahive
              content and members, while Tengacion retains platform-wide authority.
            </p>
          </div>
          <div className="kh-super__hierarchy" aria-label="Authority hierarchy">
            <span>Tengacion super admin</span>
            <i>→</i>
            <span>Kadahive admin</span>
            <i>→</i>
            <span>Member</span>
          </div>
        </section>

        <section className="kh-super__stats">
          <article>
            <span>Total members</span>
            <strong>{overview?.stats?.totalMembers || 0}</strong>
          </article>
          <article>
            <span>Kadahive admins</span>
            <strong>{overview?.stats?.adminMembers || 0}</strong>
          </article>
          <article>
            <span>Published events</span>
            <strong>{overview?.stats?.publishedEvents || 0}</strong>
          </article>
          <article>
            <span>Pending bookings</span>
            <strong>{overview?.stats?.pendingBookings || 0}</strong>
          </article>
        </section>

        <section className="kh-super__panel">
          <header>
            <div>
              <span>Authority management</span>
              <h2>Institution members and administrators</h2>
              <p>
                Only Tengacion administrators can promote or remove a Kadahive administrator.
              </p>
            </div>
            <button type="button" onClick={load} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </header>
          <div className="kh-super__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Joined</th>
                  <th>Authority</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member._id}>
                    <td>
                      <strong>{member.name}</strong>
                      <span>{member.email}</span>
                    </td>
                    <td>{formatDate(member.joinedAt)}</td>
                    <td>
                      <select
                        value={member.role}
                        onChange={(event) => updateMember(member, { role: event.target.value })}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Kadahive admin</option>
                      </select>
                    </td>
                    <td>
                      <select
                        value={member.status}
                        onChange={(event) => updateMember(member, { status: event.target.value })}
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
