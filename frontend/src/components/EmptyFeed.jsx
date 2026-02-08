import { PlusSquare, Users, Camera } from "lucide-react";

export default function EmptyFeed({ onCreate }) {
  return (
    <div className="empty-feed">
      <div className="empty-card">
        <div className="icon">
          <Users size={40} />
        </div>

        <h3>Your feed is quiet</h3>
        <p>
          Follow people or create your first post to start the conversation.
        </p>

        <div className="actions">
          <button onClick={onCreate} className="primary">
            <PlusSquare size={16} />
            Create Post
          </button>

          <button className="secondary">
            <Camera size={16} />
            Share a photo
          </button>
        </div>
      </div>
    </div>
  );
}
