"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { GroupItem, NoteItem, ViewportState } from "@/lib/boardTypes";

interface GroupProps {
  group: GroupItem;
  notes: NoteItem[];
  isSelected: boolean;
  viewport: ViewportState;
  onSelect: (multi: boolean) => void;
  onUpdate: (updates: Partial<GroupItem>) => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  onUngroup: () => void;
  onMoveGroupWithNotes: (dx: number, dy: number) => void;
  setIsEditing: (editing: boolean) => void;
}

export function Group({
  group,
  notes,
  isSelected,
  viewport,
  onSelect,
  onUpdate,
  onDelete,
  onRename,
  onUngroup,
  onMoveGroupWithNotes,
  setIsEditing,
}: GroupProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(group.title);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const groupStartPos = useRef({ x: 0, y: 0 });
  const groupRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalTitle(group.title);
  }, [group.title]);

  // Auto-calculate group size from child notes
  useEffect(() => {
    if (notes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const note of notes) {
      if (note.x < minX) minX = note.x;
      if (note.y < minY) minY = note.y;
      if (note.x + note.width > maxX) maxX = note.x + note.width;
      if (note.y + note.height > maxY) maxY = note.y + note.height;
    }

    const newX = minX - 24;
    const newY = minY - 48;
    const newWidth = maxX - minX + 48;
    const newHeight = maxY - minY + 72;

    if (
      Math.abs(newX - group.x) > 1 ||
      Math.abs(newY - group.y) > 1 ||
      Math.abs(newWidth - group.width) > 1 ||
      Math.abs(newHeight - group.height) > 1
    ) {
      onUpdate({ x: newX, y: newY, width: newWidth, height: newHeight });
    }
  }, [notes, group.x, group.y, group.width, group.height, onUpdate]);

  // Drag handling - zoom-correct
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onSelect(e.shiftKey);
      setIsDragging(true);
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      groupStartPos.current = { x: group.x, y: group.y };
    },
    [group.x, group.y, onSelect]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragStartPos.current.x) / viewport.zoom;
      const dy = (e.clientY - dragStartPos.current.y) / viewport.zoom;
      if (groupRef.current) {
        const newX = groupStartPos.current.x + dx;
        const newY = groupStartPos.current.y + dy;
        groupRef.current.style.left = `${newX}px`;
        groupRef.current.style.top = `${newY}px`;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const dx = (e.clientX - dragStartPos.current.x) / viewport.zoom;
      const dy = (e.clientY - dragStartPos.current.y) / viewport.zoom;
      onMoveGroupWithNotes(dx, dy);
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, viewport.zoom, onMoveGroupWithNotes]);

  const handleTitleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsEditingTitle(true);
      setIsEditing(true);
      setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
          titleInputRef.current.select();
        }
      }, 0);
    },
    [setIsEditing]
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalTitle(e.target.value);
    },
    []
  );

  const handleTitleBlur = useCallback(() => {
    setIsEditingTitle(false);
    setIsEditing(false);
    if (localTitle.trim() && localTitle !== group.title) {
      onRename(localTitle.trim());
    } else {
      setLocalTitle(group.title);
    }
  }, [localTitle, group.title, onRename, setIsEditing]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        setIsEditingTitle(false);
        setIsEditing(false);
        if (localTitle.trim()) {
          onRename(localTitle.trim());
        } else {
          setLocalTitle(group.title);
        }
      }
      if (e.key === "Escape") {
        setLocalTitle(group.title);
        setIsEditingTitle(false);
        setIsEditing(false);
      }
    },
    [localTitle, group.title, onRename, setIsEditing]
  );

  // Context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Show a simple native-like action via prompt
      const action = window.prompt(
        `Group: ${group.title}\n\nType: rename, delete, ungroup, or cancel`,
        ""
      );
      if (action === "rename") {
        setIsEditingTitle(true);
        setIsEditing(true);
        setTimeout(() => titleInputRef.current?.focus(), 0);
      } else if (action === "delete") {
        onDelete();
      } else if (action === "ungroup") {
        onUngroup();
      }
    },
    [group.title, onDelete, onUngroup, setIsEditing]
  );

  const themeClass = `group-frame-${group.theme}`;
  const titleThemeClass = `group-${group.theme}-title`;

  return (
    <div
      ref={groupRef}
      className={`group-frame ${themeClass} ${isSelected ? "selected" : ""}`}
      style={{
        left: `${group.x}px`,
        top: `${group.y}px`,
        width: `${group.width}px`,
        height: `${group.height}px`,
        zIndex: group.zIndex,
        minHeight: "80px",
      }}
      onContextMenu={handleContextMenu}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Title bar */}
      <div
        className={`group-title-bar ${titleThemeClass}`}
        onMouseDown={handleDragStart}
      >
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            className="group-title-input"
            value={localTitle}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            style={{ color: "inherit", width: "120px" }}
          />
        ) : (
          <span
            style={{ cursor: "text", userSelect: "none" }}
            onClick={handleTitleClick}
          >
            {group.title}
          </span>
        )}
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <span style={{ fontSize: "10px", opacity: 0.6, userSelect: "none" }}>
            {notes.length} notes
          </span>
          <button
            className="group-btn"
            onClick={(e) => {
              e.stopPropagation();
              onUngroup();
            }}
            title="Ungroup"
          >
            ✕
          </button>
          <button
            className="group-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete group"
          >
            🗑
          </button>
        </div>
      </div>

      {/* Body area (padding for visual frame) */}
      <div className="group-body" style={{ height: "calc(100% - 28px)" }} />
    </div>
  );
}
