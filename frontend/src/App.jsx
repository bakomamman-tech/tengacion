import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Home from "./pages/Home";
import ProfileEditor from "./ProfileEditor";
import Search from "./pages/Search";

import { restoreSession } from "./context/auth";

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    restoreSession(setUser)
      .catch(() => {})
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

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
      <Route path="/" element={<Login setUser={setUser} />} />

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
        path="/profile/:username"
        element={
          <ProtectedRoute user={user}>
            <ProfileEditor user={user} onSaved={setUser} />
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
