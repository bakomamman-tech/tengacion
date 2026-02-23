import React from "react";
import { Routes, Route } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import ProfileEditor from "./ProfileEditor";
import Search from "./pages/Search";
import Trending from "./pages/Trending";
import CreatorDashboardMVP from "./pages/CreatorDashboardMVP";
import Notifications from "./pages/Notifications";
import CreatorPage from "./pages/CreatorPage";
import TrackDetail from "./pages/TrackDetail";
import BookDetail from "./pages/BookDetail";

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
      <Route path="/tracks/:trackId" element={<TrackDetail />} />
      <Route path="/books/:bookId" element={<BookDetail />} />

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
    </Routes>
  );
}
