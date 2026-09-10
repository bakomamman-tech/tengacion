import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiRequest, API_BASE } from "../api";
import "./external-readiness.css";

export default function ReadinessPacket() {
  const { shareId } = useParams();
  const [data, setData] = useState(null);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true; setData(null); setError("");
    apiRequest(`${API_BASE}/external-readiness/shares/${shareId}`).then((r) => { if (active) { setData(r); } }).catch((e) => { if (active) { setError(e.message); } });
    return () => { active = false; };
  }, [shareId]);
  return <main className="readiness-workspace"><h1>Shared Tengacion packet</h1>{error && <p role="alert">{error}</p>}{data && <>
    <h2>{data.packet.title}</h2><p>{data.packet.watermark}</p><p>{data.packet.summary}</p><h3>Scope</h3><p>{data.packet.scope}</p><h3>Exclusions</h3><p>{data.packet.exclusions}</p><p>Expires {new Date(data.packet.expiresAt).toLocaleString()}</p><p>{data.packet.withdrawalRule}</p>
    <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(""); try { await apiRequest(`${API_BASE}/external-readiness/shares/${shareId}/questions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) }); setQuestion(""); setData(await apiRequest(`${API_BASE}/external-readiness/shares/${shareId}`)); } catch (err) { setError(err.message); setData(null); } finally { setBusy(false); } }}><label>Ask a question<textarea required maxLength={4000} value={question} onChange={(e) => setQuestion(e.target.value)} /></label><button disabled={busy}>Submit question</button></form>
    <h3>Your questions</h3>{data.questions.map((q) => <article key={q.id}><p>{q.question}</p><p>{q.response || "Awaiting a reviewed response"}</p></article>)}
  </>}</main>;
}
