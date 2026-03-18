import {
  getCreatorDashboardSummary,
  getCreatorPrivateContent,
  getCreatorWorkspaceProfile,
} from "../../api";

export async function loadCreatorWorkspaceBundle() {
  const [profilePayload, summaryPayload, contentPayload] = await Promise.all([
    getCreatorWorkspaceProfile(),
    getCreatorDashboardSummary(),
    getCreatorPrivateContent(),
  ]);

  return {
    creatorProfile:
      profilePayload ||
      summaryPayload?.creatorProfile ||
      contentPayload?.creatorProfile ||
      null,
    dashboard: {
      ...(summaryPayload || {}),
      content: contentPayload?.content || summaryPayload?.content || {},
    },
  };
}
