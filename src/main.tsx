import { Buffer } from "buffer";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/app/styles/globals.css";

globalThis.Buffer = Buffer;

// Solana dependencies access Buffer during module evaluation. Load the app only
// after the browser polyfill exists, in both Vite dev and the built bundle.
void import("@/app/App").then(({ App }) => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});

