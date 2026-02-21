import { useEffect, useMemo, useRef, useState } from "react";
import { register as registerApi } from "./api";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";

/**
 * ✅ ENV base url
 * - If you have VITE_API_URL set, it uses it
 * - Otherwise, fallback to your current domain
 */
const API_BASE = import.meta.env.VITE_API_URL || "https://tengacion.onrender.com";

/**
 * ✅ Helpers
 */
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function debounce(fn, delay = 500) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function calcPasswordStrength(password) {
  let score = 0;

  if (!password) {return { score: 0, label: "Weak" };}

  if (password.length >= 6) {score++;}
  if (/[A-Z]/.test(password)) {score++;}
  if (/[0-9]/.test(password)) {score++;}
  if (/[^A-Za-z0-9]/.test(password)) {score++;}

  const labels = ["Weak", "Fair", "Good", "Strong", "Very Strong"];
  return { score, label: labels[score] || "Weak" };
}

function calcAge(dob) {
  const birth = new Date(dob);
  const today = new Date();
  if (isNaN(birth.getTime())) {return NaN;}

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {age--;}

  return age;
}

/**
 * ✅ Schema
 */
const registerSchema = z
  .object({
    name: z.string().min(3, "Full name must be at least 3 characters"),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username must be 20 characters or less")
      .regex(
        /^[a-zA-Z0-9._]+$/,
        "Username can only contain letters, numbers, dot (.) and underscore (_)"
      ),
    email: z.string().email("Enter a valid email address"),
    phone: z
      .string()
      .min(7, "Phone number is too short")
      .max(15, "Phone number is too long")
      .regex(/^[0-9+ ]+$/, "Phone can only contain numbers and +"),
    country: z.string().min(2, "Country is required"),
    dob: z.string().min(1, "Date of birth is required"),
    gender: z.enum(["male", "female", "custom"], {
      errorMap: () => ({ message: "Select a gender" }),
    }),
    customGender: z.string().optional(),
    password: z.string().min(6, "Password must be at least 6 characters"),
  })
  .superRefine((data, ctx) => {
    if (data?.dob) {
      const age = calcAge(data.dob);
      if (!Number.isFinite(age)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid date of birth",
          path: ["dob"],
        });
      } else if (age < 13) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "You must be at least 13 years old to create an account.",
          path: ["dob"],
        });
      }
    }

    if (data.gender === "custom") {
      const custom = (data.customGender || "").trim();
      if (custom.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter your custom gender.",
          path: ["customGender"],
        });
      }
    }
  });

export default function Register({ onBack }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [serverError, setServerError] = useState("");

  /**
   * ✅ Username live check state
   */
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState("idle"); // idle | ok | bad
  const [usernameMsg, setUsernameMsg] = useState("");

  /**
   * ✅ OTP modal state
   */
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpSentTo, setOtpSentTo] = useState("");

  /**
   * ✅ Profile photo upload state
   */
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState("");

  /**
   * ✅ Success user data after account creation
   */
  const [createdUser, setCreatedUser] = useState(null);
  const [createdToken, setCreatedToken] = useState("");

  const modalRef = useRef(null);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      username: "",
      email: "",
      phone: "",
      country: "",
      dob: "",
      gender: "male",
      customGender: "",
      password: "",
    },
  });

  const gender = watch("gender");
  const dob = watch("dob");
  const password = watch("password");
  const username = watch("username");
  const email = watch("email");

  const strength = useMemo(() => calcPasswordStrength(password), [password]);
  const age = useMemo(() => (dob ? calcAge(dob) : null), [dob]);

  /**
   * ✅ Close modal on Escape
   */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {onBack?.();}
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  /**
   * ✅ Focus modal
   */
  useEffect(() => {
    modalRef.current?.focus?.();
  }, []);

  /**
   * ✅ Username Availability Checker (Debounced)
   * Endpoint expected:
   * GET /api/auth/check-username?username=...
   * Response:
   * { available: true/false, message?: string }
   */
  const checkUsername = useMemo(
    () =>
      debounce(async (value) => {
        const val = (value || "").trim();

        // reset if empty
        if (!val || val.length < 3) {
          setUsernameStatus("idle");
          setUsernameMsg("");
          return;
        }

        // quick local rules
        const valid = /^[a-zA-Z0-9._]+$/.test(val);
        if (!valid) {
          setUsernameStatus("bad");
          setUsernameMsg("Only letters, numbers, dots and underscores are allowed.");
          return;
        }

        setCheckingUsername(true);
        setUsernameStatus("idle");
        setUsernameMsg("Checking username...");

        try {
          const res = await fetch(
            `${API_BASE}/api/auth/check-username?username=${encodeURIComponent(val)}`
          );
          const json = await res.json();

          if (!res.ok) {
            setUsernameStatus("bad");
            setUsernameMsg(json?.message || "Unable to check username");
            return;
          }

          if (json?.available) {
            setUsernameStatus("ok");
            setUsernameMsg("Username is available ✅");
          } else {
            setUsernameStatus("bad");
            setUsernameMsg(json?.message || "Username is taken ❌");
          }
        } catch {
          setUsernameStatus("bad");
          setUsernameMsg("Network error while checking username");
        } finally {
          setCheckingUsername(false);
        }
      }, 500),
    []
  );

  useEffect(() => {
    checkUsername(username);
  }, [username, checkUsername]);

  /**
   * ✅ Steps navigation
   */
  const goNext = async () => {
    setServerError("");

    if (step === 1) {
      const ok = await trigger(["name", "username"]);
      if (!ok) {return;}

      if (usernameStatus === "bad") {
        setServerError("Please choose a different username.");
        return;
      }
      if (checkingUsername) {
        setServerError("Please wait for username check to finish.");
        return;
      }
    }

    if (step === 2) {
      const ok = await trigger(["email", "phone", "country"]);
      if (!ok) {return;}
    }

    if (step === 3) {
      const ok = await trigger(["dob", "gender", "customGender"]);
      if (!ok) {return;}
    }

    if (step === 4) {
      const ok = await trigger(["password"]);
      if (!ok) {return;}
    }

    setStep((s) => Math.min(5, s + 1));
  };

  const goBack = () => {
    setServerError("");
    setStep((s) => Math.max(1, s - 1));
  };

  /**
   * ✅ OTP Flow
   * Endpoint expected:
   * POST /api/auth/request-otp  { email }
   * POST /api/auth/verify-otp   { email, otp }
   */
  const requestOtp = async (emailToSend) => {
    setOtpError("");
    setOtpLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToSend }),
      });

      const json = await res.json();

      if (!res.ok) {
        setOtpError(json?.message || "Failed to send OTP.");
        return false;
      }

      setOtpSentTo(emailToSend);
      return true;
    } catch {
      setOtpError("Network error while sending OTP.");
      return false;
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    setOtpError("");
    setOtpLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpSentTo, otp: otpCode }),
      });

      const json = await res.json();

      if (!res.ok) {
        setOtpError(json?.message || "Invalid OTP.");
        return false;
      }

      return true;
    } catch {
      setOtpError("Network error while verifying OTP.");
      return false;
    } finally {
      setOtpLoading(false);
    }
  };

  /**
   * ✅ After signup success: photo upload
   * Endpoint expected:
   * POST /api/users/upload-avatar
   * Header: Authorization Bearer token
   * Body: multipart/form-data with "avatar"
   */
  const uploadPhoto = async () => {
    setPhotoError("");

    if (!photoFile) {
      setPhotoError("Please select a photo.");
      return;
    }

    if (!createdToken) {
      setPhotoError("No token found. Please login again.");
      return;
    }

    setPhotoLoading(true);

    try {
      const fd = new FormData();
      fd.append("avatar", photoFile);

      const res = await fetch(`${API_BASE}/api/users/upload-avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${createdToken}`,
        },
        body: fd,
      });

      const json = await res.json();

      if (!res.ok) {
        setPhotoError(json?.message || "Upload failed.");
        return;
      }

      // Update local storage user if returned
      if (json?.user) {
        localStorage.setItem("user", JSON.stringify(json.user));
      }

      // Done ✅
      window.location.reload();
    } catch {
      setPhotoError("Network error while uploading photo.");
    } finally {
      setPhotoLoading(false);
    }
  };

  /**
   * ✅ Main Submit
   * Flow:
   * 1) Open OTP modal
   * 2) Request OTP
   * 3) User enters OTP
   * 4) Verify OTP
   * 5) Register account
   * 6) Open Photo Upload modal
   */
  const onSubmit = async () => {
    setServerError("");

    // First open OTP modal
    const emailToSend = getValues("email");
    setOtpOpen(true);

    const sent = await requestOtp(emailToSend);
    if (!sent) {return;}
  };

  const finalRegisterAfterOtp = async () => {
    setServerError("");
    setLoading(true);

    try {
      const values = getValues();

      const payload = {
        name: values.name,
        username: values.username,
        email: values.email,
        password: values.password,
        phone: values.phone,
        country: values.country,
        dob: values.dob,
        gender: values.gender === "custom" ? values.customGender : values.gender,
      };

      const result = await registerApi(payload);

      if (result?.token && result?.user) {
        // Save session
        localStorage.setItem("token", result.token);
        localStorage.setItem("user", JSON.stringify(result.user));

        setCreatedToken(result.token);
        setCreatedUser(result.user);

        // Open photo upload modal (facebook-style next step)
        setOtpOpen(false);
        setPhotoOpen(true);
      } else {
        setServerError(result?.error || result?.message || "Registration failed");
        setOtpOpen(false);
      }
    } catch (err) {
      console.error(err);
      setServerError("Registration failed");
      setOtpOpen(false);
    } finally {
      setLoading(false);
    }
  };

  /**
   * ✅ When user selects photo
   */
  const onPickPhoto = (e) => {
    setPhotoError("");
    const file = e.target.files?.[0];
    if (!file) {return;}

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  return (
    <AnimatePresence>
      {/* ✅ Modal Overlay */}
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onBack}
        />

        {/* Main Modal */}
        <motion.div
          ref={modalRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 z-10"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <button
            type="button"
            onClick={onBack}
            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-slate-950 border border-slate-800 hover:border-slate-600 transition flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>

          <h2 className="text-2xl font-bold text-white">Sign Up</h2>
          <p className="text-slate-400 mt-1">
            It’s quick and easy to join Tengacion.
          </p>

          {/* Step Indicator */}
          <div className="mt-5 flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className={`h-2 flex-1 rounded-full ${
                  n <= step ? "bg-blue-500" : "bg-slate-700"
                }`}
              />
            ))}
          </div>

          {serverError && (
            <div className="mt-4 bg-red-500/15 border border-red-500/40 text-red-200 p-3 rounded-xl text-sm">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6">
            <AnimatePresence mode="wait">
              {/* STEP 1 */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 35 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -35 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-sm text-slate-300">Full name</label>
                    <input
                      {...register("name")}
                      className="w-full mt-1 p-3 rounded-xl bg-slate-950 border border-slate-800 outline-none focus:border-blue-500"
                      placeholder="Stephen Daniel Kurah"
                    />
                    {errors.name && (
                      <p className="text-xs text-red-300 mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">Username</label>
                    <input
                      {...register("username")}
                      className={cn(
                        "w-full mt-1 p-3 rounded-xl bg-slate-950 border outline-none focus:border-blue-500",
                        usernameStatus === "ok" ? "border-green-600" : "border-slate-800",
                        usernameStatus === "bad" ? "border-red-600" : ""
                      )}
                      placeholder="pyrexx"
                    />

                    {errors.username && (
                      <p className="text-xs text-red-300 mt-1">
                        {errors.username.message}
                      </p>
                    )}

                    {/* Live checker feedback */}
                    {username && username.length >= 3 && (
                      <p
                        className={cn(
                          "text-xs mt-2",
                          usernameStatus === "ok" && "text-green-300",
                          usernameStatus === "bad" && "text-red-300",
                          usernameStatus === "idle" && "text-slate-400"
                        )}
                      >
                        {checkingUsername ? "Checking..." : usernameMsg}
                      </p>
                    )}

                    <p className="text-xs text-slate-500 mt-2">
                      Tip: A unique username helps people find you faster.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={goNext}
                    className="w-full p-3 rounded-xl bg-blue-600 hover:bg-blue-700 transition font-semibold"
                  >
                    Continue
                  </button>

                  <button
                    type="button"
                    onClick={onBack}
                    className="w-full p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition font-semibold"
                  >
                    Back to login
                  </button>
                </motion.div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 35 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -35 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-sm text-slate-300">Email</label>
                    <input
                      {...register("email")}
                      type="email"
                      className="w-full mt-1 p-3 rounded-xl bg-slate-950 border border-slate-800 outline-none focus:border-blue-500"
                      placeholder="you@email.com"
                    />
                    {errors.email && (
                      <p className="text-xs text-red-300 mt-1">{errors.email.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">Phone</label>
                    <input
                      {...register("phone")}
                      className="w-full mt-1 p-3 rounded-xl bg-slate-950 border border-slate-800 outline-none focus:border-blue-500"
                      placeholder="+234 800 000 0000"
                    />
                    {errors.phone && (
                      <p className="text-xs text-red-300 mt-1">{errors.phone.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">Country</label>
                    <input
                      {...register("country")}
                      className="w-full mt-1 p-3 rounded-xl bg-slate-950 border border-slate-800 outline-none focus:border-blue-500"
                      placeholder="Nigeria"
                    />
                    {errors.country && (
                      <p className="text-xs text-red-300 mt-1">{errors.country.message}</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={goBack}
                      className="flex-1 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition font-semibold"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      className="flex-1 p-3 rounded-xl bg-blue-600 hover:bg-blue-700 transition font-semibold"
                    >
                      Continue
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 35 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -35 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-sm text-slate-300">Date of birth</label>
                    <input
                      {...register("dob")}
                      type="date"
                      className="w-full mt-1 p-3 rounded-xl bg-slate-950 border border-slate-800 outline-none focus:border-blue-500"
                    />
                    {errors.dob && (
                      <p className="text-xs text-red-300 mt-1">{errors.dob.message}</p>
                    )}
                    {age !== null && Number.isFinite(age) && (
                      <p className="text-xs text-slate-400 mt-1">
                        Age: <span className="text-slate-200">{age}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">Gender</label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {["male", "female", "custom"].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setValue("gender", g, { shouldValidate: true })}
                          className={`p-3 rounded-xl border transition text-sm ${
                            gender === g
                              ? "bg-blue-600 border-blue-500"
                              : "bg-slate-950 border-slate-800 hover:border-slate-600"
                          }`}
                        >
                          {g.charAt(0).toUpperCase() + g.slice(1)}
                        </button>
                      ))}
                    </div>
                    {errors.gender && (
                      <p className="text-xs text-red-300 mt-2">{errors.gender.message}</p>
                    )}
                  </div>

                  {gender === "custom" && (
                    <div>
                      <label className="text-sm text-slate-300">Custom gender</label>
                      <input
                        {...register("customGender")}
                        className="w-full mt-1 p-3 rounded-xl bg-slate-950 border border-slate-800 outline-none focus:border-blue-500"
                        placeholder="e.g. Non-binary"
                      />
                      {errors.customGender && (
                        <p className="text-xs text-red-300 mt-1">
                          {errors.customGender.message}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={goBack}
                      className="flex-1 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition font-semibold"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      className="flex-1 p-3 rounded-xl bg-blue-600 hover:bg-blue-700 transition font-semibold"
                    >
                      Continue
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 4 */}
              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 35 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -35 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-sm text-slate-300">Password</label>
                    <div className="relative">
                      <input
                        {...register("password")}
                        type={showPass ? "text" : "password"}
                        className="w-full mt-1 p-3 rounded-xl bg-slate-950 border border-slate-800 outline-none focus:border-blue-500 pr-16"
                        placeholder="Create a strong password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm"
                      >
                        {showPass ? "Hide" : "Show"}
                      </button>
                    </div>

                    {errors.password && (
                      <p className="text-xs text-red-300 mt-1">{errors.password.message}</p>
                    )}

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Password strength</span>
                        <span className="text-slate-200">{strength.label}</span>
                      </div>

                      <div className="w-full h-2 bg-slate-800 rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${(strength.score / 4) * 100}%` }}
                        />
                      </div>

                      <p className="text-xs text-slate-500 mt-2">
                        Tip: Use uppercase letters, numbers & symbols.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={goBack}
                      className="flex-1 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition font-semibold"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      className="flex-1 p-3 rounded-xl bg-blue-600 hover:bg-blue-700 transition font-semibold"
                    >
                      Continue
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 5 */}
              {step === 5 && (
                <motion.div
                  key="step5"
                  initial={{ opacity: 0, x: 35 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -35 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <p className="text-sm text-slate-300 font-semibold">
                      Review your details
                    </p>

                    <div className="mt-3 space-y-1 text-sm text-slate-200">
                      <p>
                        <span className="text-slate-500">Name:</span> {watch("name")}
                      </p>
                      <p>
                        <span className="text-slate-500">Username:</span> @{watch("username")}
                      </p>
                      <p>
                        <span className="text-slate-500">Email:</span> {watch("email")}
                      </p>
                      <p>
                        <span className="text-slate-500">Phone:</span> {watch("phone")}
                      </p>
                      <p>
                        <span className="text-slate-500">Country:</span> {watch("country")}
                      </p>
                      <p>
                        <span className="text-slate-500">Gender:</span>{" "}
                        {watch("gender") === "custom"
                          ? watch("customGender")
                          : watch("gender")}
                      </p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full p-3 rounded-xl bg-green-600 hover:bg-green-700 transition font-semibold disabled:opacity-60"
                  >
                    {otpLoading || loading ? "Preparing..." : "Create account"}
                  </button>

                  <button
                    type="button"
                    onClick={goBack}
                    className="w-full p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition font-semibold"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={onBack}
                    className="w-full p-3 rounded-xl border border-slate-700 hover:border-slate-500 transition font-semibold text-slate-200"
                  >
                    Back to login
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <p className="text-xs text-slate-500 mt-5">
            By signing up, you agree to our Terms and Privacy Policy.
          </p>
        </motion.div>

        {/* ✅ OTP MODAL */}
        <AnimatePresence>
          {otpOpen && (
            <motion.div
              className="fixed inset-0 z-[60] flex items-center justify-center px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

              <motion.div
                className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 z-10"
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.2 }}
              >
                <h3 className="text-xl font-bold text-white">Verify your email</h3>
                <p className="text-slate-400 mt-1 text-sm">
                  We sent a 6-digit code to:{" "}
                  <span className="text-slate-200 font-semibold">{otpSentTo || email}</span>
                </p>

                {otpError && (
                  <div className="mt-4 bg-red-500/15 border border-red-500/40 text-red-200 p-3 rounded-xl text-sm">
                    {otpError}
                  </div>
                )}

                <div className="mt-4">
                  <label className="text-sm text-slate-300">OTP Code</label>
                  <input
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full mt-1 p-3 rounded-xl bg-slate-950 border border-slate-800 outline-none focus:border-blue-500"
                    placeholder="Enter OTP (e.g. 123456)"
                    inputMode="numeric"
                  />
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await requestOtp(getValues("email"));
                      if (ok) {setOtpCode("");}
                    }}
                    disabled={otpLoading}
                    className="flex-1 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition font-semibold disabled:opacity-60"
                  >
                    {otpLoading ? "Sending..." : "Resend OTP"}
                  </button>

                  <button
                    type="button"
                    disabled={otpLoading}
                    onClick={async () => {
                      if (!otpCode || otpCode.trim().length < 4) {
                        setOtpError("Please enter the OTP code.");
                        return;
                      }

                      const verified = await verifyOtp();
                      if (!verified) {return;}

                      await finalRegisterAfterOtp();
                    }}
                    className="flex-1 p-3 rounded-xl bg-blue-600 hover:bg-blue-700 transition font-semibold disabled:opacity-60"
                  >
                    {otpLoading || loading ? "Verifying..." : "Verify"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setOtpOpen(false);
                    setOtpError("");
                    setOtpCode("");
                  }}
                  className="mt-3 w-full p-3 rounded-xl border border-slate-700 hover:border-slate-500 transition font-semibold text-slate-200"
                >
                  Cancel
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ✅ PHOTO UPLOAD MODAL */}
        <AnimatePresence>
          {photoOpen && (
            <motion.div
              className="fixed inset-0 z-[70] flex items-center justify-center px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

              <motion.div
                className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 z-10"
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.2 }}
              >
                <h3 className="text-xl font-bold text-white">Add a profile photo</h3>
                <p className="text-slate-400 mt-1 text-sm">
                  Welcome <span className="text-slate-200 font-semibold">{createdUser?.name}</span> 🎉
                  <br />
                  Upload a photo so people can recognize you.
                </p>

                {photoError && (
                  <div className="mt-4 bg-red-500/15 border border-red-500/40 text-red-200 p-3 rounded-xl text-sm">
                    {photoError}
                  </div>
                )}

                <div className="mt-4 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-slate-500 text-sm">No photo</span>
                    )}
                  </div>

                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onPickPhoto}
                      className="block w-full text-sm text-slate-300"
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      JPG / PNG recommended.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="flex-1 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition font-semibold"
                  >
                    Skip for now
                  </button>

                  <button
                    type="button"
                    disabled={photoLoading}
                    onClick={uploadPhoto}
                    className="flex-1 p-3 rounded-xl bg-green-600 hover:bg-green-700 transition font-semibold disabled:opacity-60"
                  >
                    {photoLoading ? "Uploading..." : "Upload photo"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
