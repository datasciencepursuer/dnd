/**
 * API base URL for mobile (Capacitor) builds.
 * When VITE_API_BASE_URL is set, all API calls go to the remote server.
 * On web builds, this is empty string (same-origin).
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/**
 * Prefix a path with the API base URL.
 * No-op on web builds (returns path unchanged).
 */
export function apiUrl(path: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}
