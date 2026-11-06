import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Vite powers the renderer (React UI) and the Vitest test runner.
// In dev the Electron main loads http://localhost:5173; in build it loads the
// statically-served index.html from dist/.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@main": path.resolve(__dirname, "electron/main"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    // Vitest 2 config shape (loaded when `vitest` runs).
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    globals: true,
  },
});
