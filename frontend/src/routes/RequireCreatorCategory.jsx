import CreatorRestrictedAccess from "../components/creator/CreatorRestrictedAccess";
import { useCreatorWorkspace } from "../components/creator/useCreatorWorkspace";
import { CREATOR_CATEGORY_CONFIG } from "../components/creator/creatorConfig";

export default function RequireCreatorCategory({ category, children }) {
  const { creatorProfile } = useCreatorWorkspace();
  const enabled = Array.isArray(creatorProfile?.creatorTypes)
    ? creatorProfile.creatorTypes.includes(category)
    : false;

  if (!enabled) {
    return (
      <CreatorRestrictedAccess
        title={`${CREATOR_CATEGORY_CONFIG[category]?.title || "This lane"} is not enabled`}
        message={`${CREATOR_CATEGORY_CONFIG[category]?.title || "This category"} is not enabled on your creator profile yet. Update your creator settings or return to the content dashboard.`}
      />
    );
  }

  return children;
}
