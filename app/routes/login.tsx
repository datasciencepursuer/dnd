import type { Route } from "./+types/login";
import { redirect, useNavigate, useSearchParams } from "react-router";
import { useState } from "react";
import { authClient } from "~/lib/auth-client";
import { auth } from "~/.server/auth/auth.server";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Login" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (session) {
    // If already logged in, redirect to the intended destination or home
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get("redirect") || "/";
    throw redirect(redirectTo);
  }
  return null;
}

type ViewState = "login" | "signup" | "forgot-password";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<ViewState>("login");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Get the redirect URL from query params, default to home
  const redirectTo = searchParams.get("redirect") || "/";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;

    try {
      if (view === "signup") {
        const result = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
        });
        if (result.error) {
          setError(result.error.message || "Sign up failed");
          setLoading(false);
          return;
        }
        // Show verification message
        setSuccess("Account created! Please check your email to verify your account.");
        setView("login");
        setLoading(false);
        return;
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        });
        if (result.error) {
          // Check if error is due to unverified email
          if (result.error.message?.toLowerCase().includes("verify") ||
              result.error.message?.toLowerCase().includes("verified")) {
            setUnverifiedEmail(email);
            setShowVerifyModal(true);
            setModalSuccess(null);
            setModalError(null);
            setLoading(false);
            return;
          }
          setError(result.error.message || "Invalid email or password");
          setLoading(false);
          return;
        }
      }
      navigate(redirectTo);
    } catch (err) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      if (result.error) {
        setError(result.error.message || "Failed to send reset email");
        setLoading(false);
        return;
      }
      setSuccess("Password reset email sent! Check your inbox.");
      setLoading(false);
    } catch (err) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!unverifiedEmail) return;
    setModalError(null);
    setModalSuccess(null);
    setLoading(true);

    try {
      const result = await authClient.sendVerificationEmail({
        email: unverifiedEmail,
      });
      if (result.error) {
        setModalError(result.error.message || "Failed to send verification email");
        setLoading(false);
        return;
      }
      setModalSuccess("Verification email sent! Check your inbox.");
      setLoading(false);
    } catch (err) {
      setModalError("An error occurred. Please try again.");
      setLoading(false);
    }
  }

  function closeVerifyModal() {
    setShowVerifyModal(false);
    setUnverifiedEmail(null);
    setModalSuccess(null);
    setModalError(null);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
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
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Create and manage your tabletop RPG maps
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-6">
            {view === "signup" && "Create Account"}
            {view === "login" && "Sign In"}
            {view === "forgot-password" && "Reset Password"}
          </h1>

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

          {/* Forgot Password View */}
          {view === "forgot-password" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setView("login");
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}

          {/* Login/Signup Form */}
          {(view === "login" || view === "signup") && (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {view === "signup" && (
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Password
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading
                    ? "Loading..."
                    : view === "signup"
                      ? "Create Account"
                      : "Sign In"}
                </button>
              </form>

              {view === "login" && (
                <div className="text-center mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setView("forgot-password");
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:underline cursor-pointer"
                  >
                    Forgot your password?
                  </button>
                </div>
              )}

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setView(view === "signup" ? "login" : "signup");
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {view === "signup"
                    ? "Already have an account? Sign in"
                    : "Don't have an account? Sign up"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Email Verification Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeVerifyModal}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
            <button
              type="button"
              onClick={closeVerifyModal}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Email Not Verified
              </h2>
            </div>

            <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
              Your email address has not been verified. Please check your inbox for a verification link.
            </p>

            {modalError && (
              <div className="p-3 mb-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded text-sm">
                {modalError}
              </div>
            )}

            {modalSuccess && (
              <div className="p-3 mb-4 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-100 rounded text-sm">
                {modalSuccess}
              </div>
            )}

            <button
              type="button"
              onClick={handleResendVerification}
              disabled={loading}
              className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending..." : "Resend Verification Email"}
            </button>

            <button
              type="button"
              onClick={closeVerifyModal}
              className="w-full mt-2 text-sm text-gray-600 dark:text-gray-400 hover:underline cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
