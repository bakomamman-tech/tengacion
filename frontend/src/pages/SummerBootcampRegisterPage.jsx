import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import {
  getSummerBootcampApplication,
  submitSummerBootcampRegistration,
} from "../api";
import AuthPasswordField from "../components/AuthPasswordField";
import PublicNav from "../components/PublicNav";
import SeoHead from "../components/seo/SeoHead";
import { COUNTRY_OPTIONS, getRegionsForCountry } from "../constants/countries";
import { useAuth } from "../context/AuthContext";

import "./summer-bootcamp.css";

const FLYER_PATH = "/assets/campaigns/summer-bootcamp-2026.png";
const PAGE_TITLE = "Virtual Summer Bootcamp Registration | Tengacion";
const PAGE_DESCRIPTION =
  "Register children aged 5 to 18 for Tengacion's virtual Summer Bootcamp, running 1–30 August 2026 at ₦50,000 per participant.";
const FEE_PER_PARTICIPANT_NGN = 50_000;
const MAX_STUDENTS = 3;

const formatNaira = (value) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const TRACKS = [
  {
    value: "abacus_math",
    label: "Abacus Math",
    detail: "Calculation skills, number confidence and mental math",
    icon: "∑",
  },
  {
    value: "tech_skills",
    label: "Tech Skills",
    detail: "Computers, coding concepts and useful digital tools",
    icon: "</>",
  },
  {
    value: "reading_phonics",
    label: "Reading & Phonics",
    detail: "Reading, spelling, vocabulary and pronunciation",
    icon: "Aa",
  },
  {
    value: "critical_thinking",
    label: "Critical Thinking",
    detail: "Logic, problem-solving, creativity and practical reasoning",
    icon: "?",
  },
];

const GENDER_OPTIONS = [
  { value: "", label: "Select gender" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "custom", label: "Custom" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const makeId = () =>
  globalThis.crypto?.randomUUID?.() || `student-${Date.now()}-${Math.random()}`;

const createStudent = () => ({
  id: makeId(),
  fullName: "",
  preferredName: "",
  dateOfBirth: "",
  gender: "",
  currentSchool: "",
  classLevel: "",
  learningTracks: [],
  learningGoals: "",
  additionalNeeds: "",
  photo: null,
});

const toDateInput = (value) => {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

const initialParent = (user = null) => ({
  fullName: user?.name || "",
  email: user?.email || "",
  phone: user?.phone || "",
  dateOfBirth: toDateInput(user?.dob),
  gender: user?.gender || "",
  relationshipToStudents: "",
  country: user?.country || "",
  stateOfOrigin: user?.stateOfOrigin || "",
  city: user?.currentCity || "",
  homeAddress: "",
  occupation: "",
  preferredContactMethod: "whatsapp",
});

function PhotoPicker({ id, label, helper, file, onChange, required = false }) {
  const previewRef = useRef("");
  const [preview, setPreview] = useState("");

  useEffect(
    () => () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }
    },
    []
  );

  const choosePhoto = (event) => {
    const nextFile = event.target.files?.[0] || null;
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
    }
    const nextPreview = nextFile ? URL.createObjectURL(nextFile) : "";
    previewRef.current = nextPreview;
    setPreview(nextPreview);
    onChange(nextFile);
  };

  return (
    <div className={`bootcamp-photo-picker${file ? " has-photo" : ""}`}>
      <div className="bootcamp-photo-picker__preview" aria-hidden="true">
        {preview ? <img src={preview} alt="" /> : <span>+</span>}
      </div>
      <div>
        <label className="bootcamp-photo-picker__button" htmlFor={id}>
          {file ? "Change photo" : label}
        </label>
        <input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={choosePhoto}
          required={required}
        />
        <p>{file?.name || helper}</p>
      </div>
    </div>
  );
}

function SectionHeading({ step, eyebrow, title, description }) {
  return (
    <div className="bootcamp-form-section__heading">
      <span>{step}</span>
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <small>{description}</small> : null}
      </div>
    </div>
  );
}

export default function SummerBootcampRegisterPage() {
  const { user, login, updateUser } = useAuth();
  const [parent, setParent] = useState(() => initialParent(user));
  const [account, setAccount] = useState({ username: "", password: "" });
  const [emergencyContact, setEmergencyContact] = useState({
    fullName: "",
    phone: "",
    relationship: "",
  });
  const [household, setHousehold] = useState({
    learningDevice: "",
    internetReliability: "",
    schedulePreference: "",
    goals: "",
  });
  const [students, setStudents] = useState(() => [createStudent()]);
  const [parentPhoto, setParentPhoto] = useState(null);
  const [consent, setConsent] = useState({
    guardianAuthority: false,
    virtualLearning: false,
    childDataProcessing: false,
    profilePhotoUse: false,
    feeAcknowledged: false,
    termsAccepted: false,
    communicationsAccepted: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [application, setApplication] = useState(null);
  const [checkingExisting, setCheckingExisting] = useState(Boolean(user));

  useEffect(() => {
    if (!user) {
      return undefined;
    }
    setParent((current) => ({
      ...current,
      fullName: current.fullName || user.name || "",
      email: user.email || current.email,
      phone: current.phone || user.phone || "",
      dateOfBirth: current.dateOfBirth || toDateInput(user.dob),
      gender: current.gender || user.gender || "",
      country: current.country || user.country || "",
      stateOfOrigin: current.stateOfOrigin || user.stateOfOrigin || "",
      city: current.city || user.currentCity || "",
    }));

    let active = true;
    getSummerBootcampApplication()
      .then((payload) => {
        if (active && payload?.application) {
          setApplication(payload.application);
        }
      })
      .catch(() => null)
      .finally(() => {
        if (active) {
          setCheckingExisting(false);
        }
      });
    return () => {
      active = false;
    };
  }, [user]);

  const regionOptions = useMemo(() => getRegionsForCountry(parent.country), [parent.country]);
  const stateOptions = useMemo(() => {
    if (!parent.country) {
      return [];
    }
    return regionOptions.length ? regionOptions : ["Other / Not listed"];
  }, [parent.country, regionOptions]);
  const standardFeeTotal = students.length * FEE_PER_PARTICIPANT_NGN;

  const setParentValue = (key, value) => {
    setParent((current) => ({ ...current, [key]: value }));
  };

  const setStudentValue = (id, key, value) => {
    setStudents((current) =>
      current.map((student) =>
        student.id === id ? { ...student, [key]: value } : student
      )
    );
  };

  const toggleTrack = (studentId, track) => {
    setStudents((current) =>
      current.map((student) => {
        if (student.id !== studentId) {
          return student;
        }
        const hasTrack = student.learningTracks.includes(track);
        return {
          ...student,
          learningTracks: hasTrack
            ? student.learningTracks.filter((entry) => entry !== track)
            : [...student.learningTracks, track],
        };
      })
    );
  };

  const addStudent = () => {
    if (students.length >= MAX_STUDENTS) {
      toast.error("You can register up to three children in one application.");
      return;
    }
    setStudents((current) => [...current, createStudent()]);
  };

  const removeStudent = (id) => {
    if (students.length === 1) {
      return;
    }
    setStudents((current) => current.filter((student) => student.id !== id));
  };

  const validateBeforeSubmit = () => {
    if (!parentPhoto) {
      return "Upload a clear photo of the registering parent or guardian.";
    }
    if (students.some((student) => !student.photo)) {
      return "Upload one clear photo for every child being registered.";
    }
    if (students.some((student) => student.learningTracks.length === 0)) {
      return "Choose at least one learning track for every child.";
    }
    if (!user && (!account.username.trim() || account.password.length < 8)) {
      return "Choose a Tengacion username and a password of at least eight characters.";
    }
    if (household.goals.trim().length < 30) {
      return "Tell us what your family hopes to achieve in at least 30 characters.";
    }
    if (
      !consent.guardianAuthority ||
      !consent.virtualLearning ||
      !consent.childDataProcessing ||
      !consent.profilePhotoUse ||
      !consent.feeAcknowledged ||
      !consent.termsAccepted
    ) {
      return "Complete all required consent confirmations.";
    }
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const validationError = validateBeforeSubmit();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);
    try {
      const response = await submitSummerBootcampRegistration(
        {
          payload: {
            account: user ? {} : account,
            parent,
            emergencyContact,
            household,
            students: students.map((student) => ({
              fullName: student.fullName,
              preferredName: student.preferredName,
              dateOfBirth: student.dateOfBirth,
              gender: student.gender,
              currentSchool: student.currentSchool,
              classLevel: student.classLevel,
              learningTracks: student.learningTracks,
              learningGoals: student.learningGoals,
              additionalNeeds: student.additionalNeeds,
            })),
            consent,
          },
          parentPhoto,
          studentPhotos: students.map((student) => student.photo),
        },
        setUploadProgress
      );

      if (!response?.application) {
        throw new Error(response?.message || "The registration is not complete yet.");
      }
      if (response?.token && response?.user) {
        login(response.token, response.user, response.sessionId);
      } else if (response?.user) {
        updateUser(response.user);
      }
      setApplication(response.application);
      toast.success(
        response.createdAccount
          ? "Registration complete. Your Tengacion account is ready."
          : "Summer Bootcamp registration submitted."
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast.error(error?.message || "Could not complete the bootcamp registration.");
    } finally {
      setSubmitting(false);
    }
  };

  if (application) {
    return (
      <div className="bootcamp-page">
        <SeoHead
          title={PAGE_TITLE}
          description={PAGE_DESCRIPTION}
          canonical="/summer-bootcamp/register"
          robots="noindex,nofollow"
        />
        <header className="bootcamp-header"><PublicNav theme="dark" /></header>
        <main className="bootcamp-success">
          <div className="bootcamp-success__mark" aria-hidden="true">✓</div>
          <p className="bootcamp-kicker">Registration received</p>
          <h1>Your family&apos;s summer learning journey is booked for review.</h1>
          <p>
            We saved the parent account and {application.students?.length || 1}{" "}
            {(application.students?.length || 1) === 1 ? "student" : "students"}. The bootcamp
            team will contact you using your preferred contact method.
          </p>
          <div className="bootcamp-success__reference">
            <span>Registration reference</span>
            <strong>{application.referenceCode}</strong>
            <small>Status: {application.status || "submitted"}</small>
          </div>
          <div className="bootcamp-success__programme">
            <div><span>Programme dates</span><strong>1–30 August 2026</strong></div>
            <div>
              <span>Standard fee</span>
              <strong>{formatNaira(application.programme?.standardTotalNgn || (application.students?.length || 1) * FEE_PER_PARTICIPANT_NGN)}</strong>
            </div>
            <small>
              {application.programme?.familyRateNegotiable
                ? "Your three-child application qualifies for a negotiated family rate. Our team will confirm the final amount with you."
                : `${formatNaira(FEE_PER_PARTICIPANT_NGN)} per participant. The team will share payment instructions after review.`}
            </small>
          </div>
          <div className="bootcamp-success__account">
            <h2>Your Tengacion account is active</h2>
            <p>You can make posts, add friends, follow creators, shop, or set up your own creator page.</p>
            <div>
              <Link to="/home">Go to Home &amp; make a post</Link>
              <Link to="/find-friends">Find friends</Link>
              <Link to="/creator/register">Become a creator</Link>
            </div>
          </div>
          <a className="bootcamp-success__phone" href="tel:+2348061201090">
            Questions? Call 080 6120 1090
          </a>
        </main>
      </div>
    );
  }

  return (
    <div className="bootcamp-page">
      <SeoHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        canonical="/summer-bootcamp/register"
        robots="noindex,nofollow"
        ogImage={FLYER_PATH}
        ogImageAlt="Tengacion Virtual Summer Bootcamp flyer"
      />

      <header className="bootcamp-header"><PublicNav theme="dark" /></header>

      <main>
        <section className="bootcamp-hero">
          <div className="bootcamp-hero__copy">
            <p className="bootcamp-kicker"><span /> 1–30 August 2026 · 100% online · Ages 5–18</p>
            <h1>Give curious kids a summer to <em>learn, build and grow.</em></h1>
            <p className="bootcamp-hero__lede">
              One secure application registers the children and creates the parent&apos;s Tengacion
              account—ready for friends, posts, creator tools and the wider community.
            </p>
            <div className="bootcamp-hero__facts">
              <span>Abacus Math</span>
              <span>Tech Skills</span>
              <span>Reading &amp; Phonics</span>
              <span>Critical Thinking</span>
            </div>
            <a className="bootcamp-hero__button" href="#bootcamp-form">
              Start family registration <span aria-hidden="true">↓</span>
            </a>
            <p className="bootcamp-hero__assurance">Private child records · Moderated photos · Flexible virtual classes</p>
          </div>
          <div className="bootcamp-hero__flyer">
            <span>Official 2026 programme</span>
            <img src={FLYER_PATH} alt="Tengacion Virtual Summer Bootcamp flyer" />
          </div>
        </section>

        <section className="bootcamp-trust-strip" aria-label="Registration assurances">
          <div><strong>1–30 Aug</strong><span>2026 programme dates</span></div>
          <div><strong>₦50,000</strong><span>Per participant</span></div>
          <div><strong>3 children</strong><span>Negotiated family rate</span></div>
          <div><strong>Private</strong><span>Children&apos;s enrolment photos</span></div>
        </section>

        <form id="bootcamp-form" className="bootcamp-form" onSubmit={handleSubmit}>
          <div className="bootcamp-form__intro">
            <p className="bootcamp-kicker">Family application</p>
            <h2>Tell us about the parent and every child joining the programme.</h2>
            <p>Fields marked required help us keep classes safe, age-appropriate and useful. Register up to three children together.</p>
          </div>

          <section className="bootcamp-form-section">
            <SectionHeading
              step="01"
              eyebrow="Parent account"
              title={user ? "Confirm your Tengacion identity" : "Create the parent's Tengacion account"}
              description="This is the adult account linked to the family application."
            />

            {user ? (
              <div className="bootcamp-signed-in">
                <span aria-hidden="true">✓</span>
                <div><strong>Signed in as @{user.username}</strong><p>{user.email}</p></div>
              </div>
            ) : (
              <div className="bootcamp-field-grid bootcamp-field-grid--two">
                <label className="bootcamp-field">
                  <span>Tengacion username *</span>
                  <input
                    type="text"
                    minLength="3"
                    maxLength="30"
                    pattern="[A-Za-z0-9._]+"
                    value={account.username}
                    onChange={(event) => setAccount((current) => ({ ...current, username: event.target.value }))}
                    placeholder="e.g. aminaparent"
                    autoComplete="username"
                    required
                  />
                  <small>Letters, numbers, dots and underscores only.</small>
                </label>
                <label className="bootcamp-field">
                  <span>Password *</span>
                  <AuthPasswordField
                    value={account.password}
                    onChange={(event) => setAccount((current) => ({ ...current, password: event.target.value }))}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    minLength="8"
                    required
                  />
                </label>
              </div>
            )}

            <div className="bootcamp-field-grid bootcamp-field-grid--two">
              <label className="bootcamp-field"><span>Parent / guardian full name *</span><input type="text" value={parent.fullName} onChange={(event) => setParentValue("fullName", event.target.value)} autoComplete="name" required /></label>
              <label className="bootcamp-field"><span>Email address *</span><input type="email" value={parent.email} onChange={(event) => setParentValue("email", event.target.value)} autoComplete="email" disabled={Boolean(user)} required /></label>
              <label className="bootcamp-field"><span>Mobile number *</span><input type="tel" value={parent.phone} onChange={(event) => setParentValue("phone", event.target.value)} placeholder="+234 800 000 0000" autoComplete="tel" required /><small>Include the international country code.</small></label>
              <label className="bootcamp-field"><span>Date of birth *</span><input type="date" value={parent.dateOfBirth} onChange={(event) => setParentValue("dateOfBirth", event.target.value)} autoComplete="bday" required /></label>
              <label className="bootcamp-field"><span>Gender *</span><select value={parent.gender} onChange={(event) => setParentValue("gender", event.target.value)} required>{GENDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label className="bootcamp-field"><span>Relationship to child / children *</span><select value={parent.relationshipToStudents} onChange={(event) => setParentValue("relationshipToStudents", event.target.value)} required><option value="">Select relationship</option><option value="Mother">Mother</option><option value="Father">Father</option><option value="Legal guardian">Legal guardian</option><option value="Grandparent">Grandparent</option><option value="Other authorized caregiver">Other authorized caregiver</option></select></label>
              <label className="bootcamp-field"><span>Occupation *</span><input type="text" value={parent.occupation} onChange={(event) => setParentValue("occupation", event.target.value)} required /></label>
              <label className="bootcamp-field"><span>Preferred contact *</span><select value={parent.preferredContactMethod} onChange={(event) => setParentValue("preferredContactMethod", event.target.value)} required><option value="whatsapp">WhatsApp</option><option value="phone">Phone call</option><option value="email">Email</option></select></label>
            </div>

            <PhotoPicker
              id="bootcamp-parent-photo"
              label="Upload parent photo"
              helper="A clear, recent head-and-shoulders picture. This becomes your Tengacion profile photo."
              file={parentPhoto}
              onChange={setParentPhoto}
              required
            />
          </section>

          <section className="bootcamp-form-section">
            <SectionHeading step="02" eyebrow="Address & safety" title="Where the family is based" description="We use this for programme coordination and emergency contact only." />
            <div className="bootcamp-field-grid bootcamp-field-grid--three">
              <label className="bootcamp-field"><span>Country *</span><select value={parent.country} onChange={(event) => setParent((current) => ({ ...current, country: event.target.value, stateOfOrigin: "" }))} required><option value="">Select country</option>{COUNTRY_OPTIONS.map((country) => <option key={country} value={country}>{country}</option>)}</select></label>
              <label className="bootcamp-field"><span>State / region *</span><select value={parent.stateOfOrigin} onChange={(event) => setParentValue("stateOfOrigin", event.target.value)} disabled={!parent.country} required><option value="">{parent.country ? "Select state / region" : "Choose country first"}</option>{stateOptions.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
              <label className="bootcamp-field"><span>City / town *</span><input type="text" value={parent.city} onChange={(event) => setParentValue("city", event.target.value)} required /></label>
              <label className="bootcamp-field bootcamp-field--full"><span>Home address *</span><textarea value={parent.homeAddress} onChange={(event) => setParentValue("homeAddress", event.target.value)} rows="2" required /></label>
            </div>
            <div className="bootcamp-subsection-title"><strong>Emergency contact</strong><span>Someone other than the registering parent, where possible.</span></div>
            <div className="bootcamp-field-grid bootcamp-field-grid--three">
              <label className="bootcamp-field"><span>Full name *</span><input type="text" value={emergencyContact.fullName} onChange={(event) => setEmergencyContact((current) => ({ ...current, fullName: event.target.value }))} required /></label>
              <label className="bootcamp-field"><span>Phone number *</span><input type="tel" value={emergencyContact.phone} onChange={(event) => setEmergencyContact((current) => ({ ...current, phone: event.target.value }))} required /></label>
              <label className="bootcamp-field"><span>Relationship *</span><input type="text" value={emergencyContact.relationship} onChange={(event) => setEmergencyContact((current) => ({ ...current, relationship: event.target.value }))} placeholder="e.g. Aunt" required /></label>
            </div>
          </section>

          <section className="bootcamp-form-section bootcamp-form-section--students">
            <SectionHeading step="03" eyebrow="Student details" title="Who is joining the bootcamp?" description="Add one card per child. Each child needs a private enrolment photo." />
            <div className="bootcamp-student-list">
              {students.map((student, index) => (
                <article className="bootcamp-student-card" key={student.id}>
                  <header>
                    <div><span>Student {String(index + 1).padStart(2, "0")}</span><h3>{student.fullName || "New learner"}</h3></div>
                    {students.length > 1 ? <button type="button" onClick={() => removeStudent(student.id)}>Remove</button> : null}
                  </header>
                  <div className="bootcamp-field-grid bootcamp-field-grid--two">
                    <label className="bootcamp-field"><span>Full name *</span><input type="text" value={student.fullName} onChange={(event) => setStudentValue(student.id, "fullName", event.target.value)} required /></label>
                    <label className="bootcamp-field"><span>Preferred name</span><input type="text" value={student.preferredName} onChange={(event) => setStudentValue(student.id, "preferredName", event.target.value)} /></label>
                    <label className="bootcamp-field"><span>Date of birth *</span><input type="date" value={student.dateOfBirth} onChange={(event) => setStudentValue(student.id, "dateOfBirth", event.target.value)} required /></label>
                    <label className="bootcamp-field"><span>Gender *</span><select value={student.gender} onChange={(event) => setStudentValue(student.id, "gender", event.target.value)} required>{GENDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    <label className="bootcamp-field"><span>Current school *</span><input type="text" value={student.currentSchool} onChange={(event) => setStudentValue(student.id, "currentSchool", event.target.value)} required /></label>
                    <label className="bootcamp-field"><span>Current class / grade *</span><input type="text" value={student.classLevel} onChange={(event) => setStudentValue(student.id, "classLevel", event.target.value)} placeholder="e.g. Primary 4" required /></label>
                  </div>
                  <fieldset className="bootcamp-track-picker">
                    <legend>Choose learning tracks *</legend>
                    <div>
                      {TRACKS.map((track) => (
                        <label key={track.value} className={student.learningTracks.includes(track.value) ? "is-selected" : ""}>
                          <input type="checkbox" checked={student.learningTracks.includes(track.value)} onChange={() => toggleTrack(student.id, track.value)} />
                          <i aria-hidden="true">{track.icon}</i>
                          <span><strong>{track.label}</strong><small>{track.detail}</small></span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="bootcamp-field-grid bootcamp-field-grid--two">
                    <label className="bootcamp-field"><span>Learning goals *</span><textarea rows="4" minLength="15" value={student.learningGoals} onChange={(event) => setStudentValue(student.id, "learningGoals", event.target.value)} placeholder="What would you love this child to improve or create?" required /></label>
                    <label className="bootcamp-field"><span>Learning, medical or accessibility support</span><textarea rows="4" value={student.additionalNeeds} onChange={(event) => setStudentValue(student.id, "additionalNeeds", event.target.value)} placeholder="Share allergies, learning needs, accessibility support, or write None." /></label>
                  </div>
                  <PhotoPicker
                    id={`bootcamp-student-photo-${student.id}`}
                    label="Upload student photo"
                    helper="Stored privately with this child's enrolment record—not used as a public profile picture."
                    file={student.photo}
                    onChange={(file) => setStudentValue(student.id, "photo", file)}
                    required
                  />
                </article>
              ))}
            </div>
            <button className="bootcamp-add-student" type="button" onClick={addStudent} disabled={students.length >= MAX_STUDENTS}>+ Add another child</button>
          </section>

          <section className="bootcamp-form-section">
            <SectionHeading step="04" eyebrow="Virtual classroom readiness" title="Help us plan the best class experience" description="No perfect setup is required—honest answers help instructors prepare." />
            <div className="bootcamp-field-grid bootcamp-field-grid--three">
              <label className="bootcamp-field"><span>Main learning device *</span><select value={household.learningDevice} onChange={(event) => setHousehold((current) => ({ ...current, learningDevice: event.target.value }))} required><option value="">Select device</option><option value="smartphone">Smartphone</option><option value="tablet">Tablet</option><option value="computer">Laptop / desktop computer</option><option value="shared_device">Shared family device</option><option value="other">Other</option></select></label>
              <label className="bootcamp-field"><span>Internet reliability *</span><select value={household.internetReliability} onChange={(event) => setHousehold((current) => ({ ...current, internetReliability: event.target.value }))} required><option value="">Select reliability</option><option value="reliable">Reliable most days</option><option value="mostly_reliable">Mostly reliable</option><option value="limited">Limited / data-conscious</option><option value="needs_support">We may need support</option></select></label>
              <label className="bootcamp-field"><span>Preferred schedule *</span><select value={household.schedulePreference} onChange={(event) => setHousehold((current) => ({ ...current, schedulePreference: event.target.value }))} required><option value="">Select schedule</option><option value="weekday_morning">Weekday mornings</option><option value="weekday_afternoon">Weekday afternoons</option><option value="weekday_evening">Weekday evenings</option><option value="weekend">Weekends</option><option value="flexible">Flexible</option></select></label>
              <label className="bootcamp-field bootcamp-field--full"><span>What does your family hope to gain? *</span><textarea rows="4" minLength="30" value={household.goals} onChange={(event) => setHousehold((current) => ({ ...current, goals: event.target.value }))} placeholder="Tell us the skills, confidence or projects you hope the children will gain this summer." required /></label>
            </div>
          </section>

          <section className="bootcamp-form-section bootcamp-form-section--consent">
            <SectionHeading step="05" eyebrow="Consent & submission" title="Review the family permissions" description="Required confirmations protect the children, the parent account and the virtual classroom." />
            <div className="bootcamp-fee-summary">
              <div>
                <span>{students.length} {students.length === 1 ? "participant" : "participants"} × {formatNaira(FEE_PER_PARTICIPANT_NGN)}</span>
                <strong>{formatNaira(standardFeeTotal)}</strong>
              </div>
              <p>
                Full virtual programme: 1–30 August 2026.
                {students.length === MAX_STUDENTS
                  ? " Your family qualifies to discuss a negotiated three-child rate with our team."
                  : " Register three children together to request a negotiated family rate."}
              </p>
            </div>
            <div className="bootcamp-consent-list">
              {[
                ["guardianAuthority", "I confirm that I am the parent, legal guardian, or an adult authorized to register every child listed. *"],
                ["virtualLearning", "I consent to the children participating in live and recorded online learning activities under the programme's safety rules. *"],
                ["childDataProcessing", "I consent to Tengacion securely processing the children's information and private photos for enrolment, safeguarding and class administration. *"],
                ["profilePhotoUse", "I consent to my parent photo becoming my public Tengacion profile picture after moderation. The children's photos remain private. *"],
                ["feeAcknowledged", <>I understand that the programme runs from 1 to 30 August 2026 and the standard fee is {formatNaira(FEE_PER_PARTICIPANT_NGN)} per participant. Families registering three children may request a negotiated rate. *</>],
                ["termsAccepted", <>I agree to Tengacion&apos;s <Link to="/terms">Terms</Link>, <Link to="/privacy">Privacy Policy</Link>, <Link to="/child-safety">Child Safety Policy</Link>, and <Link to="/community-guidelines">Community Guidelines</Link>. *</>],
                ["communicationsAccepted", "I would like to receive programme reminders and future family-learning opportunities from Tengacion."],
              ].map(([key, label]) => (
                <label key={key}>
                  <input type="checkbox" checked={consent[key]} onChange={(event) => setConsent((current) => ({ ...current, [key]: event.target.checked }))} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="bootcamp-privacy-note">
              <strong>Designed for family privacy</strong>
              <p>Children are not automatically given Tengacion accounts. Their photos stay inside the protected registration record. Only the registering parent and authorized Tengacion administrators can access them.</p>
            </div>
            <button className="bootcamp-submit" type="submit" disabled={submitting || checkingExisting}>
              {submitting ? `Uploading & registering${uploadProgress ? ` · ${uploadProgress}%` : "..."}` : checkingExisting ? "Checking registration..." : "Register my family for Summer Bootcamp"}
            </button>
            {submitting ? <div className="bootcamp-progress" aria-label={`Upload ${uploadProgress}% complete`}><span style={{ width: `${uploadProgress}%` }} /></div> : null}
            <p className="bootcamp-submit-note">Already have an account? <Link to="/login">Log in first</Link> so this registration links to it.</p>
          </section>
        </form>
      </main>

      <footer className="bootcamp-footer">
        <div><strong>Tengacion Virtual Summer Bootcamp</strong><span>Learn. Build. Grow.</span></div>
        <a href="tel:+2348061201090">080 6120 1090</a>
      </footer>
    </div>
  );
}
