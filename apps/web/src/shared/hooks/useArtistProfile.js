import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "../api/client";

const normalizeLinks = (links = {}) =>
  Object.keys(links).reduce((acc, key) => {
    const value = links[key];
    if (!value) return acc;
    acc[key] = value;
    return acc;
  }, {});

export const useArtistProfile = (username) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!username) {
      setProfile(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/artist/${encodeURIComponent(username)}`);
      setProfile(response.data || null);
    } catch (err) {
      setError(err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const links = useMemo(() => normalizeLinks(profile?.links), [profile]);

  return {
    profile,
    links,
    loading,
    error,
    refresh: fetchProfile,
  };
};

export const useArtistUpdater = () => {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const update = useCallback(async (payload) => {
    setStatus("saving");
    setError(null);
    try {
      const response = await apiClient.put("/artist/me", payload);
      setStatus("success");
      return response.data;
    } catch (err) {
      setStatus("error");
      setError(err);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return {
    status,
    error,
    update,
    reset,
  };
};
