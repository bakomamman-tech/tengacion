import { Navigate, useParams } from "react-router-dom";

export default function CreatorSongs() {
  const { creatorId } = useParams();
  return <Navigate to={`/creators/${creatorId}/music`} replace />;
}
