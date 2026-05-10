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
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);

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

  // Double-click empty canvas to add a note
  const onCanvasDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== e.currentTarget && (e.target as HTMLElement).closest(".note-card, .group-frame")) {
        return;
      }
      const world = canvasAPI.screenToWorld(e.clientX, e.clientY);
      boardAPI.clearSelection();
      const note = boardAPI.addNote(defaultColor);
      boardAPI.moveNote(note.id, world.x - 100, world.y - 100);
      setFocusedNoteId(note.id);
    },
    [canvasAPI, boardAPI, defaultColor]
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

  // Multi-drag: when one selected note finishes dragging, move all others by same delta
  const handleNoteDragEnd = useCallback(
    (noteId: string, newX: number, newY: number) => {
      if (boardAPI.selectedNoteIds.length > 1) {
        // Find the dragged note to calculate delta
        const draggedNote = board.notes.find((n) => n.id === noteId);
        if (draggedNote) {
          const dx = newX - draggedNote.x;
          const dy = newY - draggedNote.y;
          const deltas = new Map<string, { x: number; y: number }>();
          for (const id of boardAPI.selectedNoteIds) {
            const n = board.notes.find((nn) => nn.id === id);
            if (n) {
              deltas.set(id, { x: n.x + dx, y: n.y + dy });
            }
          }
          boardAPI.moveNotes(deltas);
          return;
        }
      }
      // Single note move
      boardAPI.moveNote(noteId, newX, newY);
    },
    [boardAPI, board.notes]
  );

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
      <div className="relative w-full h-full select-none">
        <Toolbar />
        <div
          ref={containerRef}
          className={`w-full h-full canvas-bg ${cursorClass}`}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onDoubleClick={onCanvasDoubleClick}
          onWheel={canvasAPI.handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          style={{ touchAction: "none" }}
        >
          {/* Transformed canvas content */}
          <div
            className="absolute canvas-content"
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
                viewport={canvasAPI.viewport}
                onSelect={(multi) => boardAPI.selectGroup(group.id, multi)}
                onUpdate={(updates) => boardAPI.updateGroup(group.id, updates)}
                onDelete={() => boardAPI.deleteGroup(group.id)}
                onRename={(title) => boardAPI.renameGroup(group.id, title)}
                onUngroup={() => boardAPI.ungroupNotes(group.id)}
                onMoveGroupWithNotes={(dx, dy) => boardAPI.moveGroupWithNotes(group.id, dx, dy)}
                setIsEditing={keyboardShortcuts.setIsEditing}
              />
            ))}

            {/* Notes */}
            {sortedNotes.map((note) => (
              <Note
                key={note.id}
                note={note}
                isSelected={boardAPI.selectedNoteIds.includes(note.id)}
                multiSelected={
                  boardAPI.selectedNoteIds.length > 1 &&
                  boardAPI.selectedNoteIds.includes(note.id)
                }
                viewport={canvasAPI.viewport}
                onUpdate={(updates) => boardAPI.updateNote(note.id, updates)}
                onDelete={() => boardAPI.deleteNote(note.id)}
                onSelect={(multi) => boardAPI.selectNote(note.id, multi)}
                onBringToFront={() => boardAPI.bringToFront(note.id)}
                onDragStart={() => {
                  boardAPI.bringToFront(note.id);
                }}
                onDragEnd={(x, y) => handleNoteDragEnd(note.id, x, y)}
                onResize={(w, h) => boardAPI.resizeNote(note.id, w, h)}
                onDuplicate={() => boardAPI.duplicateNote(note.id)}
                setIsEditing={keyboardShortcuts.setIsEditing}
                autoFocus={focusedNoteId === note.id}
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
                  transform: `translate(${-canvasAPI.viewport.x / canvasAPI.viewport.zoom}px, ${-canvasAPI.viewport.y / canvasAPI.viewport.zoom}px)`,
                }}
              >
                <div className="empty-state-content">
                  <h2>Click anywhere or press <kbd className="kbd">N</kbd> to add your first note</h2>
                  <p>Use <kbd className="kbd">Space</kbd> + drag to pan. Scroll to zoom.</p>
                </div>
              </div>
            )}
          </div>
        </div>
        <ToastContainer />
      </div>
    </BoardContext.Provider>
  );
}
