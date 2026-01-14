import { useState } from "react";
import { updateProfile, uploadAvatar, uploadCover } from "./api";

export default function ProfileEditor({ user, onSaved }) {
  const [name, setName] = useState(user.name || "");
  const [bio, setBio] = useState(user.bio || "");

  const save = async () => {
    const updated = await updateProfile({ name, bio });
    onSaved(updated);
  };

  return (
    <div>
      <h3>Edit Profile</h3>

      {/* COVER PHOTO */}
      <div style={{ marginBottom: 10 }}>
        <label>Cover Photo</label>
        <input
          type="file"
          onChange={e => uploadCover(e.target.files[0]).then(onSaved)}
        />
      </div>

      {/* AVATAR */}
      <div style={{ marginBottom: 10 }}>
        <label>Profile Picture</label>
        <input
          type="file"
          onChange={e => uploadAvatar(e.target.files[0]).then(onSaved)}
        />
      </div>

      {/* NAME */}
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Your name"
      />

      {/* BIO */}
      <textarea
        value={bio}
        onChange={e => setBio(e.target.value)}
        placeholder="Bio"
      />

      <button onClick={save}>Save</button>
    </div>
  );
}
