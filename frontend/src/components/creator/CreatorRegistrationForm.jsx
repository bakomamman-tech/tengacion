import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { COUNTRY_OPTIONS } from "../../constants/countries";
import { formatCreatorLaneLabel, normalizeCreatorLaneKeys } from "./creatorConfig";
import CreatorTypeSelector from "./CreatorTypeSelector";
import TermsDeclarationCard from "./TermsDeclarationCard";

const socialHandleSchema = z.object({
  facebook: z.string().optional(),
  instagram: z.string().optional(),
  linkedin: z.string().optional(),
  x: z.string().optional(),
  threads: z.string().optional(),
  spotify: z.string().optional(),
  youtube: z.string().optional(),
});

const registrationSchema = z.object({
  fullName: z.string().trim().min(2, "Full Name is required"),
  phoneNumber: z.string().trim().min(5, "Phone Number is required"),
  accountNumber: z.string().trim().min(5, "Bank Account Number is required"),
  country: z.string().trim().min(2, "Country is required"),
  countryOfResidence: z.string().trim().min(2, "Country of Residence is required"),
  socialHandles: socialHandleSchema,
  creatorTypes: z.array(z.enum(["music", "bookPublishing", "podcast"])).min(1, "Select at least one creator category"),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms and Conditions" }),
  }),
  acceptedCopyrightDeclaration: z.literal(true, {
    errorMap: () => ({ message: "You must confirm your upload rights" }),
  }),
});

const STEP_FIELDS = [
  ["fullName", "phoneNumber", "accountNumber", "country", "countryOfResidence"],
  ["creatorTypes"],
  ["acceptedTerms", "acceptedCopyrightDeclaration"],
];

const DEFAULT_VALUES = {
  fullName: "",
  phoneNumber: "",
  accountNumber: "",
  country: "",
  countryOfResidence: "",
  socialHandles: {
    facebook: "",
    instagram: "",
    linkedin: "",
    x: "",
    threads: "",
    spotify: "",
    youtube: "",
  },
  creatorTypes: [],
  acceptedTerms: false,
  acceptedCopyrightDeclaration: false,
};

export default function CreatorRegistrationForm({
  initialValues = {},
  submitLabel = "Complete registration",
  loading = false,
  onSubmit,
}) {
  const [step, setStep] = useState(0);
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(initialValues?.profileImageUrl || "");
  const [profileImageError, setProfileImageError] = useState("");

  const form = useForm({
    resolver: zodResolver(registrationSchema),
    mode: "onChange",
    defaultValues: {
      ...DEFAULT_VALUES,
      ...initialValues,
      socialHandles: {
        ...DEFAULT_VALUES.socialHandles,
        ...(initialValues?.socialHandles || {}),
      },
      creatorTypes: normalizeCreatorLaneKeys(initialValues?.creatorTypes),
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isValid },
  } = form;

  const values = watch();

  useEffect(() => {
    setProfileImagePreview(initialValues?.profileImageUrl || "");
    setProfileImageFile(null);
    setProfileImageError("");
  }, [initialValues?.profileImageUrl]);

  useEffect(() => {
    return () => {
      if (profileImagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(profileImagePreview);
      }
    };
  }, [profileImagePreview]);

  const stepMeta = useMemo(
    () => [
      { title: "Creator identity", caption: "Tell us who is publishing and where payouts should land." },
      {
        title: "Creator lanes",
        caption: "Tick Music, Book Publishing, Podcasts, or all of the above for your workspace.",
      },
      { title: "Legal confirmation", caption: "Confirm rights ownership before your account can publish." },
    ],
    []
  );

  const goNext = async () => {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) {
      setStep((current) => Math.min(current + 1, stepMeta.length - 1));
    }
  };

  const goBack = () => setStep((current) => Math.max(current - 1, 0));

  const handleProfileImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type?.startsWith("image/")) {
      setProfileImageError("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileImageError("Profile picture must be 5MB or less");
      return;
    }

    if (profileImagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(profileImagePreview);
    }

    setProfileImageError("");
    setProfileImageFile(file);
    setProfileImagePreview(URL.createObjectURL(file));
  };

  const clearProfileImage = () => {
    if (profileImagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(profileImagePreview);
    }
    setProfileImageFile(null);
    setProfileImagePreview("");
    setProfileImageError("");
  };

  const profileInitial = (values.displayName || values.fullName || "C").slice(0, 1).toUpperCase();

  return (
    <form
      className="creator-register-form"
      onSubmit={handleSubmit((payload) =>
        onSubmit({
          ...payload,
          profileImageFile,
          profileImageUrl: profileImagePreview || initialValues?.profileImageUrl || "",
        })
      )}
    >
      <div className="creator-steps">
        {stepMeta.map((item, index) => (
          <div
            key={item.title}
            className={`creator-step-pill ${index === step ? "is-active" : ""} ${index < step ? "is-complete" : ""}`}
          >
            <span>{index + 1}</span>
            <div>
              <strong>{item.title}</strong>
              <small>{item.caption}</small>
            </div>
          </div>
        ))}
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        {step === 0 ? (
          <section className="creator-form-card">
            <div className="creator-form-block-head">
              <div>
                <h3>Creator identity</h3>
                <p>Use the same information you want associated with payouts and creator verification.</p>
              </div>
            </div>

            <div className="creator-identity-layout">
              <div className="creator-form-grid">
                <label>
                  <span>Full Name</span>
                  <input {...register("fullName")} placeholder="Enter your full legal name" />
                  {errors.fullName ? <em className="creator-field-error">{errors.fullName.message}</em> : null}
                </label>
                <label>
                  <span>Phone Number</span>
                  <input {...register("phoneNumber")} placeholder="Enter a reachable phone number" />
                  {errors.phoneNumber ? <em className="creator-field-error">{errors.phoneNumber.message}</em> : null}
                </label>
                <label>
                  <span>Bank Account Number</span>
                  <input {...register("accountNumber")} placeholder="Enter your payout account number" />
                  {errors.accountNumber ? <em className="creator-field-error">{errors.accountNumber.message}</em> : null}
                </label>
                <label>
                  <span>Country</span>
                  <select {...register("country")}>
                    <option value="">Select country</option>
                    {COUNTRY_OPTIONS.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                  {errors.country ? <em className="creator-field-error">{errors.country.message}</em> : null}
                </label>
                <label>
                  <span>Country of Residence</span>
                  <select {...register("countryOfResidence")}>
                    <option value="">Select country of residence</option>
                    {COUNTRY_OPTIONS.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                  {errors.countryOfResidence ? (
                    <em className="creator-field-error">{errors.countryOfResidence.message}</em>
                  ) : null}
                </label>
              </div>

              <aside className="creator-avatar-card">
                <div className="creator-avatar-upload-shell">
                  {profileImagePreview ? (
                    <img src={profileImagePreview} alt="Creator profile preview" className="creator-avatar-upload-image" />
                  ) : (
                    <span>{profileInitial}</span>
                  )}
                </div>
                <div className="creator-avatar-copy">
                  <strong>Profile picture</strong>
                  <p>Upload the photo fans should see on your creator profile during onboarding.</p>
                </div>
                <label className="creator-upload-btn">
                  <input type="file" accept="image/*" onChange={handleProfileImageChange} />
                  {profileImageFile || profileImagePreview ? "Change photo" : "Upload photo"}
                </label>
                <small className="creator-field-hint">JPG, PNG, or WEBP. Recommended square image up to 5MB.</small>
                {profileImageError ? <em className="creator-field-error">{profileImageError}</em> : null}
                {profileImagePreview ? (
                  <button type="button" className="creator-ghost-btn" onClick={clearProfileImage}>
                    Remove photo
                  </button>
                ) : null}
              </aside>
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="creator-form-card">
            <CreatorTypeSelector
              value={values.creatorTypes}
              onChange={(next) => setValue("creatorTypes", next, { shouldValidate: true, shouldDirty: true })}
              error={errors.creatorTypes?.message}
            />

            <div className="creator-form-block-head">
              <div>
                <h3>Social media handles</h3>
                <p>Add your creator profiles so your audience and review teams can verify your presence.</p>
              </div>
            </div>

            <div className="creator-form-grid">
              <label>
                <span>Facebook</span>
                <input {...register("socialHandles.facebook")} placeholder="facebook handle" />
              </label>
              <label>
                <span>Instagram</span>
                <input {...register("socialHandles.instagram")} placeholder="instagram handle" />
              </label>
              <label>
                <span>LinkedIn</span>
                <input {...register("socialHandles.linkedin")} placeholder="linkedin profile" />
              </label>
              <label>
                <span>X</span>
                <input {...register("socialHandles.x")} placeholder="x handle" />
              </label>
              <label>
                <span>Threads</span>
                <input {...register("socialHandles.threads")} placeholder="threads handle" />
              </label>
              <label>
                <span>Spotify</span>
                <input {...register("socialHandles.spotify")} placeholder="spotify artist or profile URL" />
              </label>
              <label>
                <span>YouTube</span>
                <input {...register("socialHandles.youtube")} placeholder="youtube handle or channel URL" />
              </label>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="creator-form-card">
            <TermsDeclarationCard
              acceptedTerms={values.acceptedTerms}
              acceptedCopyrightDeclaration={values.acceptedCopyrightDeclaration}
              onAcceptedTermsChange={(next) =>
                setValue("acceptedTerms", next, { shouldValidate: true, shouldDirty: true })
              }
              onAcceptedCopyrightChange={(next) =>
                setValue("acceptedCopyrightDeclaration", next, { shouldValidate: true, shouldDirty: true })
              }
              errors={{
                acceptedTerms: errors.acceptedTerms?.message,
                acceptedCopyrightDeclaration: errors.acceptedCopyrightDeclaration?.message,
              }}
            />

            <div className="creator-review-card">
              <h3>Registration review</h3>
              <ul>
                <li>{values.fullName || "No name yet"}</li>
                <li>
                  {values.creatorTypes?.length
                    ? normalizeCreatorLaneKeys(values.creatorTypes).map((entry) => formatCreatorLaneLabel(entry)).join(", ")
                    : "No creator categories selected"}
                </li>
                <li>{values.countryOfResidence || "Country of residence not set"}</li>
              </ul>
            </div>
          </section>
        ) : null}
      </motion.div>

      <div className="creator-form-actions">
        <button type="button" className="creator-ghost-btn" onClick={goBack} disabled={step === 0 || loading}>
          Back
        </button>
        {step < stepMeta.length - 1 ? (
          <button type="button" className="creator-primary-btn" onClick={goNext} disabled={loading}>
            Continue
          </button>
        ) : (
          <button type="submit" className="creator-primary-btn" disabled={!isValid || loading}>
            {loading ? "Saving..." : submitLabel}
          </button>
        )}
      </div>
    </form>
  );
}
