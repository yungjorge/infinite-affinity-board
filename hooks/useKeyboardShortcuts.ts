"use client";

import { useEffect, useCallback, useRef } from "react";
import { BoardAPI } from "./useBoard";
import { CanvasControlsAPI } from "./useCanvasControls";
import { clampZoom } from "@/lib/geometry";
import { ZOOM_STEP } from "@/lib/constants";

interface KeyboardShortcutOptions {
  boardAPI: BoardAPI;
  canvasAPI: CanvasControlsAPI;
  containerRef: React.RefObject<HTMLDivElement | null>;
  defaultColor: string;
  setDefaultColor: (color: string) => void;
}

export function useKeyboardShortcuts({
  boardAPI,
  canvasAPI,
  containerRef,
}: KeyboardShortcutOptions) {
  const isEditingRef = useRef(false);

  const setIsEditing = useCallback((editing: boolean) => {
    isEditingRef.current = editing;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditingRef.current) return;

      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      switch (e.key.toLowerCase()) {
        case "n":
          if (!isCtrl) {
            e.preventDefault();
            boardAPI.addNote();
          }
          break;

        case "d":
          if (isCtrl) {
            e.preventDefault();
            if (boardAPI.selectedNoteIds.length > 0) {
              boardAPI.duplicateSelected();
            }
          }
          break;

        case "g":
          if (!isCtrl && boardAPI.selectedNoteIds.length >= 2) {
            e.preventDefault();
            try {
              boardAPI.addGroup(boardAPI.selectedNoteIds);
            } catch {
              // ignore
            }
          }
          break;

        case "delete":
        case "backspace":
          if (
            boardAPI.selectedNoteIds.length > 0 ||
            boardAPI.selectedGroupIds.length > 0
          ) {
            e.preventDefault();
            boardAPI.deleteSelected();
          }
          break;

        case "escape":
          e.preventDefault();
          boardAPI.clearSelection();
          break;

        case "a":
          if (isCtrl) {
            // Select all notes
            e.preventDefault();
            // We don't have selectAll, but we can select all via rubber-band
          }
          break;

        case "z":
          if (isCtrl && e.shiftKey) {
            e.preventDefault();
            boardAPI.redo();
          } else if (isCtrl) {
            e.preventDefault();
            boardAPI.undo();
          }
          break;

        case "=":
        case "+":
          if (isCtrl) {
            e.preventDefault();
            canvasAPI.setViewport((prev) => ({
              ...prev,
              zoom: clampZoom(prev.zoom + ZOOM_STEP),
            }));
          }
          break;

        case "-":
        case "_":
          if (isCtrl) {
            e.preventDefault();
            canvasAPI.setViewport((prev) => ({
              ...prev,
              zoom: clampZoom(prev.zoom - ZOOM_STEP),
            }));
          }
          break;

        case "0":
          if (isCtrl) {
            e.preventDefault();
            if (containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              canvasAPI.fitAll(boardAPI.board, rect.width, rect.height);
            }
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [boardAPI, canvasAPI, containerRef]);

  return { setIsEditing };
}
