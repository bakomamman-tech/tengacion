import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const getPackageName = (id) => {
  const normalizedId = id.split("\\").join("/")
  const nodeModulesMarker = "/node_modules/"
  const markerIndex = normalizedId.lastIndexOf(nodeModulesMarker)

  if (markerIndex === -1) {
    return ""
  }

  const packagePath = normalizedId.slice(markerIndex + nodeModulesMarker.length)
  const segments = packagePath.split("/")
  if (!segments[0]) {
    return ""
  }

  if (segments[0].startsWith("@")) {
    return `${segments[0]}/${segments[1] || ""}`
  }

  return segments[0]
}

const vendorChunkName = (id) => {
  if (!id.includes("node_modules")) {
    return undefined
  }

  if (id.includes("react-router")) {
    return "vendor-router"
  }

  if (id.includes("livekit")) {
    return "vendor-livekit"
  }

  if (id.includes("socket.io-client") || id.includes("engine.io-client") || id.includes("socket.io-parser")) {
    return "vendor-socket"
  }

  if (id.includes("recharts")) {
    return "vendor-charts"
  }

  if (id.includes("framer-motion")) {
    return "vendor-motion"
  }

  const pkg = getPackageName(id)

  if (["react", "react-dom", "scheduler"].includes(pkg)) {
    return "vendor-react"
  }

  if (pkg === "axios") {
    return "vendor-http"
  }

  if (
    pkg === "react-hook-form" ||
    pkg === "@hookform/resolvers" ||
    pkg === "zod"
  ) {
    return "vendor-forms"
  }

  if (pkg === "country-list" || pkg === "country-region-data") {
    return "vendor-location"
  }

  if (pkg === "qrcode") {
    return "vendor-qr"
  }

  if (pkg === "react-hot-toast") {
    return "vendor-ui"
  }

  return "vendor-misc"
}

export default defineConfig({
  plugins: [react()],

  build: {
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: vendorChunkName,
      },
    },
  },

  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },

  resolve: {
    alias: {
      "@": "/src",
      "@web": path.resolve(__dirname, "../apps/web/src"),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "node_modules/react/jsx-runtime"),
      "react-router-dom": path.resolve(__dirname, "node_modules/react-router-dom"),
      axios: path.resolve(__dirname, "node_modules/axios"),
    },
  },

  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.js",
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
  },
})
