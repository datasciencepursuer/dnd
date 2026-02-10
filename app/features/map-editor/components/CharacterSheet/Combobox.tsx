import { useState, useRef, useEffect, useCallback } from "react";

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxSuggestions?: number;
  /** When set, the input supports multiple comma-separated values and autocompletes only the current segment */
  delimiter?: string;
}

export function Combobox({
  value,
  onChange,
  suggestions,
  placeholder = "",
  className = "",
  disabled = false,
  maxSuggestions = 8,
  delimiter,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // For delimiter mode: extract the current segment being typed and already-chosen values
  const { currentSegment, existingValues } = delimiter
    ? (() => {
        const cursorPos = inputRef.current?.selectionStart ?? value.length;
        const beforeCursor = value.slice(0, cursorPos);
        const lastDelim = beforeCursor.lastIndexOf(delimiter.trim());
        const seg = lastDelim >= 0 ? beforeCursor.slice(lastDelim + delimiter.trim().length).trimStart() : beforeCursor;
        const existing = new Set(value.split(delimiter.trim()).map((s) => s.trim().toLowerCase()).filter(Boolean));
        return { currentSegment: seg, existingValues: existing };
      })()
    : { currentSegment: value, existingValues: new Set<string>() };

  const filtered = isOpen
    ? suggestions
        .filter((s) => {
          const lower = s.toLowerCase();
          if (delimiter && existingValues.has(lower)) return false;
          return lower.includes(currentSegment.toLowerCase());
        })
        .slice(0, maxSuggestions)
    : [];

  // Reset highlight when filtered results change
  useEffect(() => {
    setHighlightIndex(-1);
  }, [value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  const close = useCallback(() => {
    setIsOpen(false);
    setHighlightIndex(-1);
  }, []);

  const selectItem = useCallback(
    (item: string) => {
      if (delimiter) {
        // Replace only the current segment, keep everything before it
        const cursorPos = inputRef.current?.selectionStart ?? value.length;
        const beforeCursor = value.slice(0, cursorPos);
        const lastDelim = beforeCursor.lastIndexOf(delimiter.trim());
        const before = lastDelim >= 0 ? value.slice(0, lastDelim + delimiter.trim().length) + " " : "";
        const afterCursor = value.slice(cursorPos);
        const afterDelim = afterCursor.indexOf(delimiter.trim());
        const after = afterDelim >= 0 ? afterCursor.slice(afterDelim) : "";
        onChange(before + item + (after || delimiter));
        // Keep focus so user can continue adding items
        setHighlightIndex(-1);
        // Re-expand after selection since content changed
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.style.height = "auto";
            inputRef.current.style.height = inputRef.current.scrollHeight + "px";
          }
        });
      } else {
        onChange(item);
        close();
      }
    },
    [onChange, close, delimiter, value]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Always prevent Enter from creating newlines in the textarea
    if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && filtered.length > 0 && highlightIndex >= 0 && highlightIndex < filtered.length) {
        selectItem(filtered[highlightIndex]);
      } else {
        close();
      }
      return;
    }

    if (!isOpen || filtered.length === 0) {
      if (e.key === "ArrowDown" && suggestions.length > 0 && currentSegment.length > 0) {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < filtered.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : filtered.length - 1
        );
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
    }
  };

  const handleFocus = () => {
    if (delimiter ? currentSegment.length > 0 : value.length > 0) {
      setIsOpen(true);
    }
    // Auto-expand to show full content
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = inputRef.current.scrollHeight + "px";
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Don't close if clicking inside the dropdown
    if (
      wrapperRef.current &&
      e.relatedTarget &&
      wrapperRef.current.contains(e.relatedTarget as Node)
    ) {
      return;
    }
    close();
    // Collapse back to single line
    if (inputRef.current) {
      inputRef.current.style.height = "";
    }
    // Trim on blur like the original textareas
    const trimmed = value.trim();
    if (trimmed !== value) {
      onChange(trimmed);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => {
          const newValue = e.target.value;
          onChange(newValue);
          if (newValue.length > 0) {
            if (!isOpen) setIsOpen(true);
          } else {
            if (isOpen) close();
          }
          // Re-expand as content changes
          requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.style.height = "auto";
              inputRef.current.style.height = inputRef.current.scrollHeight + "px";
            }
          });
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={`${className} resize-none overflow-hidden`}
        style={{ lineHeight: "1.4" }}
        autoComplete="off"
      />
      {isOpen && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute left-0 right-0 top-full mt-0.5 z-50 max-h-40 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg"
        >
          {filtered.map((item, i) => (
            <li
              key={item}
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                selectItem(item);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
              className={`px-2 py-1 text-xs cursor-pointer ${
                i === highlightIndex
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100"
                  : "text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
