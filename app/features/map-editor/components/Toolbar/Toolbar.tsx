import { useEditorStore } from "../../store";
import type { EditorTool } from "../../types";

const tools: { id: EditorTool; label: string; icon: string }[] = [
  { id: "select", label: "Select", icon: "↖" },
  { id: "pan", label: "Pan", icon: "✋" },
  { id: "token", label: "Token", icon: "●" },
];

export function Toolbar() {
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex gap-1">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setTool(tool.id)}
            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
              selectedTool === tool.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
            title={tool.label}
          >
            <span className="mr-1">{tool.icon}</span>
            {tool.label}
          </button>
        ))}
      </div>
    </div>
  );
}
