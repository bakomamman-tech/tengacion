import { useCallback, useEffect, useState } from "react";
import apiClient from "@web/shared/api/client";

export const useFeed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/posts");
      setPosts(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    posts,
    loading,
    error,
    refresh,
  };
};
