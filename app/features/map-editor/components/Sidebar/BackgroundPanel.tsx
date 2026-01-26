import { useMapStore } from "../../store";

const backgrounds = [
  { name: "Cellar", imageUrl: "/Cellar.png" },
];

export function BackgroundPanel() {
  const map = useMapStore((s) => s.map);
  const setBackground = useMapStore((s) => s.setBackground);

  const currentBackground = map?.background?.imageUrl;

  return (
    <div className="p-4 space-y-4 border-b border-gray-200 dark:border-gray-700">
      <h3 className="font-semibold text-gray-900 dark:text-white">Map Background</h3>
      <div className="flex flex-wrap gap-2">
        {backgrounds.map((bg) => (
          <button
            key={bg.name}
            onClick={() => setBackground(bg.imageUrl)}
            className={`flex flex-col items-center gap-1 p-2 rounded border cursor-pointer ${
              currentBackground === bg.imageUrl
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900"
                : "border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            title={`Set ${bg.name} as background`}
          >
            <img
              src={bg.imageUrl}
              alt={bg.name}
              className="w-12 h-12 object-cover rounded"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">
              {bg.name}
            </span>
          </button>
        ))}
        {currentBackground && (
          <button
            onClick={() => setBackground(null)}
            className="flex flex-col items-center justify-center gap-1 p-2 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 w-[72px] h-[72px] cursor-pointer"
            title="Remove background"
          >
            <span className="text-lg">✕</span>
            <span className="text-xs text-gray-700 dark:text-gray-300">
              None
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
