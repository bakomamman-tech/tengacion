import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("token");
  if (token) {
    return <Navigate to="/home" replace />;
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    const { username, email, password, confirmPassword, firstName, lastName } =
      formData;

    if (!username || !email || !password || !confirmPassword) {
      toast.error("Please fill all required fields");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password,
          name: `${firstName || ""} ${lastName || ""}`.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Registration failed");
      }

      toast.success("Account created successfully! Please log in.");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* LEFT SIDE - BRANDING */}
      <div className="login-left">
        <div className="login-logo-section">
          <div className="login-logo">
            <img 
              src="/tengacion_logo.svg" 
              alt="Tengacion" 
              style={{ width: 60, height: 60 }}
            />
          </div>
          <h1 className="login-title">Tengacion</h1>
          <p className="login-subtitle">Join our community today</p>
        </div>

        <div className="login-features">
          <div className="feature-item">
            <span className="feature-icon">🚀</span>
            <p>Get started in seconds</p>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🛡️</span>
            <p>Your data is secure</p>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🤝</span>
            <p>Connect with friends</p>
          </div>
          <div className="feature-item">
            <span className="feature-icon">⚡</span>
            <p>Fast and reliable</p>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - FORM */}
      <div className="login-right">
        <form className="login-box register-box" onSubmit={handleRegister}>
          <h2>Sign Up</h2>
          <p className="register-subtitle">Create your Tengacion account</p>

          <div className="form-row">
            <div className="form-group">
              <input
                type="text"
                name="firstName"
                placeholder="First name"
                value={formData.firstName}
                onChange={handleChange}
                className="login-input"
              />
            </div>
            <div className="form-group">
              <input
                type="text"
                name="lastName"
                placeholder="Last name"
                value={formData.lastName}
                onChange={handleChange}
                className="login-input"
              />
            </div>
          </div>

          <div className="form-group">
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
              className="login-input"
            />
          </div>

          <div className="form-group">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
              className="login-input"
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              name="password"
              placeholder="Password (min. 8 characters)"
              value={formData.password}
              onChange={handleChange}
              required
              className="login-input"
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="login-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="login-btn"
          >
            {loading ? (
              <>
                <span className="spinner-mini"></span>
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </button>

          <p className="register-login-link">
            Already have an account? <a href="/">Log In</a>
          </p>
        </form>
      </div>
    </div>
  );
}
