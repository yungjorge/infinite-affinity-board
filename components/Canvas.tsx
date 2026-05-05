"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  createContext,
  useContext,
} from "react";
import { useBoard, BoardAPI } from "@/hooks/useBoard";
import { useCanvasControls, CanvasControlsAPI } from "@/hooks/useCanvasControls";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { NoteColor, GroupItem } from "@/lib/boardTypes";
import { Note } from "./Note";
import { Group } from "./Group";
import { Toolbar } from "./Toolbar";
import { SelectionBox } from "./SelectionBox";
import { ToastContainer } from "./Toast";

// ========== BOARD CONTEXT ==========
interface BoardContextType {
  boardAPI: BoardAPI;
  canvasAPI: CanvasControlsAPI;
  isPanning: boolean;
  selectionRect: { x: number; y: number; width: number; height: number } | null;
  setIsEditing: (v: boolean) => void;
  defaultColor: NoteColor;
  setDefaultColor: (c: NoteColor) => void;
}

const BoardContext = createContext<BoardContextType | null>(null);

export function useBoardContext() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error("useBoardContext must be used inside Canvas");
  return ctx;
}

// ========== CANVAS ==========
export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const spaceHeldRef = useRef(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [defaultColor, setDefaultColor] = useState<NoteColor>("yellow");
  // Toast container handles its own useToast hook
  void 0; // ensure useToast is imported

  // Track container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const boardAPI = useBoard(
    containerSize.width > 0 ? containerSize : undefined
  );

  const canvasAPI = useCanvasControls((vp) => {
    boardAPI.setViewport(vp);
  });

  // Sync viewport from board on mount
  useEffect(() => {
    canvasAPI.setViewport(boardAPI.board.viewport);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const keyboardShortcuts = useKeyboardShortcuts({
    boardAPI,
    canvasAPI,
    containerRef,
    defaultColor,
    setDefaultColor: (c: string) => setDefaultColor(c as NoteColor),
  });

  // Space key tracking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        // Don't capture if editing
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) return;
        e.preventDefault();
        spaceHeldRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeldRef.current = false;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Canvas mouse handlers
  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only trigger on the canvas background itself
      if (e.target !== e.currentTarget && (e.target as HTMLElement).closest(".note-card, .group-frame")) {
        return;
      }
      canvasAPI.handleCanvasMouseDown(e, spaceHeldRef.current);
    },
    [canvasAPI]
  );

  const onCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      canvasAPI.handleCanvasMouseMove(e);
    },
    [canvasAPI]
  );

  const onCanvasMouseUp = useCallback(() => {
      const rect = canvasAPI.selectionRect;
      canvasAPI.handleCanvasMouseUp();
      if (rect && rect.width > 4 && rect.height > 4) {
        boardAPI.selectAllInRect(rect.x, rect.y, rect.width, rect.height);
      }
    },
    [canvasAPI, boardAPI]
  );

  // Determine cursor class
  const cursorClass = canvasAPI.isPanning ? "canvas-panning" : spaceHeldRef.current ? "canvas-grab" : "";

  const { board } = boardAPI;
  const isEmpty = board.notes.length === 0 && board.groups.length === 0;

  // Sort groups by zIndex for rendering
  const sortedGroups = [...board.groups].sort((a, b) => a.zIndex - b.zIndex);
  const sortedNotes = [...board.notes].sort((a, b) => a.zIndex - b.zIndex);

  // Get notes for a group
  const getGroupNotes = (group: GroupItem) =>
    board.notes.filter((n) => group.noteIds.includes(n.id));

  return (
    <BoardContext.Provider
      value={{
        boardAPI,
        canvasAPI,
        isPanning: canvasAPI.isPanning,
        selectionRect: canvasAPI.selectionRect,
        setIsEditing: keyboardShortcuts.setIsEditing,
        defaultColor,
        setDefaultColor,
      }}
    >
      <div className="relative w-full h-full">
        <Toolbar />
        <div
          ref={containerRef}
          className={`w-full h-full canvas-bg ${cursorClass}`}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onWheel={canvasAPI.handleWheel}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Transformed canvas content */}
          <div
            className="absolute"
            style={{
              transform: `translate(${canvasAPI.viewport.x}px, ${canvasAPI.viewport.y}px) scale(${canvasAPI.viewport.zoom})`,
              transformOrigin: "0 0",
              width: 0,
              height: 0,
            }}
          >
            {/* Groups (behind notes) */}
            {sortedGroups.map((group) => (
              <Group
                key={group.id}
                group={group}
                notes={getGroupNotes(group)}
                isSelected={boardAPI.selectedGroupIds.includes(group.id)}
                onSelect={(multi) => boardAPI.selectGroup(group.id, multi)}
                onUpdate={(updates) => boardAPI.updateGroup(group.id, updates)}
                onDelete={() => boardAPI.deleteGroup(group.id)}
                onRename={(title) => boardAPI.renameGroup(group.id, title)}
                onUngroup={() => boardAPI.ungroupNotes(group.id)}
                setIsEditing={keyboardShortcuts.setIsEditing}
              />
            ))}

            {/* Notes */}
            {sortedNotes.map((note) => (
              <Note
                key={note.id}
                note={note}
                isSelected={boardAPI.selectedNoteIds.includes(note.id)}
                onUpdate={(updates) => boardAPI.updateNote(note.id, updates)}
                onDelete={() => boardAPI.deleteNote(note.id)}
                onSelect={(multi) => boardAPI.selectNote(note.id, multi)}
                onBringToFront={() => boardAPI.bringToFront(note.id)}
                onDragStart={() => {
                  boardAPI.bringToFront(note.id);
                }}
                onDragEnd={(x, y) => {
                  boardAPI.moveNote(note.id, x, y);
                }}
                onResize={(w, h) => boardAPI.resizeNote(note.id, w, h)}
                viewport={canvasAPI.viewport}
                setIsEditing={keyboardShortcuts.setIsEditing}
              />
            ))}

            {/* Selection box */}
            {canvasAPI.selectionRect && (
              <SelectionBox {...canvasAPI.selectionRect} />
            )}

            {/* Empty state */}
            {isEmpty && (
              <div
                className="empty-state"
                style={{
                  left: canvasAPI.viewport.x + containerSize.width / 2 / canvasAPI.viewport.zoom,
                  top: canvasAPI.viewport.y + containerSize.height / 2 / canvasAPI.viewport.zoom,
                }}
              >
                <h2>Click anywhere or press <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono">N</kbd> to add your first note</h2>
                <p>Drag to move around. Scroll to zoom.</p>
              </div>
            )}
          </div>
        </div>
        <ToastContainer />
      </div>
    </BoardContext.Provider>
  );
}
