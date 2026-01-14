import { useState } from "react";
import API_BASE from "./api";

export default function Register({ onBack }) {
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    phone: "",
    country: "",
    dob: ""
  });

  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submit = async () => {
    try {
      const data = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        data.append(key, value);
      });

      if (avatar) data.append("avatar", avatar);

      const res = await fetch(API_BASE + "/api/auth/register", {
        method: "POST",
        body: data
      });

      const result = await res.json();

      if (result.token) {
        localStorage.setItem("token", result.token);
        localStorage.setItem("user", JSON.stringify(result.user));
        window.location.reload();
      } else {
        setError(result.error || "Registration failed");
      }
    } catch (err) {
      console.error(err);
      setError("Registration failed");
    }
  };

  return (
    <div className="auth-card">
      <h2>Create your Tengacion account</h2>

      {/* Profile Photo */}
      <div style={{ textAlign: "center", marginBottom: 15 }}>
        <label style={{ cursor: "pointer" }}>
          <img
            src={preview || "/default-avatar.png"}
            alt="avatar"
            style={{
              width: 100,
              height: 100,
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid #ddd"
            }}
          />
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files[0];
              setAvatar(file);
              setPreview(URL.createObjectURL(file));
            }}
          />
        </label>
        <p style={{ fontSize: 12 }}>Click image to upload profile photo</p>
      </div>

      <input name="name" placeholder="Full Name" onChange={handleChange} />
      <input name="username" placeholder="Username" onChange={handleChange} />
      <input name="email" placeholder="Email" onChange={handleChange} />
      <input name="phone" placeholder="Phone number" onChange={handleChange} />
      <input name="country" placeholder="Country" onChange={handleChange} />
      <input type="date" name="dob" onChange={handleChange} />
      <input
        name="password"
        type="password"
        placeholder="Password"
        onChange={handleChange}
      />

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button onClick={submit}>Create account</button>

      <p>
        <button onClick={onBack}>Back to login</button>
      </p>
    </div>
  );
}
