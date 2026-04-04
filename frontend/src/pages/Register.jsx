import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { register as registerApi } from "../api";
import AuthPasswordField from "../components/AuthPasswordField";
import { COUNTRY_OPTIONS, getRegionsForCountry } from "../constants/countries";
import { useAuth } from "../context/AuthContext";
import {
  isValidInternationalPhoneNumber,
  normalizePhoneNumber,
} from "../utils/phone";

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

const REGION_FALLBACK_OPTION = "Other / Not listed";

const isValidEmail = (value) => /^\S+@\S+\.\S+$/.test(value);

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
  const { user, login } = useAuth();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    day: "",
    month: "",
    year: "",
    gender: "",
    username: "",
    email: "",
    phone: "",
    country: "",
    stateOfOrigin: "",
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

  const matchedRegionOptions = useMemo(
    () => getRegionsForCountry(form.country),
    [form.country]
  );

  const stateOptions = useMemo(() => {
    if (matchedRegionOptions.length > 0) {
      return matchedRegionOptions;
    }
    if (!form.country) {
      return [];
    }
    return [REGION_FALLBACK_OPTION];
  }, [form.country, matchedRegionOptions]);

  if (user) {
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
    const email = form.email.trim().toLowerCase();
    const phone = normalizePhoneNumber(form.phone);
    const password = form.password;
    const country = form.country.trim();
    const stateOfOrigin = form.stateOfOrigin.trim();
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

    if (!email) {
      toast.error("Enter your email address.");
      return;
    }

    if (!phone) {
      toast.error("Enter your mobile number.");
      return;
    }

    if (!country) {
      toast.error("Please select your country.");
      return;
    }

    if (!stateOfOrigin) {
      toast.error("Please select your state of origin.");
      return;
    }

    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (!isValidEmail(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (!isValidInternationalPhoneNumber(phone)) {
      toast.error("Please enter a valid international mobile number.");
      return;
    }

    setLoading(true);

    try {
      const payload = await registerApi({
        name: `${firstName} ${lastName}`.trim(),
        username,
        email,
        password,
        phone,
        country,
        stateOfOrigin,
        dob: dateValue.toISOString(),
        gender,
      });

      if (payload?.token && payload?.user) {
        login(payload.token, payload.user, payload.sessionId);
        toast.success("Account created. You are now signed in.");
        navigate("/home", { replace: true });
        return;
      }

      toast.success("Account created.");
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
            <label className="register-fb-label">Email address</label>
            <input
              type="email"
              className="register-fb-input"
              placeholder="you@example.com"
              value={form.email}
              onChange={(event) => setValue("email", event.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="register-fb-section">
            <label className="register-fb-label">Mobile number</label>
            <input
              type="tel"
              inputMode="tel"
              className="register-fb-input"
              placeholder="+234 800 000 0000"
              value={form.phone}
              onChange={(event) => setValue("phone", event.target.value)}
              autoComplete="tel"
              required
            />
            <p className="register-fb-helper-note">
              Use an international number with your country code if needed.
            </p>
          </div>

          <div className="register-fb-section">
            <label className="register-fb-label">Country and State of Origin</label>
            <div className="register-fb-row two">
              <select
                className="register-fb-input register-fb-select"
                value={form.country}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    country: event.target.value,
                    stateOfOrigin: "",
                  }))
                }
              >
                <option value="">Select your country</option>
                {COUNTRY_OPTIONS.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>

              <select
                className="register-fb-input register-fb-select"
                value={form.stateOfOrigin}
                onChange={(event) => setValue("stateOfOrigin", event.target.value)}
                disabled={!form.country}
              >
                <option value="">
                  {form.country ? "Select your state / region" : "Choose country first"}
                </option>
                {stateOptions.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
            <p className="register-fb-helper-note">
              Your country selection loads the available states or regions automatically.
            </p>
          </div>

          <div className="register-fb-section">
            <label className="register-fb-label">Password</label>
            <AuthPasswordField
              className="register-fb-input"
              containerClassName="register-fb-password-wrap"
              placeholder="Password"
              value={form.password}
              onChange={(event) => setValue("password", event.target.value)}
              autoComplete="new-password"
              name="password"
            />
          </div>

          <div className="register-fb-security-note">
            <p>
              For the security of your account, you are advised to choose a strong
              password that has alphanumeric characters.
            </p>
          </div>

          <div className="register-fb-legal">
            <p>
              By tapping Submit, you agree to create an account and to
              Tengacion&apos;s <Link to="/terms">Terms</Link>,{" "}
              <Link to="/privacy">Privacy Policy</Link> and{" "}
              <Link to="/community-guidelines">Community Guidelines</Link>.
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
