import { TokenPanel } from "./TokenPanel";

export function Sidebar() {
  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
      <TokenPanel />
    </div>
  );
}
