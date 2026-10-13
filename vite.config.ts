import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { bondOpsPlugin } from "./server/bondops/vite.mjs";

export default defineConfig(({mode}) => {
  const env = {...loadEnv(mode, process.cwd(), ""), ...process.env};
  const publicAddresses = Object.fromEntries(["OPERATOR", "REVIEWER", "AUDITOR", "HOLDER_A", "HOLDER_B", "HOLDER_C"].map(role => [`import.meta.env.VITE_RECORDA_${role}`, JSON.stringify(env[`VITE_RECORDA_${role}`] || env[`RECORDA_${role}`] || "")]));
  return {
  define: publicAddresses,
  cacheDir: process.env.RECORDA_VITE_CACHE_DIR || "node_modules/.vite",
  plugins: [react(), tailwindcss(), bondOpsPlugin()],
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
};
});
