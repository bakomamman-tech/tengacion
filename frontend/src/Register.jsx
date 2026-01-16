import { useState } from "react";
import { register } from "./api";

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

  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submit = async () => {
    try {
      const result = await register(form);

      if (result?.token && result?.user) {
        localStorage.setItem("token", result.token);
        localStorage.setItem("user", JSON.stringify(result.user));
        window.location.reload();
      } else {
        setError(result?.error || "Registration failed");
      }
    } catch (err) {
      console.error(err);
      setError("Registration failed");
    }
  };

  return (
    <div className="auth-card">
      <h2>Create your account</h2>

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
