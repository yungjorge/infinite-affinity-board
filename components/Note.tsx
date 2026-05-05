"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { NoteItem } from "@/lib/boardTypes";
import { ViewportState } from "@/lib/boardTypes";
import { MIN_NOTE_WIDTH, MIN_NOTE_HEIGHT, MAX_NOTE_WIDTH, MAX_NOTE_HEIGHT } from "@/lib/constants";

interface NoteProps {
  note: NoteItem;
  isSelected: boolean;
  onUpdate: (updates: Partial<NoteItem>) => void;
  onDelete: () => void;
  onSelect: (multi: boolean) => void;
  onBringToFront: () => void;
  onDragStart: () => void;
  onDragEnd: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  viewport: ViewportState;
  setIsEditing: (editing: boolean) => void;
}

export function Note({
  note,
  isSelected,
  onUpdate,
  onSelect,
  onBringToFront,
  onDragStart,
  onDragEnd,
  onResize,
  viewport,
  setIsEditing,
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

  // Sync local text changes with debounce
  const textTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setLocalText(newText);
      if (textTimeout.current) clearTimeout(textTimeout.current);
      textTimeout.current = setTimeout(() => {
        onUpdate({ text: newText });
      }, 500);
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
      // Don't start drag from textarea or resize handle
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
        const dx = e.clientX - dragStartPos.current.x;
        const dy = e.clientY - dragStartPos.current.y;
        // Convert screen delta to world delta
        const worldDx = dx / viewport.zoom;
        const worldDy = dy / viewport.zoom;
        const newX = noteStartPos.current.x + worldDx;
        const newY = noteStartPos.current.y + worldDy;

        if (noteRef.current) {
          noteRef.current.style.left = `${newX}px`;
          noteRef.current.style.top = `${newY}px`;
        }
      }

      if (isResizing) {
        const dx = e.clientX - dragStartPos.current.x;
        const dy = e.clientY - dragStartPos.current.y;
        const worldDx = dx / viewport.zoom;
        const worldDy = dy / viewport.zoom;

        const newWidth = Math.min(
          MAX_NOTE_WIDTH,
          Math.max(MIN_NOTE_WIDTH, resizeStart.current.width + worldDx)
        );
        const newHeight = Math.min(
          MAX_NOTE_HEIGHT,
          Math.max(MIN_NOTE_HEIGHT, resizeStart.current.height + worldDy)
        );

        if (noteRef.current) {
          noteRef.current.style.width = `${newWidth}px`;
          noteRef.current.style.height = `${newHeight}px`;
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStartPos.current.x;
        const dy = e.clientY - dragStartPos.current.y;
        const worldDx = dx / viewport.zoom;
        const worldDy = dy / viewport.zoom;
        onDragEnd(noteStartPos.current.x + worldDx, noteStartPos.current.y + worldDy);
        setIsDragging(false);
      }

      if (isResizing) {
        const dx = e.clientX - dragStartPos.current.x;
        const dy = e.clientY - dragStartPos.current.y;
        const worldDx = dx / viewport.zoom;
        const worldDy = dy / viewport.zoom;
        const newWidth = Math.min(
          MAX_NOTE_WIDTH,
          Math.max(MIN_NOTE_WIDTH, resizeStart.current.width + worldDx)
        );
        const newHeight = Math.min(
          MAX_NOTE_HEIGHT,
          Math.max(MIN_NOTE_HEIGHT, resizeStart.current.height + worldDy)
        );
        onResize(newWidth, newHeight);
        setIsResizing(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, viewport.zoom, onDragEnd, onResize]);

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
    // Flush text
    if (textTimeout.current) {
      clearTimeout(textTimeout.current);
      onUpdate({ text: localText });
    }
  }, [setIsEditing, onUpdate, localText]);

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
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        value={localText}
        onChange={handleTextChange}
        onFocus={handleTextareaFocus}
        onBlur={handleTextareaBlur}
        className="w-full h-full bg-transparent border-none outline-none resize-none text-inherit font-sans text-sm leading-relaxed p-0 overflow-y-auto"
        placeholder="Type here..."
        style={{ color: "#333", cursor: "text" }}
      />
      <div
        className="resize-handle"
        onMouseDown={handleResizeStart}
      />
    </div>
  );
}
