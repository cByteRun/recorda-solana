import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  cacheDir: process.env.RECORDA_VITE_CACHE_DIR || "node_modules/.vite",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@golden": fileURLToPath(new URL("./golden", import.meta.url))
    }
  },
  server: {
    port: 4444
  }
});
