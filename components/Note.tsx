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
  onDelete: () => void;
  onSelect: (multi: boolean) => void;
  onBringToFront: () => void;
  onDragStart: () => void;
  onDragEnd: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onDuplicate: () => void;
  multiSelected: boolean;
  setIsEditing: (editing: boolean) => void;
  autoFocus?: boolean;
}

export function Note({
  note,
  isSelected,
  viewport,
  onUpdate,
  onDelete,
  onSelect,
  onBringToFront,
  onDragStart,
  onDragEnd,
  onResize,
  onDuplicate,
  multiSelected,
  setIsEditing,
  autoFocus,
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

  // Drag handling
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

  // Context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const items: { label: string; action: () => void }[] = [
        {
          label: `Delete`,
          action: onDelete,
        },
        {
          label: `Duplicate`,
          action: onDuplicate,
        },
      ];

      // Build a simple menu string
      const menuText = items.map((item, i) => `${i + 1}. ${item.label}`).join("\n");
      const choice = window.prompt(`Note actions:\n\n${menuText}\n\nEnter number:`, "");
      if (choice) {
        const idx = parseInt(choice, 10) - 1;
        if (idx >= 0 && idx < items.length) {
          items[idx].action();
        }
      }
    },
    [onDelete, onDuplicate]
  );

  const colorClass = `note-${note.color}`;

  return (
    <div
      ref={noteRef}
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
      />
      <div
        className="resize-handle"
        onMouseDown={handleResizeStart}
      />
    </div>
  );
}
