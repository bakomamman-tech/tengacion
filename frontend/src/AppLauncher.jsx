export default function AppLauncher() {
  return (
    <div style={{
      position: "absolute",
      top: "60px",
      right: "20px",
      background: "#efe7dc",
      padding: "16px",
      borderRadius: "12px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.15)"
    }}>
      <strong>Tengacion Apps</strong>
      <div style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
        <div>🟦 PyrexxBook</div>
        <div>💬 Messenger</div>
        <div>📸 Stories</div>
        <div>🤖 AI (Soon)</div>
      </div>
    </div>
  );
}
