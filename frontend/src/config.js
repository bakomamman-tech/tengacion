// Monolithic configuration for Tengacion
// Empty base = same domain that served the frontend

export const API_BASE = "";
export const SOCKET_BASE = "";

// Helper to build URLs safely
export const apiUrl = (path) => {
  return `${API_BASE}${path}`;
};

// App-wide constants (we’ll expand later)
export const APP_NAME = "Tengacion";
export const VERSION = "1.0.0";
