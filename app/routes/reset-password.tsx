import type { Route } from "./+types/reset-password";
import { useNavigate, useSearchParams } from "react-router";
import { useState, useEffect } from "react";
import { authClient } from "~/lib/auth-client";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Reset Password" }];
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const token = searchParams.get("token");
  const urlError = searchParams.get("error");

  useEffect(() => {
    if (urlError === "INVALID_TOKEN") {
      setError("This reset link is invalid or has expired. Please request a new password reset.");
    } else if (!token) {
      setError("Invalid or missing reset token. Please request a new password reset.");
    }
  }, [token, urlError]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;

    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result.error) {
        setError(result.error.message || "Failed to reset password");
        setLoading(false);
        return;
      }
      setSuccess(true);
      setLoading(false);
    } catch (err) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen max-lg:h-full max-lg:overflow-auto items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Hero Image */}
        <div className="text-center">
          <img
            src="https://gn3amfywu8.ufs.sh/f/dWzugQGhzDaSG2hFjlV3WsDHwNF80yobV295vlqiRe6UxXjM"
            alt="D&D Map Editor"
            className="w-32 h-32 mx-auto rounded-2xl shadow-lg object-cover"
          />
          <h2 className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
            D&D Map Editor
          </h2>
        </div>

        {/* Reset Password Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-6">
            Reset Password
          </h1>

          {error && (
            <div className="p-3 mb-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded">
              {error}
            </div>
          )}

          {success ? (
            <div className="space-y-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-100 rounded">
                Your password has been reset successfully!
              </div>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 cursor-pointer"
              >
                Go to Sign In
              </button>
            </div>
          ) : (
            <>
              {token && !urlError ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      New Password
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      required
                      minLength={8}
                      className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      required
                      minLength={8}
                      className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Resetting..." : "Reset Password"}
                  </button>
                </form>
              ) : (
                <div className="text-center space-y-2">
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer block w-full"
                  >
                    Go to Sign In
                  </button>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Need a new reset link? Use "Forgot your password?" on the sign in page.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
