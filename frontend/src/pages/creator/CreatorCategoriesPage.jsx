import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import { updateCreatorWorkspaceProfile } from "../../api";
import CreatorTypeSelector from "../../components/creator/CreatorTypeSelector";
import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import { CREATOR_CATEGORY_CONFIG } from "../../components/creator/creatorConfig";

const CATEGORY_ORDER = ["music", "books", "podcasts"];

export default function CreatorCategoriesPage() {
  const { creatorProfile, refreshWorkspace } = useCreatorWorkspace();
  const profileTypes = Array.isArray(creatorProfile?.creatorTypes) ? creatorProfile.creatorTypes : [];
  const [selectedTypes, setSelectedTypes] = useState(profileTypes);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedTypes(profileTypes);
  }, [profileTypes.join("|")]);

  const hasChanges = useMemo(() => {
    if (profileTypes.length !== selectedTypes.length) {
      return true;
    }
    return profileTypes.some((type) => !selectedTypes.includes(type));
  }, [profileTypes, selectedTypes]);

  const saveCategories = async () => {
    try {
      setSaving(true);
      await updateCreatorWorkspaceProfile({
        fullName: creatorProfile.fullName,
        phoneNumber: creatorProfile.phoneNumber,
        accountNumber: creatorProfile.accountNumber,
        country: creatorProfile.country,
        countryOfResidence: creatorProfile.countryOfResidence,
        socialHandles: creatorProfile.socialHandles,
        creatorTypes: selectedTypes,
        acceptedTerms: creatorProfile.acceptedTerms,
        acceptedCopyrightDeclaration: creatorProfile.acceptedCopyrightDeclaration,
      });
      await refreshWorkspace();
      toast.success("Creator categories updated");
    } catch (err) {
      toast.error(err?.message || "Could not update creator categories");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="creator-page-stack">
      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Content Categories</h2>
            <p>
              Visit any content lane here, tick the ones you want active on your creator profile, save, and then jump
              straight into registering uploads there too.
            </p>
          </div>
          <Link className="creator-secondary-btn" to="/creator/dashboard">
            Back to overview
          </Link>
        </div>

        <CreatorTypeSelector value={selectedTypes} onChange={setSelectedTypes} />

        <div className="creator-form-actions">
          <button
            type="button"
            className="creator-primary-btn"
            onClick={saveCategories}
            disabled={saving || !selectedTypes.length || !hasChanges}
          >
            {saving ? "Saving..." : "Save category selection"}
          </button>
        </div>
      </section>

      <section className="creator-panel-grid">
        {CATEGORY_ORDER.map((key) => {
          const item = CREATOR_CATEGORY_CONFIG[key];
          const enabled = selectedTypes.includes(key);

          return (
            <article key={key} className="creator-category-card card">
              <div className="creator-category-top">
                <span className="creator-category-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </div>
              <div className="creator-category-foot">
                <span className={`creator-status-badge ${enabled ? "success" : "neutral"}`}>
                  {enabled ? "Enabled" : "Not enabled"}
                </span>
                {enabled ? (
                  <Link className="creator-secondary-btn" to={item.route}>
                    Open {item.shortTitle}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="creator-secondary-btn"
                    onClick={() => setSelectedTypes((current) => [...new Set([...current, key])])}
                  >
                    Enable {item.shortTitle}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
