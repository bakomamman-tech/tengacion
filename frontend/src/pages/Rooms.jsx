import { useCallback, useEffect, useState } from "react";
import { createRoom, getRooms, joinRoom, leaveRoom } from "../api";

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [membershipBusyKey, setMembershipBusyKey] = useState("");
  const [error, setError] = useState("");

  const loadRooms = useCallback(async () => {
    try {
      const data = await getRooms();
      setRooms(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setRooms([]);
      setError(err?.message || "Failed to load rooms");
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const submitRoom = async () => {
    if (!name.trim() || busy) {return;}
    try {
      setBusy(true);
      setError("");
      await createRoom({ name, description });
      setName("");
      setDescription("");
      await loadRooms();
    } catch (err) {
      setError(err?.message || "Failed to create room");
    } finally {
      setBusy(false);
    }
  };

  const updateMembership = async (room, action) => {
    const roomId = String(room?._id || "");
    if (!roomId || membershipBusyKey) {return;}

    try {
      setMembershipBusyKey(`${roomId}:${action}`);
      setError("");
      if (action === "join") {
        await joinRoom(roomId);
      } else {
        await leaveRoom(roomId);
      }
      await loadRooms();
    } catch (err) {
      setError(err?.message || `Failed to ${action} room`);
    } finally {
      setMembershipBusyKey("");
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
        {error ? <p role="alert">{error}</p> : null}
        {rooms.map((room) => (
          <article className="card rooms-item" key={room._id}>
            <h3>{room.name}</h3>
            <p>{room.description || "No description yet."}</p>
            <div className="rooms-actions">
              {room.isOwner ? <span>Owner</span> : room.isMember ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void updateMembership(room, "leave")}
                  disabled={Boolean(membershipBusyKey)}
                >
                  {membershipBusyKey === `${room._id}:leave` ? "Leaving..." : "Leave"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void updateMembership(room, "join")}
                  disabled={Boolean(membershipBusyKey)}
                >
                  {membershipBusyKey === `${room._id}:join` ? "Joining..." : "Join"}
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
