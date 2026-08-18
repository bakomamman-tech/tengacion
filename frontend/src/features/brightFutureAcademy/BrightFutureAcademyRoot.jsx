import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { BrightFutureProvider } from "./BrightFutureContext";
import BrightFutureLandingPage from "./BrightFutureLandingPage";
import { BrightFutureLoginPage, BrightFutureRegistrationPage } from "./BrightFutureAccessPages";
import { RequireBrightFutureCandidate } from "./BrightFutureLayout";
import {
  BrightFutureAnnouncementsPage,
  BrightFutureAssignmentsPage,
  BrightFutureAttendancePage,
  BrightFutureDashboardPage,
  BrightFutureProfilePage,
  BrightFutureSubjectsPage,
  BrightFutureTeachersPage,
} from "./BrightFuturePortalPages";
import { BrightFutureExamInstructionsPage, BrightFutureExamPage, BrightFutureResultPage } from "./BrightFutureExamPages";
import { BrightFutureLeaderboardPage, BrightFutureParticipantsPage } from "./BrightFuturePublicPages";
import { CANONICAL_ROOT } from "./brightFutureData";

import "./bright-future-academy.css";

const protectedPage = (element) => <RequireBrightFutureCandidate>{element}</RequireBrightFutureCandidate>;

export default function BrightFutureAcademyRoot() {
  return (
    <BrightFutureProvider>
      <Routes>
        <Route index element={<BrightFutureLandingPage />} />
        <Route path="register" element={<BrightFutureRegistrationPage />} />
        <Route path="login" element={<BrightFutureLoginPage />} />
        <Route path="leaderboard" element={<BrightFutureLeaderboardPage />} />
        <Route path="participants" element={<BrightFutureParticipantsPage />} />
        <Route path="dashboard" element={protectedPage(<BrightFutureDashboardPage />)} />
        <Route path="profile" element={protectedPage(<BrightFutureProfilePage />)} />
        <Route path="subjects" element={protectedPage(<BrightFutureSubjectsPage />)} />
        <Route path="assignments" element={protectedPage(<BrightFutureAssignmentsPage />)} />
        <Route path="attendance" element={protectedPage(<BrightFutureAttendancePage />)} />
        <Route path="announcements" element={protectedPage(<BrightFutureAnnouncementsPage />)} />
        <Route path="teachers" element={protectedPage(<BrightFutureTeachersPage />)} />
        <Route path="exam/instructions" element={protectedPage(<BrightFutureExamInstructionsPage />)} />
        <Route path="exam" element={protectedPage(<BrightFutureExamPage />)} />
        <Route path="result" element={protectedPage(<BrightFutureResultPage />)} />
        <Route path="*" element={<Navigate to={CANONICAL_ROOT} replace />} />
      </Routes>
    </BrightFutureProvider>
  );
}

export function BrightFutureLowercaseRedirect() {
  const { pathname, search, hash } = useLocation();
  const suffix = pathname.replace(/^\/bright-future-academy/i, "");
  return <Navigate to={`${CANONICAL_ROOT}${suffix}${search}${hash}`} replace />;
}
