import React from "react";
import { Routes, Route } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Search from "./pages/Search";
import Home from "./pages/Home";
import PostDetail from "./pages/PostDetail";
import ProfileEditor from "./ProfileEditor";
import CreatorDashboardMVP from "./pages/CreatorDashboardMVP";
import Notifications from "./pages/Notifications";
import CreatorPage from "./pages/CreatorPage";
import CreatorSongs from "./pages/CreatorSongs";
import ArtistProfileRoute from "@web/features/creator/ArtistPage";
import TrackDetail from "./pages/TrackDetail";
import BookDetail from "./pages/BookDetail";
import Trending from "./pages/Trending";
import LiveDirectory from "./pages/LiveDirectory";
import GoLive from "./pages/GoLive";
import WatchLive from "./pages/WatchLive";
import {
  AdsManagerPage,
  BirthdaysPage,
  EventsPage,
  FriendsPage,
  GroupsPage,
  MemoriesPage,
  ProfessionalDashboardPage,
  SavedPage,
} from "./pages/quickAccess/QuickAccessPages";

import { useAuth } from "./context/AuthContext";

export default function App() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="boot-screen">
        <div className="boot-card">
          <h3>🚀 Loading Tengacion…</h3>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* PUBLIC */}
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/creators/:creatorId" element={<CreatorPage />} />
      <Route path="/creators/:creatorId/songs" element={<CreatorSongs />} />
      <Route path="/tracks/:trackId" element={<TrackDetail />} />
      <Route path="/books/:bookId" element={<BookDetail />} />
      <Route
        path="/artist/:username"
        element={
          <ProtectedRoute user={user}>
            <ArtistProfileRoute />
          </ProtectedRoute>
        }
      />

      {/* PROTECTED */}
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
    </Routes>
  );
}
