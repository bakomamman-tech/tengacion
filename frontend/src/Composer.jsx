export default function Composer() {
  return (
    <div className="card">
      <input placeholder="What's on your mind?" />

      <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
        <button>📷 Photo</button>
        <button>🎥 Video</button>
        <button>😊 Feeling</button>
      </div>
    </div>
  );
}
