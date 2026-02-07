import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { updateMe, uploadAvatar, uploadCover } from "./api";
import { useAuth } from "./context/AuthContext";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function ProfileEditor({ user, onSaved }) {
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [coverPreview, setCoverPreview] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  // Sync local state when user loads or changes
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setBio(user.bio || "");
      setCoverPreview(user.cover || null);
      setAvatarPreview(user.avatar || null);
    }
  }, [user]);

  if (!user) {
    return (
      <div className="boot-screen">
        <div className="boot-card">Loading profile…</div>
      </div>
    );
  }

  const save = async () => {
    if (saving) return;

    setSaving(true);
    setError("");

    try {
      const updated = await updateMe({ name, bio });
      toast.success("✅ Profile updated successfully!");
      if (onSaved) onSaved(updated);
      else updateUser(updated);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update profile");
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatar = async (file) => {
    if (!file) return;
    try {
      setAvatarPreview(URL.createObjectURL(file));
      const updated = await uploadAvatar(file);
      if (onSaved) onSaved(updated);
      else updateUser(updated);
      toast.success("✅ Avatar updated!");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to upload avatar");
      toast.error("Failed to upload avatar");
    }
  };

  const handleCover = async (file) => {
    if (!file) return;
    try {
      setCoverPreview(URL.createObjectURL(file));
      const updated = await uploadCover(file);
      if (onSaved) onSaved(updated);
      else updateUser(updated);
      toast.success("✅ Cover photo updated!");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to upload cover photo");
      toast.error("Failed to upload cover photo");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <>
      <Navbar user={user} onLogout={logout} />
      <div className="app-shell">
        <aside className="sidebar">
          <Sidebar user={user} />
        </aside>

        <div className="profile-container">
          <div className="profile-content">
            {/* COVER PHOTO */}
            <div className="profile-cover">
              {coverPreview && <img src={coverPreview} alt="Cover" />}
              <div className="profile-cover-upload">
                <label htmlFor="cover-input">
                  📷 Change cover
                </label>
                <input
                  id="cover-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleCover(e.target.files[0])}
                />
              </div>
            </div>

            {/* AVATAR + INFO */}
            <div className="profile-avatar-section">
              <div className="profile-avatar-wrapper">
                <img
                  src={avatarPreview || "/avatar.png"}
                  alt={user.name}
                  className="profile-avatar"
                />
                <label htmlFor="avatar-input" className="profile-avatar-upload">
                  <span className="profile-avatar-upload-icon">📷</span>
                  <input
                    id="avatar-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleAvatar(e.target.files[0])}
                  />
                </label>
              </div>

              <div className="profile-info">
                <h1 className="profile-name">{user.name}</h1>
                <p className="profile-bio">@{user.username}</p>
              </div>
            </div>

            {/* EDIT FORM */}
            <div className="profile-form">
              {error && <div className="profile-error">❌ {error}</div>}

              <div className="profile-section">
                <h3 className="profile-section-title">Edit Profile</h3>

                <div className="profile-field">
                  <label htmlFor="name-input">Full Name</label>
                  <input
                    id="name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    disabled={saving}
                  />
                </div>

                <div className="profile-field">
                  <label htmlFor="bio-input">Bio</label>
                  <textarea
                    id="bio-input"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself…"
                    disabled={saving}
                  />
                </div>

                <div className="profile-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => navigate("/home")}
                    disabled={saving}
                  >
                    ← Back to Feed
                  </button>
                  <button
                    className="btn-primary"
                    onClick={save}
                    disabled={saving}
                  >
                    {saving ? <span className="spinner spinner-sm" /> : "💾"}
                    {saving ? " Saving…" : " Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
