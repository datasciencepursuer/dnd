import type { FreehandPath, FogCell } from "../types";

export type UndoAction =
  | { type: "drawing-add"; path: FreehandPath }
  | { type: "drawing-remove"; path: FreehandPath }
  | { type: "fog-paint"; cells: FogCell[] }
  | { type: "fog-erase"; cells: FogCell[] };

const MAX_UNDO = 50;
let stack: UndoAction[] = [];

export function pushUndo(action: UndoAction) {
  stack.push(action);
  if (stack.length > MAX_UNDO) {
    stack = stack.slice(stack.length - MAX_UNDO);
  }
}

export function popUndo(): UndoAction | undefined {
  return stack.pop();
}

export function clearUndoStack() {
  stack = [];
}
