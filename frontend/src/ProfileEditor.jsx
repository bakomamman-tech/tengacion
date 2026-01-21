import { useEffect, useState } from "react";
import { updateMe, uploadAvatar, uploadCover } from "./api";

export default function ProfileEditor({ user, onSaved }) {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Sync local state when user loads or changes
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setBio(user.bio || "");
    }
  }, [user]);

  if (!user) {
    return <p>Loading profile…</p>;
  }

  const save = async () => {
    if (saving) return;

    setSaving(true);
    setError("");

    try {
      const updated = await updateMe({ name, bio });
      onSaved(updated);
    } catch {
      setError("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatar = async (file) => {
    if (!file) return;
    try {
      const updated = await uploadAvatar(file);
      onSaved(updated);
    } catch {
      setError("Failed to upload avatar");
    }
  };

  const handleCover = async (file) => {
    if (!file) return;
    try {
      const updated = await uploadCover(file);
      onSaved(updated);
    } catch {
      setError("Failed to upload cover photo");
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: "0 auto" }}>
      <h3>Edit Profile</h3>

      {error && (
        <p style={{ color: "red", marginBottom: 10 }}>
          {error}
        </p>
      )}

      {/* COVER PHOTO */}
      <div style={{ marginBottom: 12 }}>
        <label>Cover Photo</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleCover(e.target.files[0])}
        />
      </div>

      {/* AVATAR */}
      <div style={{ marginBottom: 12 }}>
        <label>Profile Picture</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleAvatar(e.target.files[0])}
        />
      </div>

      {/* NAME */}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        style={{ width: "100%", marginBottom: 10 }}
        disabled={saving}
      />

      {/* BIO */}
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Bio"
        style={{ width: "100%", marginBottom: 10 }}
        disabled={saving}
      />

      <button onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
