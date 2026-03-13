import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AdminRoute from "./components/AdminRoute";
import InstallPrompt from "./components/InstallPrompt";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";

const loadQuickAccessPages = () => import("./pages/quickAccess/QuickAccessPages");
const loadAccountPages = () => import("./pages/AccountPages");
const lazyNamedExport = (loader, exportName) =>
  lazy(async () => {
    const module = await loader();
    return { default: module[exportName] };
  });

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Search = lazy(() => import("./pages/Search"));
const Home = lazy(() => import("./pages/Home"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const PostSharePage = lazy(() => import("./pages/PostShare"));
const ProfileEditor = lazy(() => import("./ProfileEditor"));
const CreatorDashboardMVP = lazy(() => import("./pages/CreatorDashboardMVP"));
const Notifications = lazy(() => import("./pages/Notifications"));
const SecuritySettings = lazy(() => import("./pages/SecuritySettings"));
const PrivacySettings = lazy(() => import("./pages/PrivacySettings"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPassword"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPassword"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmail"));
const OnboardingPage = lazy(() => import("./pages/Onboarding"));
const TermsPage = lazy(() => import("./pages/Terms"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicy"));
const CommunityGuidelinesPage = lazy(() => import("./pages/CommunityGuidelines"));
const AdminReportsPage = lazy(() => import("./pages/AdminReports"));
const AdminContentPage = lazy(() => import("./pages/AdminContent"));
const AdminTransactionsPage = lazy(() => import("./pages/AdminTransactions"));
const AdminCreatorDetailPage = lazy(() => import("./pages/AdminCreatorDetail"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboard"));
const AdminAnalyticsPage = lazy(() => import("./pages/AdminAnalytics"));
const AdminMessagesPage = lazy(() => import("./pages/AdminMessages"));
const AdminCampaignsPage = lazy(() => import("./pages/AdminCampaigns"));
const AdminSettingsPage = lazy(() => import("./pages/AdminSettings"));
const CreatorPage = lazy(() => import("./pages/CreatorPage"));
const CreatorSongs = lazy(() => import("./pages/CreatorSongs"));
const CreatorHubPage = lazy(() => import("./pages/CreatorHubPage"));
const ArtistProfileRoute = lazy(() => import("@web/features/creator/ArtistPage"));
const TrackDetail = lazy(() => import("./pages/TrackDetail"));
const BookDetail = lazy(() => import("./pages/BookDetail"));
const AlbumDetail = lazy(() => import("./pages/AlbumDetail"));
const Trending = lazy(() => import("./pages/Trending"));
const Rooms = lazy(() => import("./pages/Rooms"));
const LiveDirectory = lazy(() => import("./pages/LiveDirectory"));
const GoLive = lazy(() => import("./pages/GoLive"));
const WatchLive = lazy(() => import("./pages/WatchLive"));
const FriendsPage = lazy(() => import("./pages/FriendsPage"));
const GamingPage = lazy(() => import("./pages/GamingPage"));
const ReelsPage = lazy(() => import("./pages/ReelsPage"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const AdsManagerPage = lazyNamedExport(loadQuickAccessPages, "AdsManagerPage");
const BirthdaysPage = lazyNamedExport(loadQuickAccessPages, "BirthdaysPage");
const EventsPage = lazyNamedExport(loadQuickAccessPages, "EventsPage");
const GroupsPage = lazyNamedExport(loadQuickAccessPages, "GroupsPage");
const MemoriesPage = lazyNamedExport(loadQuickAccessPages, "MemoriesPage");
const SettingsHubPage = lazyNamedExport(loadAccountPages, "SettingsHubPage");
const HelpSupportPage = lazyNamedExport(loadAccountPages, "HelpSupportPage");
const DisplayAccessibilityPage = lazyNamedExport(
  loadAccountPages,
  "DisplayAccessibilityPage"
);
const FeedbackPage = lazyNamedExport(loadAccountPages, "FeedbackPage");
const ProfessionalDashboardPage = lazyNamedExport(
  loadQuickAccessPages,
  "ProfessionalDashboardPage"
);
const SavedPage = lazyNamedExport(loadQuickAccessPages, "SavedPage");

function AppShellFallback({ message = "Loading Tengacion..." }) {
  return (
    <div className="boot-screen">
      <div className="boot-card">
        <h3>{message}</h3>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return <AppShellFallback />;
  }

  return (
    <>
      <Suspense fallback={<AppShellFallback />}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/community-guidelines" element={<CommunityGuidelinesPage />} />
          <Route path="/creators/:creatorId" element={<CreatorPage />} />
          <Route path="/creators/:creatorId/songs" element={<CreatorSongs />} />
          <Route path="/creators/:creatorId/music" element={<CreatorHubPage />} />
          <Route path="/creators/:creatorId/albums" element={<CreatorHubPage />} />
          <Route path="/creators/:creatorId/podcasts" element={<CreatorHubPage />} />
          <Route path="/creators/:creatorId/books" element={<CreatorHubPage />} />
          <Route path="/creators/:creatorId/comedy" element={<CreatorHubPage />} />
          <Route path="/creators/:creatorId/store" element={<CreatorHubPage />} />
          <Route path="/creator/:creatorId" element={<CreatorHubPage />} />
          <Route path="/tracks/:trackId" element={<TrackDetail />} />
          <Route path="/books/:bookId" element={<BookDetail />} />
          <Route path="/albums/:albumId" element={<AlbumDetail />} />
          <Route
            path="/artist/:username"
            element={
              <ProtectedRoute user={user}>
                <ArtistProfileRoute />
              </ProtectedRoute>
            }
          />

          <Route
            path="/home"
            element={
              <ProtectedRoute user={user}>
                <Home user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trending"
            element={
              <ProtectedRoute user={user}>
                <Trending user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gaming"
            element={
              <ProtectedRoute user={user}>
                <GamingPage user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reels"
            element={
              <ProtectedRoute user={user}>
                <ReelsPage user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/live"
            element={
              <ProtectedRoute user={user}>
                <LiveDirectory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/live/go"
            element={
              <ProtectedRoute user={user}>
                <GoLive />
              </ProtectedRoute>
            }
          />
          <Route
            path="/live/watch/:roomName"
            element={
              <ProtectedRoute user={user}>
                <WatchLive />
              </ProtectedRoute>
            }
          />
          <Route
            path="/posts/:postId"
            element={
              <ProtectedRoute user={user}>
                <PostDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/posts/:postId/share"
            element={
              <ProtectedRoute user={user}>
                <PostSharePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/creator"
            element={
              <ProtectedRoute user={user}>
                <CreatorDashboardMVP user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/creator"
            element={
              <ProtectedRoute user={user}>
                <CreatorDashboardMVP user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute user={user}>
                <Notifications user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/:username"
            element={
              <ProtectedRoute user={user}>
                <ProfileEditor user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute user={user}>
                <Search />
              </ProtectedRoute>
            }
          />
          <Route
            path="/friends"
            element={
              <ProtectedRoute user={user}>
                <FriendsPage user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute user={user}>
                <ProfessionalDashboardPage user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/memories"
            element={
              <ProtectedRoute user={user}>
                <MemoriesPage user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/saved"
            element={
              <ProtectedRoute user={user}>
                <SavedPage user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups"
            element={
              <ProtectedRoute user={user}>
                <GroupsPage user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute user={user}>
                <SettingsHubPage user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/security"
            element={
              <ProtectedRoute user={user}>
                <SecuritySettings user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/privacy"
            element={
              <ProtectedRoute user={user}>
                <PrivacySettings user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/notifications"
            element={
              <ProtectedRoute user={user}>
                <NotificationSettings user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/display"
            element={
              <ProtectedRoute user={user}>
                <DisplayAccessibilityPage user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/help-support"
            element={
              <ProtectedRoute user={user}>
                <HelpSupportPage user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/feedback"
            element={
              <ProtectedRoute user={user}>
                <FeedbackPage user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute user={user}>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rooms"
            element={
              <ProtectedRoute user={user}>
                <Rooms />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events"
            element={
              <ProtectedRoute user={user}>
                <EventsPage user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/birthdays"
            element={
              <ProtectedRoute user={user}>
                <BirthdaysPage user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ads-manager"
            element={
              <ProtectedRoute user={user}>
                <AdsManagerPage user={user} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <AdminRoute user={user}>
                <Navigate to="/admin/dashboard" replace />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute user={user}>
                <AdminDashboardPage user={user} activeNav="dashboard" />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute user={user}>
                <AdminPanel user={user} />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/content"
            element={
              <AdminRoute user={user}>
                <AdminContentPage user={user} />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/transactions"
            element={
              <AdminRoute user={user}>
                <AdminTransactionsPage user={user} />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/creators/:creatorId"
            element={
              <AdminRoute user={user}>
                <AdminCreatorDetailPage user={user} />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <AdminRoute user={user}>
                <AdminPanel user={user} />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <AdminRoute user={user}>
                <AdminReportsPage user={user} />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <AdminRoute user={user}>
                <AdminAnalyticsPage user={user} />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/messages"
            element={
              <AdminRoute user={user}>
                <AdminMessagesPage user={user} />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/campaigns"
            element={
              <AdminRoute user={user}>
                <AdminCampaignsPage user={user} />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <AdminRoute user={user}>
                <AdminSettingsPage user={user} />
              </AdminRoute>
            }
          />
        </Routes>
      </Suspense>
      <InstallPrompt />
    </>
  );
}
