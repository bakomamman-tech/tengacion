import { useEffect, useState } from "react";
import { createRoom, getRooms, joinRoom, leaveRoom } from "../api";

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const loadRooms = async () => {
    try {
      const data = await getRooms();
      setRooms(Array.isArray(data) ? data : []);
    } catch {
      setRooms([]);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const submitRoom = async () => {
    if (!name.trim() || busy) return;
    try {
      setBusy(true);
      await createRoom({ name, description });
      setName("");
      setDescription("");
      await loadRooms();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rooms-page">
      <section className="card rooms-create">
        <h2>Community Rooms</h2>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Room name"
        />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description"
        />
        <button type="button" onClick={submitRoom} disabled={busy || !name.trim()}>
          {busy ? "Creating..." : "Create room"}
        </button>
      </section>

      <section className="rooms-grid">
        {rooms.map((room) => (
          <article className="card rooms-item" key={room._id}>
            <h3>{room.name}</h3>
            <p>{room.description || "No description yet."}</p>
            <div className="rooms-actions">
              <button type="button" onClick={() => joinRoom(room._id)}>
                Join
              </button>
              <button type="button" className="btn-secondary" onClick={() => leaveRoom(room._id)}>
                Leave
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
