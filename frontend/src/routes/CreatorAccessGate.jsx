import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { getCreatorAccess } from "../api";
import "../pages/creator/creator-workspace.css";

export default function CreatorAccessGate() {
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const resolveAccess = async () => {
      try {
        const payload = await getCreatorAccess();
        if (!active) {
          return;
        }
        if (!payload?.isCreatorRegistered || !payload?.onboardingCompleted) {
          setTarget("/creator/register");
          return;
        }
        setTarget("/creator/dashboard");
      } catch (err) {
        if (active) {
          setError(err?.message || "Failed to open creator workspace.");
        }
      }
    };
    resolveAccess();
    return () => {
      active = false;
    };
  }, []);

  if (target) {
    return <Navigate to={target} replace />;
  }

  return (
    <div className="creator-gate-screen">
      <div className="creator-gate-card">
        <h2>{error ? "Creator workspace unavailable" : "Opening creator workspace"}</h2>
        <p>{error || "Checking your creator access and routing you to the right dashboard."}</p>
      </div>
    </div>
  );
}
