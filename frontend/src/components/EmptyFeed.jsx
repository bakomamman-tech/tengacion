import { PlusSquare, Users, Camera } from "lucide-react";
import Button from "./ui/Button";

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
          <Button onClick={onCreate} variant="primary" className="primary">
            <PlusSquare size={16} />
            Create Post
          </Button>

          <Button className="secondary">
            <Camera size={16} />
            Share a photo
          </Button>
        </div>
      </div>
    </div>
  );
}
