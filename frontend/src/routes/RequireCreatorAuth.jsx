import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { getCreatorAccess } from "../api";
import "../pages/creator/creator-workspace.css";

export default function RequireCreatorAuth({ children }) {
  const [state, setState] = useState({ loading: true, allow: false });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const payload = await getCreatorAccess();
        if (!active) {
          return;
        }
        setState({
          loading: false,
          allow: Boolean(payload?.isCreatorRegistered && payload?.onboardingCompleted),
        });
      } catch {
        if (active) {
          setState({ loading: false, allow: false });
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="creator-gate-screen">
        <div className="creator-gate-card">
          <h2>Loading creator access</h2>
          <p>Checking your creator registration status.</p>
        </div>
      </div>
    );
  }

  if (!state.allow) {
    return <Navigate to="/creator/register" replace />;
  }

  return children;
}
