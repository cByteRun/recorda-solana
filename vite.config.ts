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
    port: 4444,
    // Reports/proofs and documentation are not application inputs. Watching
    // them or non-client runner/test/program sources can reload an active wallet journey during verification.
    watch: { ignored: ["**/test-results/**", "**/playwright-report/**", "**/target/**", "**/docs/**", "**/.next/**", "**/next-app/**", "**/scripts/**", "**/tests/**", "**/protocol-tests/**", "**/protocol-ui-tests/**", "**/next-ui-tests/**", "**/programs/**"] }
  }
});
