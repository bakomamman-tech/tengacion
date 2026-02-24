import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useArtistProfile, useArtistUpdater } from "@web/shared/hooks/useArtistProfile";
import { PLATFORM_KEYS, PLATFORM_LABELS } from "@web/shared/utils/platformLinks";

const emptyLinks = PLATFORM_KEYS.reduce((acc, key) => {
  acc[key] = "";
  return acc;
}, {});

const normalizeCustomLinks = (items = []) =>
  items.map((item) => ({ label: item.label || "", url: item.url || "" }));

export default function ArtistProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    profile,
    links,
    loading,
    error,
    refresh,
  } = useArtistProfile(username);
  const { status, error: updateError, update } = useArtistUpdater();

  const canEdit = useMemo(() => {
    if (!user || !profile) return false;
    return String(user.username).toLowerCase() === String(profile.username).toLowerCase();
  }, [user, profile]);

  const [formState, setFormState] = useState({
    displayName: profile?.displayName || "",
    bio: profile?.bio || "",
    platformLinks: { ...emptyLinks, ...links },
    customLinks: normalizeCustomLinks(profile?.customLinks),
  });

  useEffect(() => {
    setFormState({
      displayName: profile?.displayName || "",
      bio: profile?.bio || "",
      platformLinks: { ...emptyLinks, ...links },
      customLinks: normalizeCustomLinks(profile?.customLinks),
    });
  }, [profile, links]);

  const handleLinkChange = (key, value) => {
    setFormState((prev) => ({
      ...prev,
      platformLinks: { ...prev.platformLinks, [key]: value },
    }));
  };

  const handleCustomLinkChange = (index, field, value) => {
    setFormState((prev) => {
      const cloned = [...prev.customLinks];
      cloned[index] = { ...cloned[index], [field]: value };
      return { ...prev, customLinks: cloned };
    });
  };

  const addCustomLink = () => {
    setFormState((prev) => ({
      ...prev,
      customLinks: [...prev.customLinks, { label: "", url: "" }],
    }));
  };

  const removeCustomLink = (index) => {
    setFormState((prev) => ({
      ...prev,
      customLinks: prev.customLinks.filter((_, idx) => idx !== index),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      displayName: formState.displayName,
      bio: formState.bio,
      links: formState.platformLinks,
      customLinks: formState.customLinks.filter((entry) => entry.label && entry.url),
    };

    try {
      await update(payload);
      refresh();
    } catch (err) {
      // error handled by hook
    }
  };

  const artistLinks = useMemo(() => {
    return PLATFORM_KEYS.filter((key) => formState.platformLinks[key]).map((key) => ({
      key,
      label: PLATFORM_LABELS[key],
      url: formState.platformLinks[key],
    }));
  }, [formState.platformLinks]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center">
        <p className="text-sm text-slate-500">Loading creator profile…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          {error.message || "Creator not found"}
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-400">Artist</p>
            <h1 className="text-3xl font-bold text-slate-900">{profile.displayName}</h1>
            <p className="mt-1 text-sm text-slate-600">@{profile.username}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/tracks`)}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Browse music
          </button>
        </div>
        <p className="mt-4 text-sm text-slate-600">{profile.bio || "No biography yet."}</p>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          {PLATFORM_KEYS.map((key) => (
            <div key={key} className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{PLATFORM_LABELS[key]}</span>
              <a
                className={`text-sm font-medium transition ${formState.platformLinks[key] ? "text-brand-600 hover:text-brand-800" : "text-slate-400"}`}
                href={formState.platformLinks[key] || "#"}
                target="_blank"
                rel="noreferrer"
              >
                {formState.platformLinks[key] || "Not available"}
              </a>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3">
          {formState.customLinks.length ? (
            formState.customLinks.map((link, index) => (
              <div key={`${link.label}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{link.label || "Custom Link"}</p>
                <a
                  className="text-xs text-slate-600"
                  href={link.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.url || "No URL"}
                </a>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No custom links yet.</p>
          )}
        </div>
      </section>

      {canEdit && (
        <form
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-600">
              Display name
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                value={formState.displayName}
                onChange={(e) => setFormState((prev) => ({ ...prev, displayName: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm text-slate-600">
              Bio
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                value={formState.bio}
                onChange={(e) => setFormState((prev) => ({ ...prev, bio: e.target.value }))}
              />
            </label>
          </div>

          <div className="grid gap-3">
            {PLATFORM_KEYS.map((key) => (
              <label key={key} className="space-y-1 text-sm text-slate-600">
                {PLATFORM_LABELS[key]} URL
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                  value={formState.platformLinks[key]}
                  onChange={(e) => handleLinkChange(key, e.target.value)}
                  placeholder={`https://www.${key}.com/your-handle`}
                />
              </label>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Custom links</p>
              <button
                type="button"
                onClick={addCustomLink}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600"
              >
                Add link
              </button>
            </div>
            {formState.customLinks.map((link, index) => (
              <div
                key={`custom-${index}`}
                className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr,auto]"
              >
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  value={link.label}
                  placeholder="Label"
                  onChange={(e) => handleCustomLinkChange(index, "label", e.target.value)}
                />
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={link.url}
                    placeholder="https://"
                    onChange={(e) => handleCustomLinkChange(index, "url", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeCustomLink(index)}
                    className="rounded-xl bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Saving status: {status}
              {updateError ? ` — ${updateError.message || updateError}` : ""}
            </span>
            <button
              type="submit"
              disabled={status === "saving"}
              className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {status === "saving" ? "Saving…" : "Save artist profile"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
