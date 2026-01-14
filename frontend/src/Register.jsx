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
      const data = await register(form);
      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        window.location.reload();
      } else {
        setError("Registration failed");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    }
  };

  return (
    <div>
      <h2>Create your Tengacion account</h2>

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
