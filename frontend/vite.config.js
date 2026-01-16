import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,

    proxy: {
      // API requests → backend
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false
      },

      // IMPORTANT: also proxy socket.io explicitly
      "/socket.io": {
        target: "http://localhost:5000",
        ws: true,
        changeOrigin: true
      }
    }
  }
});
