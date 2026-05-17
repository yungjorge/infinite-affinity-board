"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { NoteItem } from "@/lib/boardTypes";
import { ViewportState } from "@/lib/boardTypes";
import { MIN_NOTE_WIDTH, MIN_NOTE_HEIGHT, MAX_NOTE_WIDTH, MAX_NOTE_HEIGHT } from "@/lib/constants";

interface NoteProps {
  note: NoteItem;
  isSelected: boolean;
  viewport: ViewportState;
  onUpdate: (updates: Partial<NoteItem>) => void;
  onSelect: (multi: boolean) => void;
  onBringToFront: () => void;
  onDragStart: () => void;
  onDragEnd: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  multiSelected: boolean;
  setIsEditing: (editing: boolean) => void;
  autoFocus?: boolean;
  onContextMenu: (screenX: number, screenY: number) => void;
  isMobile: boolean;
}

export function Note({
  note,
  isSelected,
  viewport,
  onUpdate,
  onSelect,
  onBringToFront,
  onDragStart,
  onDragEnd,
  onResize,
  multiSelected,
  setIsEditing,
  autoFocus,
  onContextMenu,
  isMobile,
}: NoteProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [localText, setLocalText] = useState(note.text);
  const [appeared, setAppeared] = useState(false);

  const dragStartPos = useRef({ x: 0, y: 0 });
  const noteStartPos = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ width: 0, height: 0 });
  const noteRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Long-press tracking
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const hasMoved = useRef(false);

  useEffect(() => {
    setLocalText(note.text);
  }, [note.text]);

  useEffect(() => {
    setAppeared(true);
  }, []);

  // Auto-focus textarea if this note was just created
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [autoFocus]);

  // Sync local text changes with debounce
  const textTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setLocalText(newText);
      if (textTimeout.current) clearTimeout(textTimeout.current);
      textTimeout.current = setTimeout(() => {
        onUpdate({ text: newText });
      }, 300);
    },
    [onUpdate]
  );

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, []);

  useEffect(() => {
    autoResize();
  }, [localText, autoResize]);

  // ── Mouse Drag Handling ───────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.closest(".resize-handle")) {
        return;
      }

      e.stopPropagation();
      e.preventDefault();
      onBringToFront();
      onDragStart();
      onSelect(e.shiftKey);

      setIsDragging(true);
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      noteStartPos.current = { x: note.x, y: note.y };
    },
    [note.x, note.y, onBringToFront, onDragStart, onSelect]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsResizing(true);
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      resizeStart.current = { width: note.width, height: note.height };
    },
    [note.width, note.height]
  );

  // ── Touch Drag Handling ───────────────────────────────

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA") {
        return;
      }
      if (target.closest(".resize-handle")) {
        e.stopPropagation();
        e.preventDefault();
        const touch = e.touches[0];
        setIsResizing(true);
        dragStartPos.current = { x: touch.clientX, y: touch.clientY };
        resizeStart.current = { width: note.width, height: note.height };
        return;
      }

      e.stopPropagation();
      e.preventDefault();

      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      hasMoved.current = false;

      onBringToFront();
      onDragStart();

      // Long-press detection
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      longPressTimer.current = setTimeout(() => {
        if (!hasMoved.current && noteRef.current) {
          const rect = noteRef.current.getBoundingClientRect();
          onContextMenu(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
      }, 600);
    },
    [note.width, note.height, onBringToFront, onDragStart, onContextMenu]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || !touchStartPos.current) return;

      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);

      if (dx > 5 || dy > 5) {
        hasMoved.current = true;
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }

      if (!isDragging && !isResizing && (dx > 3 || dy > 3)) {
        onSelect(false);
        setIsDragging(true);
        dragStartPos.current = { x: touchStartPos.current.x, y: touchStartPos.current.y };
        noteStartPos.current = { x: note.x, y: note.y };
      }

      if (isDragging) {
        const moveDx = (touch.clientX - dragStartPos.current.x) / viewport.zoom;
        const moveDy = (touch.clientY - dragStartPos.current.y) / viewport.zoom;

        if (noteRef.current) {
          const newX = noteStartPos.current.x + moveDx;
          const newY = noteStartPos.current.y + moveDy;
          noteRef.current.style.left = `${newX}px`;
          noteRef.current.style.top = `${newY}px`;
        }
      }

      if (isResizing) {
        const resizeDx = (touch.clientX - dragStartPos.current.x) / viewport.zoom;
        const resizeDy = (touch.clientY - dragStartPos.current.y) / viewport.zoom;

        const newWidth = Math.min(
          MAX_NOTE_WIDTH,
          Math.max(MIN_NOTE_WIDTH, resizeStart.current.width + resizeDx)
        );
        const newHeight = Math.min(
          MAX_NOTE_HEIGHT,
          Math.max(MIN_NOTE_HEIGHT, resizeStart.current.height + resizeDy)
        );

        if (noteRef.current) {
          noteRef.current.style.width = `${newWidth}px`;
          noteRef.current.style.height = `${newHeight}px`;
        }
      }
    },
    [isDragging, isResizing, viewport.zoom, note.x, note.y, onSelect]
  );

  const handleTouchEnd = useCallback(
    () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      if (isDragging) {
        if (noteRef.current) {
          const left = parseFloat(noteRef.current.style.left);
          const top = parseFloat(noteRef.current.style.top);
          if (!isNaN(left) && !isNaN(top)) {
            onDragEnd(left, top);
          }
        }
        setIsDragging(false);
      }

      if (isResizing) {
        if (noteRef.current) {
          const newW = parseFloat(noteRef.current.style.width);
          const newH = parseFloat(noteRef.current.style.height);
          if (!isNaN(newW) && !isNaN(newH)) {
            onResize(
              Math.min(MAX_NOTE_WIDTH, Math.max(MIN_NOTE_WIDTH, newW)),
              Math.min(MAX_NOTE_HEIGHT, Math.max(MIN_NOTE_HEIGHT, newH))
            );
          }
        }
        setIsResizing(false);
      }

      touchStartPos.current = null;
    },
    [isDragging, isResizing, onDragEnd, onResize]
  );

  // ── Mouse Move/Up (shared with resize) ────────────────

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = (e.clientX - dragStartPos.current.x) / viewport.zoom;
        const dy = (e.clientY - dragStartPos.current.y) / viewport.zoom;

        if (noteRef.current) {
          const newX = noteStartPos.current.x + dx;
          const newY = noteStartPos.current.y + dy;
          noteRef.current.style.left = `${newX}px`;
          noteRef.current.style.top = `${newY}px`;
        }
      }

      if (isResizing) {
        const dx = (e.clientX - dragStartPos.current.x) / viewport.zoom;
        const dy = (e.clientY - dragStartPos.current.y) / viewport.zoom;

        const newWidth = Math.min(
          MAX_NOTE_WIDTH,
          Math.max(MIN_NOTE_WIDTH, resizeStart.current.width + dx)
        );
        const newHeight = Math.min(
          MAX_NOTE_HEIGHT,
          Math.max(MIN_NOTE_HEIGHT, resizeStart.current.height + dy)
        );

        if (noteRef.current) {
          noteRef.current.style.width = `${newWidth}px`;
          noteRef.current.style.height = `${newHeight}px`;
        }
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        if (noteRef.current) {
          const left = parseFloat(noteRef.current.style.left);
          const top = parseFloat(noteRef.current.style.top);
          if (!isNaN(left) && !isNaN(top)) {
            onDragEnd(left, top);
          }
        }
        setIsDragging(false);
      }

      if (isResizing) {
        if (noteRef.current) {
          const newW = parseFloat(noteRef.current.style.width);
          const newH = parseFloat(noteRef.current.style.height);
          if (!isNaN(newW) && !isNaN(newH)) {
            onResize(
              Math.min(MAX_NOTE_WIDTH, Math.max(MIN_NOTE_WIDTH, newW)),
              Math.min(MAX_NOTE_HEIGHT, Math.max(MIN_NOTE_HEIGHT, newH))
            );
          }
        }
        setIsResizing(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, viewport.zoom, onDragEnd, onResize, note.x, note.y, note.id, multiSelected]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    },
    []
  );

  const handleTextareaFocus = useCallback(() => {
    setIsEditing(true);
  }, [setIsEditing]);

  const handleTextareaBlur = useCallback(() => {
    setIsEditing(false);
    if (textTimeout.current) {
      clearTimeout(textTimeout.current);
      onUpdate({ text: localText });
    }
  }, [setIsEditing, onUpdate, localText]);

  // Context menu (right-click on desktop)
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(e.clientX, e.clientY);
    },
    [onContextMenu]
  );

  const colorClass = `note-${note.color}`;

  return (
    <div
      ref={noteRef}
      data-id={note.id}
      className={`note-card ${colorClass} ${isSelected ? "selected" : ""} ${
        isDragging ? "dragging" : ""
      } ${appeared ? "note-appear" : ""}`}
      style={{
        left: `${note.x}px`,
        top: `${note.y}px`,
        width: `${note.width}px`,
        height: `${note.height}px`,
        zIndex: isDragging ? 9999 : note.zIndex,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        value={localText}
        onChange={handleTextChange}
        onFocus={handleTextareaFocus}
        onBlur={handleTextareaBlur}
        className="note-textarea"
        placeholder="Type here..."
        style={{ fontSize: isMobile ? "13px" : "14px" }}
      />
      <div
        className="resize-handle"
        onMouseDown={handleResizeStart}
      />
    </div>
  );
}
