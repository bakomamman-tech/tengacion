import axios from "axios";

const apiClient = axios.create({
  baseURL: "/api",
  timeout: 15000,
  withCredentials: true,
});

let isRefreshing = false;
let refreshSubscribers = [];
let sessionAccessToken = "";

const setSessionAccessToken = (token = "") => {
  sessionAccessToken = String(token || "").trim();
};

const notifyRefreshSubscribers = (token = "") => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

apiClient.interceptors.request.use((config) => {
  const nextConfig = { ...config };
  nextConfig.headers = nextConfig.headers || {};
  if (sessionAccessToken) {
    nextConfig.headers.Authorization = `Bearer ${sessionAccessToken}`;
  }
  return nextConfig;
});

apiClient.interceptors.response.use(
  (response) => {
    if (response?.data?.token) {
      setSessionAccessToken(response.data.token);
    }
    return response;
  },
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config || {};

    if (
      status === 401 &&
      !originalRequest._retry &&
      !String(originalRequest.url || "").includes("/auth/refresh")
    ) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshResponse = await axios.post(
            "/api/auth/refresh",
            {},
            {
              withCredentials: true,
            }
          );
          const nextToken = refreshResponse?.data?.token || "";
          setSessionAccessToken(nextToken);
          notifyRefreshSubscribers(nextToken);
          isRefreshing = false;
          originalRequest.headers = originalRequest.headers || {};
          if (nextToken) {
            originalRequest.headers.Authorization = `Bearer ${nextToken}`;
          }
          return apiClient(originalRequest);
        } catch (refreshError) {
          setSessionAccessToken("");
          isRefreshing = false;
          notifyRefreshSubscribers("");
          window.location.replace("/");
          throw refreshError;
        }
      }

      return new Promise((resolve) => {
        refreshSubscribers.push((token) => {
          originalRequest.headers = originalRequest.headers || {};
          if (token) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          resolve(apiClient(originalRequest));
        });
      });
    }

    return Promise.reject(error);
  }
);

export default apiClient;
