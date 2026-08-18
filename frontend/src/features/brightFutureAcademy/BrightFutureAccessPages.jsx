import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import SeoHead from "../../components/seo/SeoHead";
import BrightFutureLayout from "./BrightFutureLayout";
import { CANONICAL_ROOT, CLASS_GROUPS, NIGERIAN_STATES } from "./brightFutureData";
import { loginBrightFutureCandidate, registerBrightFutureCandidate } from "./brightFutureApi";
import useBrightFuture from "./useBrightFuture";

const EMPTY_FORM = {
  firstName: "", middleName: "", lastName: "", gender: "", classLevel: "", schoolName: "",
  state: "", lga: "", age: "", guardianPhone: "", studentPhone: "",
};

const FieldError = ({ children }) => children ? <small className="bfa-field-error">{children}</small> : null;

export function BrightFutureRegistrationPage() {
  const navigate = useNavigate();
  const { acceptSession, competition } = useBrightFuture();
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const registrationClosed = competition && !competition.registrationOpen;
  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await registerBrightFutureCandidate(form);
      acceptSession(data);
      setSuccess(data.candidate);
    } catch (requestError) {
      setFieldErrors(requestError.details || {});
      setError(requestError.message || "Registration could not be completed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <BrightFutureLayout>
        <SeoHead title="Registration Successful | Bright Future Academy" description="Bright Future Academy student registration confirmation." canonical={`${CANONICAL_ROOT}/register`} robots="noindex,nofollow" />
        <section className="bfa-success-page">
          <div className="bfa-confetti" aria-hidden="true">✦ <span>●</span> ◆ <i>✦</i></div>
          <div className="bfa-success-icon">✓</div>
          <p className="bfa-eyebrow">Registration complete</p>
          <h1>Welcome to the challenge, {success.firstName}!</h1>
          <p>Your Bright Future Academy student profile and official Candidate ID have been created securely.</p>
          <div className="bfa-candidate-ticket">
            <span>Bright Future Academy</span>
            <small>National CBT Challenge · Candidate ID</small>
            <strong>{success.candidateId}</strong>
            <div><p><b>{success.fullName}</b><span>Candidate</span></p><p><b>{success.classLevel}</b><span>Class</span></p><p><b>{success.schoolName}</b><span>School</span></p></div>
          </div>
          <div className="bfa-notice bfa-notice--gold"><strong>Keep your Candidate ID safe.</strong><p>You will need it together with your parent or guardian's phone number whenever you return.</p></div>
          <button className="bfa-button bfa-button--primary bfa-button--large" type="button" onClick={() => navigate(`${CANONICAL_ROOT}/dashboard`)}>Proceed to Student Dashboard →</button>
        </section>
      </BrightFutureLayout>
    );
  }

  return (
    <BrightFutureLayout>
      <SeoHead title="Student Registration | Bright Future Academy" description="Register without email for the Bright Future Academy Smart School Portal and National CBT Challenge." canonical={`${CANONICAL_ROOT}/register`} robots="index,follow" />
      <section className="bfa-access-layout">
        <aside className="bfa-access-aside">
          <span className="bfa-status-pill"><i />{registrationClosed ? "Registration paused" : "Registration open"}</span>
          <h1>Begin your bright future.</h1>
          <p>Join a premium school portal and a fair national academic challenge designed for curious, determined learners.</p>
          <ul><li><span>01</span><div><strong>Create your student profile</strong><small>No email or Tengacion account required.</small></div></li><li><span>02</span><div><strong>Receive a secure Candidate ID</strong><small>Generated only by the Bright Future server.</small></div></li><li><span>03</span><div><strong>Enter the four-subject challenge</strong><small>One official attempt with verified results.</small></div></li></ul>
          <div className="bfa-access-aside__quote">“Education is the passport to the future.”<small>Learning principle</small></div>
        </aside>
        <div className="bfa-form-card">
          <p className="bfa-eyebrow">Student registration</p>
          <h2>Create your student profile</h2>
          <p>Use accurate basic information. We ask only for what is needed to run the competition safely.</p>
          <div className="bfa-same-exam-note"><span>!</span><p><strong>One shared national examination</strong>Students from Basic One through SSS 3 answer the same 40 reasoning-led questions.</p></div>
          {error ? <div className="bfa-alert" role="alert">{error}</div> : null}
          {registrationClosed ? <div className="bfa-alert" role="alert">Registration is currently closed. You can still sign in if you already have a Candidate ID.</div> : null}
          <form className="bfa-registration-form" onSubmit={submit} noValidate>
            <fieldset disabled={registrationClosed || submitting}>
              <legend>Personal information</legend>
              <div className="bfa-form-grid bfa-form-grid--three">
                <label>First name <b>*</b><input name="firstName" value={form.firstName} onChange={update} autoComplete="given-name" required /><FieldError>{fieldErrors.firstName}</FieldError></label>
                <label>Middle name <small>Optional</small><input name="middleName" value={form.middleName} onChange={update} autoComplete="additional-name" /><FieldError>{fieldErrors.middleName}</FieldError></label>
                <label>Last name <b>*</b><input name="lastName" value={form.lastName} onChange={update} autoComplete="family-name" required /><FieldError>{fieldErrors.lastName}</FieldError></label>
              </div>
              <div className="bfa-form-grid bfa-form-grid--three">
                <label>Gender <b>*</b><select name="gender" value={form.gender} onChange={update} required><option value="">Select gender</option><option value="female">Female</option><option value="male">Male</option></select><FieldError>{fieldErrors.gender}</FieldError></label>
                <label>Age <b>*</b><input type="number" name="age" min="5" max="20" value={form.age} onChange={update} inputMode="numeric" required /><FieldError>{fieldErrors.age}</FieldError></label>
                <label>Class <b>*</b><select name="classLevel" value={form.classLevel} onChange={update} required><option value="">Select class</option>{CLASS_GROUPS.map((group) => <optgroup key={group.label} label={group.label}>{group.values.map((value) => <option key={value}>{value}</option>)}</optgroup>)}</select><FieldError>{fieldErrors.classLevel}</FieldError></label>
              </div>
            </fieldset>
            <fieldset disabled={registrationClosed || submitting}>
              <legend>School and location</legend>
              <label>School name <b>*</b><input name="schoolName" value={form.schoolName} onChange={update} autoComplete="organization" required /><FieldError>{fieldErrors.schoolName}</FieldError></label>
              <div className="bfa-form-grid">
                <label>State <b>*</b><select name="state" value={form.state} onChange={update} required><option value="">Select state</option>{NIGERIAN_STATES.map((state) => <option key={state}>{state}</option>)}</select><FieldError>{fieldErrors.state}</FieldError></label>
                <label>Local Government Area <b>*</b><input name="lga" value={form.lga} onChange={update} required /><FieldError>{fieldErrors.lga}</FieldError></label>
              </div>
            </fieldset>
            <fieldset disabled={registrationClosed || submitting}>
              <legend>Contact for candidate access</legend>
              <div className="bfa-form-grid">
                <label>Parent / guardian phone <b>*</b><input type="tel" name="guardianPhone" value={form.guardianPhone} onChange={update} autoComplete="tel" inputMode="tel" placeholder="0803 123 4567" required /><FieldError>{fieldErrors.guardianPhone}</FieldError><small>Used with the Candidate ID to return securely.</small></label>
                <label>Student phone <small>Optional</small><input type="tel" name="studentPhone" value={form.studentPhone} onChange={update} inputMode="tel" /><FieldError>{fieldErrors.studentPhone}</FieldError></label>
              </div>
            </fieldset>
            <button className="bfa-button bfa-button--primary bfa-button--large bfa-form-submit" type="submit" disabled={registrationClosed || submitting}>{submitting ? <><span className="bfa-spinner" /> Creating secure profile…</> : "Complete Registration →"}</button>
          </form>
          <p className="bfa-form-footer">Already registered? <Link to={`${CANONICAL_ROOT}/login`}>Access your student dashboard</Link></p>
        </div>
      </section>
    </BrightFutureLayout>
  );
}

export function BrightFutureLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { acceptSession } = useBrightFuture();
  const [form, setForm] = useState({ candidateId: "", guardianPhone: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const returnTo = useMemo(() => location.state?.from?.startsWith(CANONICAL_ROOT) ? location.state.from : `${CANONICAL_ROOT}/dashboard`, [location.state]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await loginBrightFutureCandidate(form);
      acceptSession(data);
      navigate(returnTo, { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Student access failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BrightFutureLayout>
      <SeoHead title="Student Login | Bright Future Academy" description="Return to your Bright Future Academy student portal with your Candidate ID and guardian phone number." canonical={`${CANONICAL_ROOT}/login`} robots="noindex,follow" />
      <section className="bfa-login-section">
        <div className="bfa-login-art"><div className="bfa-login-art__orb"><span>✦</span><strong>Welcome<br />back.</strong></div><p>Continue learning. Continue competing. Continue building your bright future.</p></div>
        <div className="bfa-login-card">
          <p className="bfa-eyebrow">Returning student</p><h1>Access your dashboard</h1><p>Enter the Candidate ID from your registration and the same parent or guardian phone number.</p>
          {error ? <div className="bfa-alert" role="alert">{error}</div> : null}
          <form onSubmit={submit}>
            <label>Candidate ID<input value={form.candidateId} onChange={(event) => setForm((current) => ({ ...current, candidateId: event.target.value.toUpperCase() }))} placeholder="BFA-2026-000001" autoCapitalize="characters" required /></label>
            <label>Parent / guardian phone<input type="tel" value={form.guardianPhone} onChange={(event) => setForm((current) => ({ ...current, guardianPhone: event.target.value }))} placeholder="0803 123 4567" inputMode="tel" required /></label>
            <button type="submit" className="bfa-button bfa-button--primary bfa-button--large" disabled={submitting}>{submitting ? "Checking secure access…" : "Open Student Dashboard →"}</button>
          </form>
          <div className="bfa-login-help"><span>?</span><p><strong>Cannot find your Candidate ID?</strong>Ask your parent or guardian to check the registration confirmation. An administrator can also locate your record privately.</p></div>
          <p className="bfa-form-footer">New to Bright Future Academy? <Link to={`${CANONICAL_ROOT}/register`}>Register now</Link></p>
        </div>
      </section>
    </BrightFutureLayout>
  );
}
