import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import {
  getCreatorAccess,
  getCreatorWorkspaceProfile,
  registerCreatorProfile,
} from "../../api";
import CreatorRegistrationForm from "../../components/creator/CreatorRegistrationForm";

import "./creator-workspace.css";

export default function CreatorRegisterPage({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [initialValues, setInitialValues] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const access = await getCreatorAccess();
        if (!active) {
          return;
        }
        if (access?.isCreatorRegistered && access?.onboardingCompleted) {
          navigate("/creator/dashboard", { replace: true });
          return;
        }
        const profile = await getCreatorWorkspaceProfile().catch(() => null);
        if (!active) {
          return;
        }
        setInitialValues({
          fullName: profile?.fullName || user?.name || "",
          phoneNumber: profile?.phoneNumber || user?.phone || "",
          accountNumber: profile?.accountNumber || "",
          country: profile?.country || user?.country || "",
          countryOfResidence: profile?.countryOfResidence || profile?.country || user?.country || "",
          socialHandles: profile?.socialHandles || {},
          creatorTypes: profile?.creatorTypes || [],
          acceptedTerms: Boolean(profile?.acceptedTerms),
          acceptedCopyrightDeclaration: Boolean(profile?.acceptedCopyrightDeclaration),
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [navigate, user]);

  const heroCopy = useMemo(
    () => ({
      title: "Register As A Creator",
      body:
        "Set up your professional creator profile once, then unlock a structured workspace for music, books, and podcasts with real publishing status checks from the backend.",
    }),
    []
  );

  const handleSubmit = async (values) => {
    try {
      setSubmitLoading(true);
      await registerCreatorProfile(values);
      toast.success("Creator registration completed");
      navigate("/creator/dashboard", { replace: true });
    } catch (err) {
      toast.error(err?.message || "Could not complete creator registration");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading || !initialValues) {
    return (
      <div className="creator-register-shell">
        <section className="creator-register-hero card">
          <h1>{heroCopy.title}</h1>
          <p>{heroCopy.body}</p>
          <div className="creator-page-loading">Preparing your creator onboarding...</div>
        </section>
      </div>
    );
  }

  return (
    <div className="creator-register-shell">
      <section className="creator-register-hero card">
        <div className="creator-register-copy">
          <span className="creator-eyebrow">Creator onboarding</span>
          <h1>{heroCopy.title}</h1>
          <p>{heroCopy.body}</p>
          <div className="creator-register-highlights">
            <div>
              <strong>Category-aware workspace</strong>
              <span>Only the dashboards you enable will appear in your sidebar and home flow.</span>
            </div>
            <div>
              <strong>Verification-ready publishing</strong>
              <span>Every upload receives a copyright screening state that your dashboard can track.</span>
            </div>
            <div>
              <strong>Professional creator setup</strong>
              <span>Collect payout details, creator identity, and declarations in one secure flow.</span>
            </div>
          </div>
        </div>

        <div className="creator-register-panel">
          <CreatorRegistrationForm
            initialValues={initialValues}
            loading={submitLoading}
            onSubmit={handleSubmit}
          />
        </div>
      </section>
    </div>
  );
}
