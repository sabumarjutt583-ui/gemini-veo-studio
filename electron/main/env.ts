/**
 * Detects whether we are running in dev (Vite dev server available) or in
 * production (packed installer). In dev the main process loads
 * http://localhost:5173; in prod it loads the built index.html from dist/.
 */
export const isDev =
  !process.env.IS_PROD &&
  process.env.NODE_ENV !== "production" &&
  !process.env.npm_config_production;

/** True when the app is packaged (electron-builder output). */
export const isProd = !!process.env.IS_PROD || process.defaultApp === false;
