import type { Route } from "./+types/settings";
import { Link } from "react-router";
import { useState, useEffect, useCallback } from "react";
import { requireAuth } from "~/.server/auth/session";
import { auth } from "~/.server/auth/auth.server";
import { getUserSubscriptionInfo } from "~/.server/subscription";
import { authClient, linkSocial } from "~/lib/auth-client";
import { tierDisplayName, getTierLimits, type AccountTier } from "~/lib/tier-limits";

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

  const subscription = await getUserSubscriptionInfo(session.user.id);
  const tier = (subscription?.accountTier ?? "adventurer") as AccountTier;

  return {
    userName: session.user.name,
    email: session.user.email,
    hasGoogle,
    accountTier: tier,
    maxMapUploads: getTierLimits(tier).maxMapUploads,
    maxTokenUploads: getTierLimits(tier).maxTokenUploads,
    stripeSubscriptionId: subscription?.stripeSubscriptionId ?? null,
    stripeCurrentPeriodEnd: subscription?.stripeCurrentPeriodEnd?.toISOString() ?? null,
    stripeCancelAtPeriodEnd: subscription?.stripeCancelAtPeriodEnd ?? false,
  };
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const {
    userName,
    email,
    hasGoogle: initialHasGoogle,
    accountTier,
    maxMapUploads,
    maxTokenUploads,
    stripeSubscriptionId,
    stripeCurrentPeriodEnd,
    stripeCancelAtPeriodEnd,
  } = loaderData;
  const [hasGoogle, setHasGoogle] = useState(initialHasGoogle);
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Uploaded images state
  interface UploadEntry {
    id: string;
    url: string;
    type: "token" | "map";
    fileName: string;
    fileSize: number;
    createdAt: string;
  }
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploadFilter, setUploadFilter] = useState<"all" | "token" | "map">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchUploads = useCallback(async () => {
    setUploadsLoading(true);
    try {
      const res = await fetch("/api/uploads");
      const data = await res.json();
      if (data.uploads) setUploads(data.uploads);
    } catch { /* ignore */ } finally {
      setUploadsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUploads(); }, [fetchUploads]);

  async function handleDeleteUpload(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/uploads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setUploads((prev) => prev.filter((u) => u.id !== id));
        setConfirmDeleteId(null);
      }
    } catch { /* ignore */ } finally {
      setDeletingId(null);
    }
  }

  // Check for callback status from URL hash/params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("linked") === "google") {
      setHasGoogle(true);
      setSuccess("Google account linked successfully!");
      window.history.replaceState({}, "", "/settings");
    }
    if (params.get("subscription") === "success") {
      setSuccess("Subscription activated! Your account has been upgraded.");
      window.history.replaceState({}, "", "/settings");
    }
    if (params.get("subscription") === "cancelled") {
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

  async function handleManageSubscription() {
    setError(null);
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to open billing portal.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  }

  const periodEnd = stripeCurrentPeriodEnd
    ? new Date(stripeCurrentPeriodEnd).toLocaleDateString()
    : null;

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

        {/* Subscription */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Subscription
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Current Plan</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {tierDisplayName(accountTier)}
              </span>
            </div>
            {periodEnd && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  {stripeCancelAtPeriodEnd ? "Access until" : "Renews on"}
                </span>
                <span className="text-gray-900 dark:text-white">{periodEnd}</span>
              </div>
            )}
            {stripeCancelAtPeriodEnd && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Your subscription is set to cancel at the end of the current period.
              </p>
            )}
          </div>
          <div className="flex gap-3 mt-4">
            {stripeSubscriptionId ? (
              <button
                type="button"
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {portalLoading ? "..." : "Manage Subscription"}
              </button>
            ) : null}
            {accountTier === "adventurer" || stripeCancelAtPeriodEnd ? (
              <Link
                to="/pricing"
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700"
              >
                {accountTier === "adventurer" ? "Upgrade" : "Resubscribe"}
              </Link>
            ) : null}
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

        {/* Uploaded Images */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Uploaded Images
            </h2>
            <div className="flex gap-1">
              {(["all", "map", "token"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setUploadFilter(f)}
                  className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                    uploadFilter === f
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                  }`}
                >
                  {f === "all" ? "All" : f === "map" ? "Maps" : "Tokens"}
                </button>
              ))}
            </div>
          </div>

          {/* Usage summary */}
          <div className="flex gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
            <span>
              Map backgrounds: {uploads.filter((u) => u.type === "map").length}/{maxMapUploads === Infinity ? "\u221E" : maxMapUploads}
            </span>
            <span>
              Token images: {uploads.filter((u) => u.type === "token").length}/{maxTokenUploads === Infinity ? "\u221E" : maxTokenUploads}
            </span>
          </div>

          {uploadsLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          ) : (() => {
            const filtered = uploadFilter === "all" ? uploads : uploads.filter((u) => u.type === uploadFilter);
            if (filtered.length === 0) {
              return <p className="text-sm text-gray-500 dark:text-gray-400">No uploaded images.</p>;
            }
            return (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {filtered.map((upload) => (
                  <div key={upload.id} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700">
                      <img
                        src={upload.url}
                        alt={upload.fileName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="mt-1">
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate" title={upload.fileName}>{upload.fileName}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {upload.type === "map" ? "Map" : "Token"} &middot; {(upload.fileSize / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    {confirmDeleteId === upload.id ? (
                      <div className="absolute inset-0 bg-black/60 rounded-lg flex flex-col items-center justify-center gap-2">
                        <p className="text-xs text-white font-medium">Delete?</p>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleDeleteUpload(upload.id)}
                            disabled={deletingId === upload.id}
                            className="text-xs px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer disabled:opacity-50"
                          >
                            {deletingId === upload.id ? "..." : "Yes"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs px-2 py-0.5 bg-gray-500 text-white rounded hover:bg-gray-600 cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(upload.id)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-600/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center text-xs leading-none hover:bg-red-700"
                        title="Delete"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
