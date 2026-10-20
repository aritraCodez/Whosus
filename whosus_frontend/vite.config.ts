import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const backend =
    loadEnv(mode, ".", "WHOSUS_").WHOSUS_DEV_BACKEND || "http://127.0.0.1:8000";
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": backend,
        "/ws": { target: backend, ws: true },
      },
    },
    build: { chunkSizeWarningLimit: 1200 },
  };
});
