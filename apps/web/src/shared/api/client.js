import axios from "axios";

const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("token") : null);

const apiClient = axios.create({
  baseURL: "/api",
  timeout: 15000,
  withCredentials: true,
});

let isRefreshing = false;
let refreshSubscribers = [];

const notifyRefreshSubscribers = (token) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;

    if (status === 401 && !originalRequest._retry) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshToken = localStorage.getItem("refresh_token");
          if (!refreshToken) {
            throw new Error("Refresh token missing");
          }
          const { data } = await axios.post("/api/auth/refresh", { token: refreshToken });
          localStorage.setItem("token", data.token);
          notifyRefreshSubscribers(data.token);
          isRefreshing = false;
          return apiClient(originalRequest);
        } catch (refreshError) {
          isRefreshing = false;
          notifyRefreshSubscribers(null);
          localStorage.removeItem("token");
          localStorage.removeItem("refresh_token");
          window.location.replace("/");
          throw refreshError;
        }
      }

      return new Promise((resolve, reject) => {
        refreshSubscribers.push((token) => {
          if (!token) {
            reject(error);
            return;
          }
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(originalRequest));
        });
      });
    }

    return Promise.reject(error);
  }
);

export default apiClient;
