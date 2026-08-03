export default function Composer() {
  return (
    <div className="card">
      <input placeholder="What's on your mind?" readOnly />

      <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
        <button type="button" disabled title="Use the Home post composer to add a photo">📷 Photo</button>
        <button type="button" disabled title="Use the Home post composer to add a video">🎥 Video</button>
        <button type="button" disabled title="Use the Home post composer to add a feeling">😊 Feeling</button>
      </div>
    </div>
  );
}
