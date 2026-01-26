import { create } from "zustand";
import type { EditorTool } from "../types";

interface EditorState {
  selectedTool: EditorTool;
  selectedElementIds: string[];
  currentColor: string;
  currentStrokeWidth: number;
  isDrawing: boolean;
  isPanning: boolean;
  snapToGrid: boolean;

  // Actions
  setTool: (tool: EditorTool) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setSelectedElements: (ids: string[]) => void;
  addSelectedElement: (id: string) => void;
  clearSelection: () => void;
  setIsDrawing: (isDrawing: boolean) => void;
  setIsPanning: (isPanning: boolean) => void;
  toggleSnapToGrid: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedTool: "select",
  selectedElementIds: [],
  currentColor: "#ef4444",
  currentStrokeWidth: 2,
  isDrawing: false,
  isPanning: false,
  snapToGrid: true,

  setTool: (tool) => set({ selectedTool: tool, selectedElementIds: [] }),

  setColor: (color) => set({ currentColor: color }),

  setStrokeWidth: (width) => set({ currentStrokeWidth: width }),

  setSelectedElements: (ids) => set({ selectedElementIds: ids }),

  addSelectedElement: (id) =>
    set((state) => ({
      selectedElementIds: [...state.selectedElementIds, id],
    })),

  clearSelection: () => set({ selectedElementIds: [] }),

  setIsDrawing: (isDrawing) => set({ isDrawing }),

  setIsPanning: (isPanning) => set({ isPanning }),

  toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
}));
