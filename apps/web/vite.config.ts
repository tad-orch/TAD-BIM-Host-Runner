import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const backendTarget = process.env.BACKEND_URL ?? "http://127.0.0.1:8080";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/execute": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/health": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/jobs": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/mcp": {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
});
