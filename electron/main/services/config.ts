import type { DataDirs } from "@shared/paths";

/**
 * Runtime configuration handed to the services. Keeping this explicit (rather
 * than reading globals inside each service) makes every service unit-testable:
 * a test builds a Config pointing at a temp dir and a fake chrome path, and no
 * real browser or filesystem side-effect can leak in.
 */
export interface Config {
  dataDirs: DataDirs;
  /** Resolved absolute path to the chrome/chromium executable, or null. */
  chromeExecutable: string | null;
}

/**
 * Standard Windows locations Chrome/Chromium/Edge live in. The browser service
 * probes these to find a usable executable when the user hasn't configured one
 * in Settings. Order = preference (stable Chrome first, then Edge).
 */
export const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];
