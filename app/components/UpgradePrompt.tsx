import { Link } from "react-router";

interface UpgradePromptProps {
  feature: string;
  requiredTier?: string;
  variant?: "banner" | "inline" | "overlay";
  className?: string;
}

export function UpgradePrompt({
  feature,
  requiredTier,
  variant = "banner",
  className = "",
}: UpgradePromptProps) {
  if (variant === "inline") {
    return (
      <div className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>
        <Link to="/pricing" className="text-amber-600 dark:text-amber-400 hover:underline">
          Upgrade{requiredTier ? ` to ${requiredTier}` : ""}
        </Link>{" "}
        to unlock {feature}.
      </div>
    );
  }

  if (variant === "overlay") {
    return (
      <div className={`absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] rounded z-10 ${className}`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 text-center max-w-xs mx-4">
          <div className="text-amber-500 mb-2">
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            {feature} {requiredTier ? `requires ${requiredTier}` : "requires an upgrade"}.
          </p>
          <Link
            to="/pricing"
            className="inline-block px-4 py-1.5 bg-amber-600 text-white text-sm rounded hover:bg-amber-700"
          >
            View Plans
          </Link>
        </div>
      </div>
    );
  }

  // banner (default)
  return (
    <div className={`p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg ${className}`}>
      <p className="text-sm text-amber-800 dark:text-amber-200">
        {feature} {requiredTier ? `requires the ${requiredTier} plan` : "requires an upgrade"}.{" "}
        <Link to="/pricing" className="font-medium underline hover:no-underline">
          Upgrade now
        </Link>
      </p>
    </div>
  );
}
