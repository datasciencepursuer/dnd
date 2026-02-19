import type { Route } from "./+types/pricing";
import { Link, useSearchParams } from "react-router";
import { useState, useEffect } from "react";
import { getSession } from "~/.server/auth/session";
import { getUserTier } from "~/.server/subscription";
import { getTierLimits, tierDisplayName, type AccountTier } from "~/lib/tier-limits";

export function meta() {
  return [{ title: "Pricing - DnD Virtual Table Top" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  let currentTier: AccountTier = "free";

  if (session) {
    currentTier = await getUserTier(session.user.id);
  }

  return {
    isLoggedIn: !!session,
    currentTier,
    adventurerPriceId: process.env.STRIPE_ADVENTURER_PRICE_ID ?? "",
    dmPriceId: process.env.STRIPE_HERO_PRICE_ID ?? "",
  };
}

const tiers: { tier: AccountTier; price: number | null; description: string }[] = [
  { tier: "free", price: null, description: "Get started with the basics" },
  { tier: "adventurer", price: 5, description: "For regular players" },
  { tier: "dungeon_master", price: 10, description: "For serious DMs and group leaders" },
];

const features = [
  { label: "Maps", key: "maxMaps" as const, format: (v: number) => (v === Infinity ? "Unlimited" : String(v)) },
  { label: "Scenes per map", key: "maxScenesPerMap" as const, format: (v: number) => String(v) },
  { label: "Groups", key: "maxGroups" as const, format: (v: number) => String(v) },
  { label: "Map background uploads", key: "maxMapUploads" as const, format: (v: number) => (v === Infinity ? "Unlimited" : String(v)) },
  { label: "Token image uploads", key: "maxTokenUploads" as const, format: (v: number) => (v === Infinity ? "Unlimited" : String(v)) },
  { label: "Combat system", key: "combatSystem" as const, format: (v: boolean) => v ? "Yes" : "No" },
  { label: "Real-time sync", key: "realtimeSync" as const, format: (v: boolean) => v ? "Yes" : "No" },
  { label: "Chat whispers", key: "chatWhispers" as const, format: (v: boolean) => v ? "Yes" : "No" },
  { label: "Monster Compendium", key: "monsterCompendium" as const, format: (v: boolean) => v ? "Yes" : "No" },
  { label: "Character sheet library", key: "characterLibrary" as const, format: (v: boolean) => v ? "Yes" : "No" },
  { label: "Walls & terrain", key: "wallsAndTerrain" as const, format: (v: boolean) => v ? "Yes" : "No" },
  { label: "AI DM Assistant", key: "aiDmAssistant" as const, format: (v: boolean) => v ? "Yes" : "No" },
  { label: "Group scheduling", key: "groupScheduling" as const, format: (v: boolean) => v ? "Yes" : "No" },
  { label: "Group invitations", key: "groupInvitations" as const, format: (v: boolean) => v ? "Yes" : "No" },
];

export default function Pricing({ loaderData }: Route.ComponentProps) {
  const { isLoggedIn, currentTier, adventurerPriceId, dmPriceId } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscriptionStatus = searchParams.get("subscription");

  // Clear the query param after showing the message
  useEffect(() => {
    if (subscriptionStatus) {
      const timeout = setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 8000);
      return () => clearTimeout(timeout);
    }
  }, [subscriptionStatus, setSearchParams]);

  function getPriceId(tier: AccountTier): string | null {
    if (tier === "adventurer") return adventurerPriceId;
    if (tier === "dungeon_master") return dmPriceId;
    return null;
  }

  async function handleSubscribe(tier: AccountTier) {
    if (!isLoggedIn) {
      window.location.href = `/login?redirect=/pricing`;
      return;
    }

    const priceId = getPriceId(tier);
    if (!priceId) return;

    setLoading(tier);
    setError(null);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to create checkout session");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Pricing
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Choose the plan that fits your adventure
            </p>
          </div>
        </div>

        {subscriptionStatus === "success" && (
          <div className="p-3 mb-6 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-200 rounded">
            Subscription activated! Your account has been upgraded.
          </div>
        )}

        {error && (
          <div className="p-3 mb-6 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded">
            {error}
          </div>
        )}

        {/* Tier Cards with full feature list */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map(({ tier, price, description }) => {
            const limits = getTierLimits(tier);
            const isCurrent = currentTier === tier;
            const isPopular = tier === "dungeon_master";

            return (
              <div
                key={tier}
                className={`relative bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex flex-col ${
                  isPopular ? "ring-2 ring-amber-500" : "border border-gray-200 dark:border-gray-700"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <TierIcon tier={tier} />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {tierDisplayName(tier).replace(/^\S+\s/, "")}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 mb-6">
                  {price ? (
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      ${price}<span className="text-base font-normal text-gray-500">/mo</span>
                    </span>
                  ) : (
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">Free</span>
                  )}
                </div>

                {/* Full feature list */}
                <ul className="space-y-2 flex-1 mb-6">
                  {features.map(({ label, key, format }) => {
                    const value = limits[key];
                    const isEnabled = typeof value === "boolean" ? value : true;
                    const displayValue = typeof value === "boolean"
                      ? label
                      : `${(format as (v: number) => string)(value)} ${label.toLowerCase()}`;

                    return (
                      <li
                        key={key}
                        className={`flex items-center gap-2 text-sm ${
                          isEnabled
                            ? "text-gray-700 dark:text-gray-300"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        <FeatureIcon enabled={isEnabled} />
                        {displayValue}
                      </li>
                    );
                  })}
                </ul>

                {isCurrent ? (
                  <div className="w-full py-2 px-4 text-center text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                    Current Plan
                  </div>
                ) : price ? (
                  <button
                    type="button"
                    onClick={() => handleSubscribe(tier)}
                    disabled={!!loading}
                    className={`w-full py-2 px-4 text-sm font-medium text-white rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      isPopular
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {loading === tier ? "..." : "Subscribe"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        {!isLoggedIn && (
          <div className="text-center mt-8">
            <Link
              to="/login?redirect=/pricing"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              Sign in to subscribe
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function FeatureIcon({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function TierIcon({ tier }: { tier: AccountTier }) {
  const emoji = tier === "free" ? "🌿" : tier === "adventurer" ? "👟" : "⚔️";
  return <span className="text-4xl leading-none">{emoji}</span>;
}
