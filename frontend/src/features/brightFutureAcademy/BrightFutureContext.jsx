import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getBrightFutureProfile,
  getBrightFutureSettings,
  getCandidateToken,
  setCandidateToken,
} from "./brightFutureApi";
import BrightFutureContext from "./brightFutureContextValue";

export function BrightFutureProvider({ children }) {
  const [candidate, setCandidate] = useState(null);
  const [competition, setCompetition] = useState(null);
  const [settings, setSettings] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(Boolean(getCandidateToken()));

  const refreshCandidate = useCallback(async ({ quiet = false } = {}) => {
    if (!getCandidateToken()) {
      setCandidate(null);
      setSessionLoading(false);
      return null;
    }
    if (!quiet) {setSessionLoading(true);}
    try {
      const data = await getBrightFutureProfile();
      setCandidate(data.candidate || null);
      return data.candidate || null;
    } catch {
      setCandidate(null);
      return null;
    } finally {
      if (!quiet) {setSessionLoading(false);}
    }
  }, []);

  useEffect(() => {
    getBrightFutureSettings()
      .then((data) => {
        setSettings(data);
        setCompetition(data.competition || null);
      })
      .catch(() => null);
    refreshCandidate();
  }, [refreshCandidate]);

  const acceptSession = useCallback((data) => {
    if (data?.candidateToken) {setCandidateToken(data.candidateToken);}
    setCandidate(data?.candidate || null);
    if (data?.competition) {setCompetition(data.competition);}
  }, []);

  const signOutCandidate = useCallback(() => {
    setCandidateToken("");
    setCandidate(null);
  }, []);

  const value = useMemo(() => ({
    candidate,
    setCandidate,
    competition,
    settings,
    sessionLoading,
    acceptSession,
    refreshCandidate,
    signOutCandidate,
  }), [acceptSession, candidate, competition, refreshCandidate, sessionLoading, settings, signOutCandidate]);

  return <BrightFutureContext.Provider value={value}>{children}</BrightFutureContext.Provider>;
}
