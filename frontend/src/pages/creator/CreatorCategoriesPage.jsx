import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import { updateCreatorWorkspaceProfile } from "../../api";
import CreatorTypeSelector from "../../components/creator/CreatorTypeSelector";
import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import { CREATOR_CATEGORY_CONFIG } from "../../components/creator/creatorConfig";

const CATEGORY_ORDER = ["music", "books", "podcasts"];

export default function CreatorCategoriesPage() {
  const { creatorProfile, setCreatorProfile } = useCreatorWorkspace();
  const savedTypesSignature = useMemo(
    () => (Array.isArray(creatorProfile?.creatorTypes) ? creatorProfile.creatorTypes.join("|") : ""),
    [creatorProfile?.creatorTypes]
  );
  const savedTypes = useMemo(
    () => (savedTypesSignature ? savedTypesSignature.split("|") : []),
    [savedTypesSignature]
  );
  const [selectedTypes, setSelectedTypes] = useState(savedTypes);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedTypes(savedTypes);
  }, [savedTypes, savedTypesSignature]);

  const hasChanges = useMemo(() => {
    if (savedTypes.length !== selectedTypes.length) {
      return true;
    }
    return savedTypes.some((type) => !selectedTypes.includes(type));
  }, [savedTypes, selectedTypes]);

  const saveCategories = async () => {
    try {
      setSaving(true);
      const response = await updateCreatorWorkspaceProfile({
        fullName: creatorProfile.fullName,
        displayName: creatorProfile.displayName,
        phoneNumber: creatorProfile.phoneNumber,
        accountNumber: creatorProfile.accountNumber,
        country: creatorProfile.country,
        countryOfResidence: creatorProfile.countryOfResidence,
        tagline: creatorProfile.tagline,
        bio: creatorProfile.bio,
        genres: creatorProfile.genres,
        socialHandles: creatorProfile.socialHandles,
        musicProfile: creatorProfile.musicProfile,
        booksProfile: creatorProfile.booksProfile,
        podcastsProfile: creatorProfile.podcastsProfile,
        creatorTypes: selectedTypes,
        acceptedTerms: creatorProfile.acceptedTerms,
        acceptedCopyrightDeclaration: creatorProfile.acceptedCopyrightDeclaration,
      });
      if (response?.creatorProfile) {
        setCreatorProfile(response.creatorProfile);
      }
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
        {hasChanges ? (
          <div className="creator-inline-notice warning">
            <strong>Unsaved changes</strong>
            <span>Save category selection to update your live creator workspace and sidebar.</span>
          </div>
        ) : (
          <div className="creator-inline-notice success">
            <strong>Workspace in sync</strong>
            <span>Your live creator lanes match the selection saved on your profile.</span>
          </div>
        )}

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
          const enabled = savedTypes.includes(key);
          const pendingEnabled = selectedTypes.includes(key);
          const pendingChange = enabled !== pendingEnabled;

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
                {pendingChange ? (
                  <span className="creator-status-badge warning">
                    {pendingEnabled ? "Selected - save to enable" : "Selected - save to disable"}
                  </span>
                ) : null}
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
                    {pendingEnabled ? "Save to enable" : `Enable ${item.shortTitle}`}
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
