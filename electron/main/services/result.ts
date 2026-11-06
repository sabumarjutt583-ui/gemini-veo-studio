import type { ApiResult } from "@shared/types";

// Re-exported so that service modules that depend on ApiResult can import it
// from "./result" without needing to import directly from @shared/types.
export type { ApiResult };

/**
 * Helpers to build the `ApiResult` envelope without ever throwing across the
 * IPC boundary. Handlers catch and wrap; services that return plain domain
 * values can wrap on the way out.
 */
export function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}

export function fail<T = unknown>(error: string | unknown): ApiResult<T> {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
  return { ok: false, error: message };
}

/** Run a throwing function and convert any error into an `ApiResult`. */
export function guard<T>(fn: () => T): ApiResult<T> {
  try {
    return ok(fn());
  } catch (e) {
    return fail(e);
  }
}
