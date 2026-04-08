import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import kadunaGotTalentPoster from "../assets/kaduna-got-talent-poster.jpg";
import {
  getKadunaGotTalentApplication,
  submitKadunaGotTalentApplication,
} from "../api";
import { COUNTRY_OPTIONS, getRegionsForCountry } from "../constants/countries";

const TALENT_OPTIONS = [
  { value: "singer", label: "Singer" },
  { value: "dancer", label: "Dancer" },
  { value: "comedian", label: "Comedian" },
  { value: "magician", label: "Magician" },
  { value: "instrumentalist", label: "Instrumentalist" },
  { value: "spoken_word", label: "Spoken Word" },
  { value: "actor", label: "Actor / Actress" },
  { value: "other", label: "Other talent" },
];

const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "custom", label: "Custom" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const EXPERIENCE_OPTIONS = [
  "Just getting started",
  "Performed a few times",
  "Regular performer",
  "Professional performer",
];

const toDateInputValue = (value) => {
  if (!value) {
    return "";
  }

  const nextDate = new Date(value);
  if (Number.isNaN(nextDate.getTime())) {
    return "";
  }

  return nextDate.toISOString().slice(0, 10);
};

const buildInitialForm = (user = null, application = null) => ({
  fullName: application?.fullName || user?.name || "",
  stageName: application?.stageName || "",
  email: application?.email || user?.email || "",
  phone: application?.phone || user?.phone || "",
  gender: application?.gender || user?.gender || "prefer_not_to_say",
  dateOfBirth: toDateInputValue(application?.dateOfBirth || user?.dob),
  country: application?.country || user?.country || "",
  stateOfOrigin: application?.stateOfOrigin || user?.stateOfOrigin || "",
  city: application?.city || user?.currentCity || "",
  talentCategory: application?.talentCategory || "",
  talentCategoryOther: application?.talentCategoryOther || "",
  bio: application?.bio || user?.bio || "",
  experienceLevel: application?.experienceLevel || "",
  socialHandle: application?.socialHandle || "",
});

export default function KadunaGotTalentRegisterPage({ user }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => buildInitialForm(user));
  const [loading, setLoading] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(true);
  const [existingApplication, setExistingApplication] = useState(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const payload = await getKadunaGotTalentApplication().catch(() => ({ application: null }));
        if (!active) {
          return;
        }

        const application = payload?.application || null;
        setExistingApplication(application);
        setForm(buildInitialForm(user, application));
      } finally {
        if (active) {
          setPrefillLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [user]);

  const regionOptions = useMemo(() => getRegionsForCountry(form.country), [form.country]);
  const stateOptions = useMemo(() => {
    if (!form.country) {
      return [];
    }
    return regionOptions.length > 0 ? regionOptions : ["Other / Not listed"];
  }, [form.country, regionOptions]);

  const setValue = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) {
      return;
    }

    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    const country = form.country.trim();
    const stateOfOrigin = form.stateOfOrigin.trim();
    const city = form.city.trim();
    const talentCategory = form.talentCategory.trim();
    const talentCategoryOther = form.talentCategoryOther.trim();
    const bio = form.bio.trim();

    if (!fullName) {
      toast.error("Please enter the applicant's full name.");
      return;
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (!phone || phone.length < 7) {
      toast.error("Please enter a reachable phone number.");
      return;
    }
    if (!form.dateOfBirth) {
      toast.error("Please provide date of birth.");
      return;
    }
    if (!country) {
      toast.error("Please select a country.");
      return;
    }
    if (!stateOfOrigin) {
      toast.error("Please select a state or region.");
      return;
    }
    if (!city) {
      toast.error("Please enter your city.");
      return;
    }
    if (!talentCategory) {
      toast.error("Please choose a talent category.");
      return;
    }
    if (talentCategory === "other" && !talentCategoryOther) {
      toast.error("Tell us the talent you want to audition with.");
      return;
    }
    if (!bio || bio.length < 40) {
      toast.error("Tell us more about your talent in at least 40 characters.");
      return;
    }

    setLoading(true);
    try {
      const payload = await submitKadunaGotTalentApplication({
        ...form,
        fullName,
        email,
        phone,
        country,
        stateOfOrigin,
        city,
        talentCategory,
        talentCategoryOther,
        bio,
      });

      setExistingApplication(payload?.application || null);
      setForm(buildInitialForm(user, payload?.application || form));
      toast.success(
        payload?.created
          ? "Your Kaduna Got Talent application has been submitted."
          : "Your Kaduna Got Talent application has been updated."
      );
    } catch (error) {
      toast.error(error?.message || "Could not submit your application.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-fb-page talent-show-page">
      <main className="register-fb-shell talent-show-register-shell">
        <section className="talent-show-register-hero">
          <div className="talent-show-register-media">
            <span className="talent-show-register-pill">Sponsored Ad</span>
            <img
              src={kadunaGotTalentPoster}
              alt="Kaduna Got Talent promotional flyer"
              className="talent-show-register-poster"
            />
          </div>

          <div className="talent-show-register-copy">
            <h1 className="register-fb-title">Kaduna Got Talent</h1>
            <p className="register-fb-subtitle">
              Showcase your talent on Tengacion, tell us what makes your performance special, and apply
              for your shot at the Kaduna Got Talent stage.
            </p>

            <div className="talent-show-register-highlights">
              <div>
                <strong>N1,000,000 prize spotlight</strong>
                <span>Audition singers, dancers, comedians, magicians and more in one official registration flow.</span>
              </div>
              <div>
                <strong>Update-friendly application</strong>
                <span>If you already applied from this account, you can return here and update your submission.</span>
              </div>
            </div>

            {existingApplication ? (
              <div className="talent-show-register-status">
                <strong>Application status: {existingApplication.status || "submitted"}</strong>
                <span>
                  Your current application is saved. Update any field below and submit again to refresh it.
                </span>
              </div>
            ) : null}
          </div>
        </section>

        <form className="register-fb-form talent-show-register-form" onSubmit={handleSubmit}>
          <div className="register-fb-section">
            <label className="register-fb-label">Bio-data</label>
            <div className="register-fb-row two">
              <input
                type="text"
                className="register-fb-input"
                placeholder="Full name"
                value={form.fullName}
                onChange={(event) => setValue("fullName", event.target.value)}
                disabled={prefillLoading || loading}
              />
              <input
                type="text"
                className="register-fb-input"
                placeholder="Stage name (optional)"
                value={form.stageName}
                onChange={(event) => setValue("stageName", event.target.value)}
                disabled={prefillLoading || loading}
              />
            </div>
          </div>

          <div className="register-fb-section">
            <label className="register-fb-label">Contact information</label>
            <div className="register-fb-row two">
              <input
                type="email"
                className="register-fb-input"
                placeholder="Email address"
                value={form.email}
                onChange={(event) => setValue("email", event.target.value)}
                disabled={prefillLoading || loading}
              />
              <input
                type="tel"
                className="register-fb-input"
                placeholder="Phone number"
                value={form.phone}
                onChange={(event) => setValue("phone", event.target.value)}
                disabled={prefillLoading || loading}
              />
            </div>
          </div>

          <div className="register-fb-section">
            <label className="register-fb-label">Date of birth and gender</label>
            <div className="register-fb-row two">
              <input
                type="date"
                className="register-fb-input"
                value={form.dateOfBirth}
                onChange={(event) => setValue("dateOfBirth", event.target.value)}
                disabled={prefillLoading || loading}
              />
              <select
                className="register-fb-input register-fb-select"
                value={form.gender}
                onChange={(event) => setValue("gender", event.target.value)}
                disabled={prefillLoading || loading}
              >
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="register-fb-section">
            <label className="register-fb-label">Location</label>
            <div className="register-fb-row three">
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
                disabled={prefillLoading || loading}
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
                disabled={!form.country || prefillLoading || loading}
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

              <input
                type="text"
                className="register-fb-input"
                placeholder="City"
                value={form.city}
                onChange={(event) => setValue("city", event.target.value)}
                disabled={prefillLoading || loading}
              />
            </div>
          </div>

          <div className="register-fb-section">
            <label className="register-fb-label">Talent category</label>
            <div className="register-fb-row two">
              <select
                className="register-fb-input register-fb-select"
                value={form.talentCategory}
                onChange={(event) => setValue("talentCategory", event.target.value)}
                disabled={prefillLoading || loading}
              >
                <option value="">Choose your talent</option>
                {TALENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <input
                type="text"
                className="register-fb-input"
                placeholder="If other, tell us the talent"
                value={form.talentCategoryOther}
                onChange={(event) => setValue("talentCategoryOther", event.target.value)}
                disabled={form.talentCategory !== "other" || prefillLoading || loading}
              />
            </div>
          </div>

          <div className="register-fb-section">
            <label className="register-fb-label">Experience and social handle</label>
            <div className="register-fb-row two">
              <select
                className="register-fb-input register-fb-select"
                value={form.experienceLevel}
                onChange={(event) => setValue("experienceLevel", event.target.value)}
                disabled={prefillLoading || loading}
              >
                <option value="">Select experience level</option>
                {EXPERIENCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <input
                type="text"
                className="register-fb-input"
                placeholder="@instagram or another public handle"
                value={form.socialHandle}
                onChange={(event) => setValue("socialHandle", event.target.value)}
                disabled={prefillLoading || loading}
              />
            </div>
          </div>

          <div className="register-fb-section">
            <label className="register-fb-label">Tell us about your talent</label>
            <textarea
              className="register-fb-input register-fb-textarea"
              placeholder="Share your performance style, notable experience, and what you plan to bring to Kaduna Got Talent."
              value={form.bio}
              onChange={(event) => setValue("bio", event.target.value)}
              disabled={prefillLoading || loading}
            />
            <p className="register-fb-helper-note">
              This helps the Tengacion team understand your act before the audition shortlist is prepared.
            </p>
          </div>

          <div className="register-fb-security-note talent-show-register-note">
            <p>
              By submitting this form, you confirm that the information you supplied is accurate and that
              you are available to take part in Kaduna Got Talent audition communications from Tengacion.
            </p>
          </div>

          <div className="register-fb-legal">
            <p>
              Applications are managed on Tengacion under our <Link to="/terms">Terms</Link>,{" "}
              <Link to="/privacy">Privacy Policy</Link>, and <Link to="/community-guidelines">Community Guidelines</Link>.
            </p>
          </div>

          <button type="submit" className="register-fb-submit" disabled={prefillLoading || loading}>
            {loading
              ? "Submitting application..."
              : existingApplication
                ? "Update Kaduna Got Talent application"
                : "Submit Kaduna Got Talent application"}
          </button>

          <button
            type="button"
            className="register-fb-secondary"
            onClick={() => navigate(user ? "/home" : "/login")}
            disabled={loading}
          >
            {user ? "Back to Home" : "Go to login"}
          </button>
        </form>
      </main>
    </div>
  );
}
