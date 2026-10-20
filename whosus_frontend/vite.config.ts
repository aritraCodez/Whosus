import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { parseBackendOrigin } from "./src/config/environment";
export default defineConfig(({ mode }) => {
  parseBackendOrigin(loadEnv(mode, ".", "VITE_").VITE_BACKEND_ORIGIN);
  const backend =
    loadEnv(mode, ".", "WHOSUS_").WHOSUS_DEV_BACKEND || "http://127.0.0.1:8000";
  return {
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
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
