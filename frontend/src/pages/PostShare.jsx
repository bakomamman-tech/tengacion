import { useLocation, useNavigate, useParams } from "react-router-dom";

import PostShareModal from "../components/share/PostShareModal";

export default function PostSharePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { postId } = useParams();

  return (
    <PostShareModal
      open
      postId={postId}
      initialPost={location.state?.post || null}
      onClose={() => {
        if (window.history.length > 1) {
          navigate(-1);
          return;
        }

        navigate("/home");
      }}
    />
  );
}
