import React from "react";
import { Routes, Route } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import ProfileEditor from "./ProfileEditor";
import Search from "./pages/Search";

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
