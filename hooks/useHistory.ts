"use client";

import { useState, useCallback, useRef } from "react";
import { BoardState } from "@/lib/boardTypes";
import { MAX_HISTORY } from "@/lib/constants";

export interface HistoryAPI {
  pushState: (state: BoardState) => void;
  undo: () => BoardState | null;
  redo: () => BoardState | null;
  canUndo: boolean;
  canRedo: boolean;
}

export function useHistory(): HistoryAPI {
  const undoStack = useRef<BoardState[]>([]);
  const redoStack = useRef<BoardState[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushState = useCallback((state: BoardState) => {
    undoStack.current.push(state);
    if (undoStack.current.length > MAX_HISTORY) {
      undoStack.current.shift();
    }
    redoStack.current = [];
    setCanUndo(undoStack.current.length > 1);
    setCanRedo(false);
  }, []);

  const undo = useCallback((): BoardState | null => {
    if (undoStack.current.length < 2) return null;
    const current = undoStack.current.pop()!;
    redoStack.current.push(current);
    const previous = undoStack.current[undoStack.current.length - 1];
    setCanUndo(undoStack.current.length > 1);
    setCanRedo(true);
    return JSON.parse(JSON.stringify(previous)) as BoardState;
  }, []);

  const redo = useCallback((): BoardState | null => {
    if (redoStack.current.length === 0) return null;
    const next = redoStack.current.pop()!;
    undoStack.current.push(next);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
    return JSON.parse(JSON.stringify(next)) as BoardState;
  }, []);

  return { pushState, undo, redo, canUndo, canRedo };
}
