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
import { snapToGrid } from "@/lib/geometry";
import { SNAP_GRID_SIZE } from "@/lib/constants";
import { Note } from "./Note";
import { Group } from "./Group";
import { Toolbar } from "./Toolbar";
import { SelectionBox } from "./SelectionBox";
import { ToastContainer } from "./Toast";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";

// ========== BOARD CONTEXT ==========
interface BoardContextType {
  boardAPI: BoardAPI;
  canvasAPI: CanvasControlsAPI;
  isPanning: boolean;
  selectionRect: { x: number; y: number; width: number; height: number } | null;
  setIsEditing: (v: boolean) => void;
  defaultColor: NoteColor;
  setDefaultColor: (c: NoteColor) => void;
  isMobile: boolean;
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
  const [isMobile, setIsMobile] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  // Long-press tracking for touch
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTarget = useRef<string | null>(null);
  const lastTapTime = useRef(0);
  const tapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Track container size with visualViewport awareness for mobile
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        // Use visualViewport on mobile for accurate height (iOS Safari address bar)
        const vw = window.visualViewport;
        const w = vw ? vw.width : containerRef.current.clientWidth;
        const h = vw ? vw.height : containerRef.current.clientHeight;
        setContainerSize({ width: w, height: h });
      }
    };
    updateSize();

    const onResize = () => updateSize();
    window.addEventListener("resize", onResize);

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", onResize);
      window.visualViewport.addEventListener("scroll", onResize);
    }

    // Also handle orientation changes
    window.addEventListener("orientationchange", () => {
      setTimeout(updateSize, 100);
    });

    return () => {
      window.removeEventListener("resize", onResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", onResize);
        window.visualViewport.removeEventListener("scroll", onResize);
      }
      window.removeEventListener("orientationchange", () => {});
    };
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

  // ── Canvas mouse handlers ──────────────────────────────

  const isCanvasTarget = useCallback((target: EventTarget) => {
    const el = target as HTMLElement;
    return !el.closest(".note-card, .group-frame, .context-menu");
  }, []);

  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isCanvasTarget(e.target)) return;
      canvasAPI.handleCanvasMouseDown(e, spaceHeldRef.current);
    },
    [canvasAPI, isCanvasTarget]
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
  }, [canvasAPI, boardAPI]);

  // Double-click empty canvas to add a note
  const onCanvasDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isCanvasTarget(e.target)) return;
      const world = canvasAPI.screenToWorld(e.clientX, e.clientY);
      boardAPI.clearSelection();
      const note = boardAPI.addNote(defaultColor);
      const snapX = boardAPI.board.settings.snapEnabled
        ? snapToGrid(world.x - 100, SNAP_GRID_SIZE)
        : world.x - 100;
      const snapY = boardAPI.board.settings.snapEnabled
        ? snapToGrid(world.y - 100, SNAP_GRID_SIZE)
        : world.y - 100;
      boardAPI.moveNote(note.id, snapX, snapY);
      setFocusedNoteId(note.id);
    },
    [canvasAPI, boardAPI, defaultColor, isCanvasTarget]
  );

  // ── Touch handlers for canvas ──────────────────────────

  const onCanvasTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // Check if touch is on a note or group
      const target = e.target as HTMLElement;
      const onElement = target.closest(".note-card, .group-frame");

      if (onElement) {
        // Long-press detection for context menu
        const id = onElement.getAttribute("data-id");
        if (id) {
          longPressTarget.current = id;
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
          longPressTimer.current = setTimeout(() => {
            // This will be handled by the Note/Group component's own long-press
          }, 500);
        }
        return;
      }

      // Touch on empty canvas
      if (e.touches.length === 1) {
        // Track tap vs drag
        const touch = e.touches[0];
        const now = Date.now();
        const timeSinceLastTap = now - lastTapTime.current;

        if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
          // Double tap - add note
          if (tapTimeout.current) clearTimeout(tapTimeout.current);
          const world = canvasAPI.screenToWorld(touch.clientX, touch.clientY);
          boardAPI.clearSelection();
          const note = boardAPI.addNote(defaultColor);
          const snapX = boardAPI.board.settings.snapEnabled
            ? snapToGrid(world.x - 75, SNAP_GRID_SIZE)
            : world.x - 75;
          const snapY = boardAPI.board.settings.snapEnabled
            ? snapToGrid(world.y - 70, SNAP_GRID_SIZE)
            : world.y - 70;
          boardAPI.moveNote(note.id, snapX, snapY);
          setFocusedNoteId(note.id);
          lastTapTime.current = 0;
          return;
        }

        lastTapTime.current = now;

        // Single tap - add note after short timeout (to differentiate from pan)
        tapTimeout.current = setTimeout(() => {
          // Only add note if user didn't pan (check via isDragging ref)
          // This is handled by checking if the touch moved significantly
        }, 300);
      }

      canvasAPI.handleTouchStart(e);
    },
    [canvasAPI, boardAPI, defaultColor]
  );

  const onCanvasTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      // Clear long-press timer
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      // Detect single tap on empty canvas (no drag)
      const touch = e.changedTouches[0];
      if (touch && e.touches.length === 0 && canvasAPI.selectionRect === null) {
        const target = e.target as HTMLElement;
        if (!target.closest(".note-card, .group-frame, .context-menu")) {
          // This was likely a tap (not a pan)
          const world = canvasAPI.screenToWorld(touch.clientX, touch.clientY);
          boardAPI.clearSelection();
          const note = boardAPI.addNote(defaultColor);
          const snapX = boardAPI.board.settings.snapEnabled
            ? snapToGrid(world.x - 75, SNAP_GRID_SIZE)
            : world.x - 75;
          const snapY = boardAPI.board.settings.snapEnabled
            ? snapToGrid(world.y - 70, SNAP_GRID_SIZE)
            : world.y - 70;
          boardAPI.moveNote(note.id, snapX, snapY);
          setFocusedNoteId(note.id);
        }
      }

      canvasAPI.handleTouchEnd(e);
    },
    [canvasAPI, boardAPI, defaultColor]
  );

  // Prevent iOS gesture zoom on the whole body
  useEffect(() => {
    const preventGesture = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);
    document.addEventListener("gestureend", preventGesture);
    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
    };
  }, []);

  // ── Context menu handlers ─────────────────────────────

  const showNoteContextMenu = useCallback(
    (noteId: string, screenX: number, screenY: number) => {
      const note = boardAPI.board.notes.find((n) => n.id === noteId);
      if (!note) return;

      setContextMenu({
        x: screenX,
        y: screenY,
        items: [
          {
            label: "Delete",
            icon: "🗑",
            danger: true,
            action: () => boardAPI.deleteNote(noteId),
          },
          {
            label: "Duplicate",
            icon: "📋",
            action: () => boardAPI.duplicateNote(noteId),
          },
        ],
      });
    },
    [boardAPI]
  );

  const showGroupContextMenu = useCallback(
    (groupId: string, screenX: number, screenY: number) => {
      const group = boardAPI.board.groups.find((g) => g.id === groupId);
      if (!group) return;

      setContextMenu({
        x: screenX,
        y: screenY,
        items: [
          {
            label: "Rename",
            icon: "✏️",
            action: () => {
              // Trigger rename via event
              window.dispatchEvent(
                new CustomEvent("group-rename", { detail: { groupId } })
              );
            },
          },
          {
            label: "Ungroup",
            icon: "🔓",
            action: () => boardAPI.ungroupNotes(groupId),
          },
          {
            label: "Delete Group",
            icon: "🗑",
            danger: true,
            action: () => boardAPI.deleteGroup(groupId),
          },
        ],
      });
    },
    [boardAPI]
  );

  // Determine cursor class
  const cursorClass = canvasAPI.isPanning
    ? "canvas-panning"
    : spaceHeldRef.current
      ? "canvas-grab"
      : "";

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
      let finalX = newX;
      let finalY = newY;

      // Apply snap-to-grid if enabled
      if (boardAPI.board.settings.snapEnabled) {
        finalX = snapToGrid(newX, SNAP_GRID_SIZE);
        finalY = snapToGrid(newY, SNAP_GRID_SIZE);
      }

      if (boardAPI.selectedNoteIds.length > 1) {
        const draggedNote = board.notes.find((n) => n.id === noteId);
        if (draggedNote) {
          const dx = finalX - draggedNote.x;
          const dy = finalY - draggedNote.y;
          const deltas = new Map<string, { x: number; y: number }>();
          for (const id of boardAPI.selectedNoteIds) {
            const n = board.notes.find((nn) => nn.id === id);
            if (n) {
              let nx = n.x + dx;
              let ny = n.y + dy;
              if (boardAPI.board.settings.snapEnabled) {
                nx = snapToGrid(nx, SNAP_GRID_SIZE);
                ny = snapToGrid(ny, SNAP_GRID_SIZE);
              }
              deltas.set(id, { x: nx, y: ny });
            }
          }
          boardAPI.moveNotes(deltas);
          return;
        }
      }
      boardAPI.moveNote(noteId, finalX, finalY);
    },
    [boardAPI, board.notes]
  );

  const handleNoteResize = useCallback(
    (noteId: string, width: number, height: number) => {
      let finalW = width;
      let finalH = height;
      if (boardAPI.board.settings.snapEnabled) {
        finalW = snapToGrid(width, SNAP_GRID_SIZE);
        finalH = snapToGrid(height, SNAP_GRID_SIZE);
      }
      boardAPI.resizeNote(noteId, finalW, finalH);
    },
    [boardAPI]
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
        isMobile,
      }}
    >
      <div className="relative w-full h-full select-none">
        <Toolbar />
        <div
          ref={containerRef}
          className={`w-full h-full canvas-bg ${cursorClass}`}
          style={{ height: "100dvh" }}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onDoubleClick={onCanvasDoubleClick}
          onWheel={canvasAPI.handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          onTouchStart={onCanvasTouchStart}
          onTouchMove={canvasAPI.handleTouchMove}
          onTouchEnd={onCanvasTouchEnd}
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
                onMoveGroupWithNotes={(dx, dy) =>
                  boardAPI.moveGroupWithNotes(group.id, dx, dy)
                }
                setIsEditing={keyboardShortcuts.setIsEditing}
                onContextMenu={(screenX, screenY) =>
                  showGroupContextMenu(group.id, screenX, screenY)
                }
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
                onSelect={(multi) => boardAPI.selectNote(note.id, multi)}
                onBringToFront={() => boardAPI.bringToFront(note.id)}
                onDragStart={() => {
                  boardAPI.bringToFront(note.id);
                }}
                onDragEnd={(x, y) => handleNoteDragEnd(note.id, x, y)}
                onResize={(w, h) => handleNoteResize(note.id, w, h)}
                setIsEditing={keyboardShortcuts.setIsEditing}
                autoFocus={focusedNoteId === note.id}
                onContextMenu={(screenX, screenY) =>
                  showNoteContextMenu(note.id, screenX, screenY)
                }
                isMobile={isMobile}
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
                  <h2>
                    {isMobile
                      ? "Tap anywhere to add your first note"
                      : "Click anywhere or press N to add your first note"}
                  </h2>
                  <p>
                    {isMobile
                      ? "Pinch to zoom · Two-finger drag to pan"
                      : "Use Space + drag to pan. Scroll to zoom."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        <ToastContainer />

        {/* Context menu */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={contextMenu.items}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    </BoardContext.Provider>
  );
}
