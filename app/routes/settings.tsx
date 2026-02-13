import type { Route } from "./+types/settings";
import { Link } from "react-router";
import { useState, useEffect } from "react";
import { requireAuth } from "~/.server/auth/session";
import { auth } from "~/.server/auth/auth.server";
import { authClient, linkSocial } from "~/lib/auth-client";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Account Settings" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);

  const accounts = await auth.api.listUserAccounts({
    headers: request.headers,
  });

  const hasGoogle = accounts?.some(
    (a: { providerId: string }) => a.providerId === "google"
  );

  return {
    userName: session.user.name,
    email: session.user.email,
    hasGoogle,
  };
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { userName, email, hasGoogle: initialHasGoogle } = loaderData;
  const [hasGoogle, setHasGoogle] = useState(initialHasGoogle);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check for callback status from URL hash/params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("linked") === "google") {
      setHasGoogle(true);
      setSuccess("Google account linked successfully!");
      // Clean up URL
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  async function handleLinkGoogle() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await linkSocial({
        provider: "google",
        callbackURL: "/settings?linked=google",
      });
    } catch {
      setError("Failed to link Google account. Please try again.");
      setLoading(false);
    }
  }

  async function handleUnlinkGoogle() {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await authClient.unlinkAccount({
        providerId: "google",
      });
      setHasGoogle(false);
      setSuccess("Google account unlinked.");
    } catch {
      setError("Failed to unlink Google account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen max-lg:h-full max-lg:overflow-auto bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link
            to="/"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Account Settings
          </h1>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 mb-4 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-100 rounded">
            {success}
          </div>
        )}

        {/* Account Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Account
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Name</span>
              <span className="text-gray-900 dark:text-white">{userName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Email</span>
              <span className="text-gray-900 dark:text-white">{email}</span>
            </div>
          </div>
        </div>

        {/* Linked Accounts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Linked Accounts
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Link your Google account to sign in with either method. Works even if your Google email is different from your account email.
          </p>

          <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <div>
                <span className="font-medium text-gray-900 dark:text-white">Google</span>
                {hasGoogle && (
                  <span className="ml-2 text-xs text-green-600 dark:text-green-400">Connected</span>
                )}
              </div>
            </div>

            {hasGoogle ? (
              <button
                type="button"
                onClick={handleUnlinkGoogle}
                disabled={loading}
                className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "..." : "Unlink"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLinkGoogle}
                disabled={loading}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "..." : "Link Account"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
