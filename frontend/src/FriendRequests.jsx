import { useEffect, useState } from "react";
import {
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest
} from "./api";

export default function FriendRequests() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    getFriendRequests().then(setRequests);
  }, []);

  return (
    <div className="card">
      <h4>Friend Requests</h4>

      {requests.map(u => (
        <div key={u._id} style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{u.name}</span>

          <div>
            <button onClick={() => acceptFriendRequest(u._id)}>Accept</button>
            <button onClick={() => rejectFriendRequest(u._id)}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}
