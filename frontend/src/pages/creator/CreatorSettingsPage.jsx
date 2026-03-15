import { useState } from "react";
import toast from "react-hot-toast";

import { updateCreatorWorkspaceProfile } from "../../api";
import CreatorRegistrationForm from "../../components/creator/CreatorRegistrationForm";
import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";

export default function CreatorSettingsPage() {
  const { creatorProfile, refreshWorkspace } = useCreatorWorkspace();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      await updateCreatorWorkspaceProfile(values);
      await refreshWorkspace();
      toast.success("Creator profile updated");
    } catch (err) {
      toast.error(err?.message || "Could not update creator profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="creator-page-stack">
      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Creator profile settings</h2>
            <p>Update your creator identity, enabled content lanes, and payout details.</p>
          </div>
        </div>
        <CreatorRegistrationForm
          initialValues={creatorProfile}
          submitLabel="Save creator profile"
          loading={loading}
          onSubmit={handleSubmit}
        />
      </section>
    </div>
  );
}
