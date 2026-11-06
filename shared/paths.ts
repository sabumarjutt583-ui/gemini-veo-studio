/**
 * Resolves where the application keeps its data. At runtime the Electron main
 * process points this at `app.getPath('userData')` (%APPDATA%/gemini-veo-studio
 * on Windows) so the user's database, browser profiles and video library live
 * OUTSIDE the install folder and survive updates/uninstalls.
 *
 * In tests and plain-Node usage the root is taken from the GVS_DATA_DIR env
 * var (or a temp dir), so the same service code runs without Electron.
 */
import os from "node:os";
import path from "node:path";

export interface DataDirs {
  /** Root directory for all user data. */
  root: string;
  /** Absolute path to the SQLite database file. */
  databasePath: string;
  /** Where per-account Chrome user-data directories live. */
  profilesDir: string;
  /** Root of the organized local video library. */
  videosDir: string;
  /** Directory used for db backup exports. */
  backupsDir: string;
}

/**
 * Compute the data directories from an arbitrary root. Pure — no Electron, no
 * env reads — so it is trivially testable. Call this with the resolved root.
 */
export function dirsFor(root: string): DataDirs {
  return {
    root,
    databasePath: path.join(root, "gemini-veo-studio.db"),
    profilesDir: path.join(root, "browser-profiles"),
    videosDir: path.join(root, "Videos"),
    backupsDir: path.join(root, "backups"),
  };
}

/**
 * Resolve the application data root.
 * @param electronUserData Optional path from `app.getPath('userData')`. When
 *   provided it wins. Otherwise GVS_DATA_DIR, else a temp dir under the OS
 *   temp folder.
 */
export function resolveDataDir(electronUserData?: string): DataDirs {
  const root =
    electronUserData ?? process.env.GVS_DATA_DIR ?? path.join(os.tmpdir(), "gvs-test-data");
  return dirsFor(root);
}
