import { useMemo, useState } from "react";

interface TimezoneSelectProps {
  value: string;
  onChange: (tz: string) => void;
  disabled?: boolean;
}

// Group IANA timezones by region prefix
function getGroupedTimezones(): Map<string, string[]> {
  const all = Intl.supportedValuesOf("timeZone");
  const grouped = new Map<string, string[]>();

  for (const tz of all) {
    const slashIdx = tz.indexOf("/");
    const region = slashIdx > 0 ? tz.slice(0, slashIdx) : "Other";
    if (!grouped.has(region)) grouped.set(region, []);
    grouped.get(region)!.push(tz);
  }

  return grouped;
}

export function TimezoneSelect({ value, onChange, disabled }: TimezoneSelectProps) {
  const [search, setSearch] = useState("");
  const grouped = useMemo(getGroupedTimezones, []);

  // Filter timezones by search term
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    const result = new Map<string, string[]>();
    for (const [region, tzs] of grouped) {
      const filtered = tzs.filter((tz) => tz.toLowerCase().includes(q));
      if (filtered.length > 0) result.set(region, filtered);
    }
    return result;
  }, [grouped, search]);

  // Count total filtered options for showing search
  const totalOptions = useMemo(() => {
    let count = 0;
    for (const tzs of grouped.values()) count += tzs.length;
    return count;
  }, [grouped]);

  return (
    <div className="space-y-1.5">
      {totalOptions > 20 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search timezones..."
          className="w-full px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
      >
        <option value="">Select timezone...</option>
        {[...filteredGroups.entries()].map(([region, tzs]) => (
          <optgroup key={region} label={region}>
            {tzs.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
