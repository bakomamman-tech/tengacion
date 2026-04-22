import { Navigate, useParams } from "react-router-dom";
import { buildCreatorPublicPath } from "../lib/publicRoutes";

export default function CreatorSongs() {
  const { creatorId } = useParams();
  return <Navigate to={buildCreatorPublicPath({ creatorId, tab: "music" })} replace />;
}
