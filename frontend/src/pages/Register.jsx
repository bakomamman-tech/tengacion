import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { register as registerApi } from "../api";

const MONTH_OPTIONS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const isValidEmail = (value) => /^\S+@\S+\.\S+$/.test(value);
const isLikelyPhone = (value) => /^\+?[0-9][0-9\s()-]{6,}$/.test(value);

const calculateAge = (dateValue) => {
  const today = new Date();
  const dob = new Date(dateValue);

  let age = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age;
};

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    day: "",
    month: "",
    year: "",
    gender: "",
    username: "",
    contact: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 100 }, (_, idx) => String(current - idx));
  }, []);

  const dayOptions = useMemo(() => {
    const count = 31;
    return Array.from({ length: count }, (_, idx) => String(idx + 1));
  }, []);

  const token = localStorage.getItem("token");
  if (token) {
    return <Navigate to="/home" replace />;
  }

  const setValue = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) {
      return;
    }

    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const username = form.username.trim().toLowerCase();
    const contact = form.contact.trim();
    const password = form.password;
    const gender = form.gender.trim().toLowerCase();

    if (!firstName || !lastName) {
      toast.error("Please enter your first name and surname.");
      return;
    }

    if (!form.day || !form.month || !form.year) {
      toast.error("Please select your full date of birth.");
      return;
    }

    const dateValue = new Date(
      Number(form.year),
      Number(form.month) - 1,
      Number(form.day)
    );
    if (Number.isNaN(dateValue.getTime())) {
      toast.error("Date of birth is not valid.");
      return;
    }
    if (dateValue.getMonth() !== Number(form.month) - 1) {
      toast.error("Date of birth is not valid.");
      return;
    }
    if (calculateAge(dateValue) < 13) {
      toast.error("You must be at least 13 years old.");
      return;
    }

    if (!gender) {
      toast.error("Please select a gender.");
      return;
    }

    if (!username || username.length < 3) {
      toast.error("Username must be at least 3 characters.");
      return;
    }

    if (!contact) {
      toast.error("Enter your mobile number or email address.");
      return;
    }

    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    let email = "";
    let phone = "";

    if (isValidEmail(contact)) {
      email = contact.toLowerCase();
    } else if (isLikelyPhone(contact)) {
      phone = contact;
      const cleanDigits = contact.replace(/[^0-9]/g, "");
      email = `${username}.${cleanDigits || Date.now()}@mobile.tengacion.local`;
    } else {
      toast.error("Please enter a valid email or phone number.");
      return;
    }

    setLoading(true);

    try {
      await registerApi({
        name: `${firstName} ${lastName}`.trim(),
        username,
        email,
        password,
        phone,
        dob: dateValue.toISOString(),
        gender,
      });

      if (phone) {
        toast.success("Account created. Log in with your username.");
      } else {
        toast.success("Account created successfully. Please log in.");
      }
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-fb-page">
      <main className="register-fb-shell">
        <button
          type="button"
          className="register-fb-back"
          onClick={() => navigate("/")}
          aria-label="Back to login"
        >
          &#8592;
        </button>

        <div className="register-fb-meta">Meta</div>

        <h1 className="register-fb-title">Get started on Tengacion</h1>
        <p className="register-fb-subtitle">
          Create an account to connect with friends, family and communities of
          people who share your interests.
        </p>

        <form className="register-fb-form" onSubmit={handleSubmit}>
          <div className="register-fb-section">
            <label className="register-fb-label">Name</label>
            <div className="register-fb-row two">
              <input
                type="text"
                className="register-fb-input"
                placeholder="First name"
                value={form.firstName}
                onChange={(event) => setValue("firstName", event.target.value)}
                autoComplete="given-name"
              />
              <input
                type="text"
                className="register-fb-input"
                placeholder="Surname"
                value={form.lastName}
                onChange={(event) => setValue("lastName", event.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="register-fb-section">
            <label className="register-fb-label">
              Date of birth <span className="register-fb-help">?</span>
            </label>
            <div className="register-fb-row three">
              <select
                className="register-fb-input register-fb-select"
                value={form.day}
                onChange={(event) => setValue("day", event.target.value)}
              >
                <option value="">Day</option>
                {dayOptions.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>

              <select
                className="register-fb-input register-fb-select"
                value={form.month}
                onChange={(event) => setValue("month", event.target.value)}
              >
                <option value="">Month</option>
                {MONTH_OPTIONS.map((month, index) => (
                  <option key={month} value={String(index + 1)}>
                    {month}
                  </option>
                ))}
              </select>

              <select
                className="register-fb-input register-fb-select"
                value={form.year}
                onChange={(event) => setValue("year", event.target.value)}
              >
                <option value="">Year</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="register-fb-section">
            <label className="register-fb-label">
              Gender <span className="register-fb-help">?</span>
            </label>
            <select
              className="register-fb-input register-fb-select"
              value={form.gender}
              onChange={(event) => setValue("gender", event.target.value)}
            >
              <option value="">Select your gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="register-fb-section">
            <label className="register-fb-label">Username</label>
            <input
              type="text"
              className="register-fb-input"
              placeholder="Choose a username"
              value={form.username}
              onChange={(event) => setValue("username", event.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="register-fb-section">
            <label className="register-fb-label">Mobile number or email address</label>
            <input
              type="text"
              className="register-fb-input"
              placeholder="Mobile number or email address"
              value={form.contact}
              onChange={(event) => setValue("contact", event.target.value)}
              autoComplete="email"
            />
            <p className="register-fb-helper-note">
              You may receive notifications from us.{" "}
              <a href="#why-contact">Learn why we ask for your contact information</a>
            </p>
          </div>

          <div className="register-fb-section">
            <label className="register-fb-label">Password</label>
            <input
              type="password"
              className="register-fb-input"
              placeholder="Password"
              value={form.password}
              onChange={(event) => setValue("password", event.target.value)}
              autoComplete="new-password"
            />
          </div>

          <div className="register-fb-legal">
            <p>
              People who use our service may have uploaded your contact information
              to Tengacion.
            </p>
            <p>
              By tapping Submit, you agree to create an account and to
              Tengacion&apos;s <a href="#terms">Terms</a>,{" "}
              <a href="#privacy">Privacy Policy</a> and{" "}
              <a href="#cookies">Cookies Policy</a>.
            </p>
          </div>

          <button
            type="submit"
            className="register-fb-submit"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Submit"}
          </button>

          <button
            type="button"
            className="register-fb-secondary"
            onClick={() => navigate("/")}
          >
            I already have an account
          </button>
        </form>
      </main>
    </div>
  );
}
