import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// The renderer talks to the main process only through the preload bridge
// (window.api). There is no direct Node/Electron access here.
//
// A small guard: if the app is opened in a plain browser (no Electron host),
// window.api is undefined. We still mount the shell so the UI is visible and
// we surface a clear "run inside the desktop app" message instead of crashing.
const hasBridge = typeof window !== "undefined" && "api" in window;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {hasBridge ? (
      <App />
    ) : (
      <div className="p-8 text-ink-muted">
        <h1 className="text-lg font-semibold text-ink">Gemini Veo Studio</h1>
        <p className="mt-2 max-w-md text-sm">
          This UI runs inside the Electron desktop app. Open it via{" "}
          <code className="text-accent">npm start</code> (or the built
          executable) so the main process and database are available.
        </p>
      </div>
    )}
  </React.StrictMode>
);
