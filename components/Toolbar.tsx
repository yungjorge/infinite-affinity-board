"use client";

import React, { useState, useCallback, useRef } from "react";
import { useBoardContext } from "./Canvas";
import { ColorPicker } from "./ColorPicker";
import { ThemeToggle } from "./ThemeToggle";
import { ZOOM_STEP } from "@/lib/constants";
import { clampZoom } from "@/lib/geometry";

const MAX_SHARE_SIZE = 8000; // characters, roughly

function fireToast(message: string, type: "success" | "error" | "info" = "info") {
  window.dispatchEvent(
    new CustomEvent("toast", {
      detail: { message, type },
    })
  );
}

export function Toolbar() {
  const { boardAPI, canvasAPI, defaultColor, setDefaultColor } = useBoardContext();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddNote = useCallback(() => {
    boardAPI.addNote(defaultColor);
  }, [boardAPI, defaultColor]);

  const handleDelete = useCallback(() => {
    boardAPI.deleteSelected();
  }, [boardAPI]);

  const handleGroup = useCallback(() => {
    if (boardAPI.selectedNoteIds.length >= 2) {
      try {
        boardAPI.addGroup(boardAPI.selectedNoteIds);
        fireToast("Notes grouped", "success");
      } catch {
        fireToast("Could not create group", "error");
      }
    }
  }, [boardAPI]);

  const handleUngroup = useCallback(() => {
    if (boardAPI.selectedGroupIds.length > 0) {
      boardAPI.selectedGroupIds.forEach((id) => boardAPI.ungroupNotes(id));
      fireToast("Group ungrouped", "info");
    }
  }, [boardAPI]);

  const handleZoomIn = useCallback(() => {
    canvasAPI.setViewport((prev) => ({
      ...prev,
      zoom: clampZoom(prev.zoom + ZOOM_STEP),
    }));
  }, [canvasAPI]);

  const handleZoomOut = useCallback(() => {
    canvasAPI.setViewport((prev) => ({
      ...prev,
      zoom: clampZoom(prev.zoom - ZOOM_STEP),
    }));
  }, [canvasAPI]);

  const handleResetZoom = useCallback(() => {
    canvasAPI.setViewport((prev) => ({ ...prev, zoom: 1 }));
  }, [canvasAPI]);

  const handleFitAll = useCallback(() => {
    const el = document.querySelector(".canvas-bg");
    if (el) {
      const rect = el.getBoundingClientRect();
      canvasAPI.fitAll(boardAPI.board, rect.width, rect.height);
    }
  }, [canvasAPI, boardAPI.board]);

  const handleToggleGrid = useCallback(() => {
    boardAPI.setSettings({ gridEnabled: !boardAPI.board.settings.gridEnabled });
  }, [boardAPI]);

  const handleExport = useCallback(() => {
    const json = boardAPI.exportBoard();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `affinity-board-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    fireToast("Board exported as JSON", "success");
  }, [boardAPI]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result;
        if (typeof text === "string") {
          const ok = boardAPI.importBoard(text);
          if (ok) {
            fireToast("Board imported successfully", "success");
          } else {
            fireToast("Invalid board file — check the JSON format", "error");
          }
        }
      };
      reader.onerror = () => {
        fireToast("Could not read file", "error");
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [boardAPI]
  );

  const handleShare = useCallback(async () => {
    const json = boardAPI.exportBoard();
    if (json.length > MAX_SHARE_SIZE) {
      fireToast(
        "Board is too large for URL sharing — use JSON export instead",
        "error"
      );
      return;
    }

    const url = boardAPI.getShareUrl();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        fireToast("Share link copied to clipboard", "success");
      } catch {
        fireToast("Could not copy to clipboard — copy the URL manually", "error");
      }
    }
  }, [boardAPI]);

  const handleResetView = useCallback(() => {
    canvasAPI.setViewport({ x: 0, y: 0, zoom: 1 });
    fireToast("View reset", "info");
  }, [canvasAPI]);

  const hasSelection =
    boardAPI.selectedNoteIds.length > 0 || boardAPI.selectedGroupIds.length > 0;
  const canUngroup = boardAPI.selectedGroupIds.length > 0;
  const noteCount = boardAPI.board.notes.length;
  const groupCount = boardAPI.board.groups.length;

  const zoomPct = Math.round(canvasAPI.viewport.zoom * 100);

  return (
    <>
      <div className="toolbar">
        <span className="toolbar-label">Affinity</span>
        <div className="toolbar-separator" />

        {/* Pan indicator */}
        <button className="toolbar-btn" title="Pan (Space+drag)" aria-label="Pan tool">
          <span className="tooltip">Pan (Space+drag)</span>
          ✋
        </button>

        {/* Add note */}
        <button
          className="toolbar-btn"
          title="Add Note (N)"
          aria-label="Add note"
          onClick={handleAddNote}
        >
          <span className="tooltip">Add Note (N)</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a1 1 0 011 1v5h5a1 1 0 010 2H9v5a1 1 0 01-2 0V9H2a1 1 0 010-2h5V2a1 1 0 011-1z" />
          </svg>
        </button>

        {/* Color picker */}
        <div style={{ position: "relative" }}>
          <button
            className="toolbar-btn"
            title="Note Color"
            aria-label="Change default note color"
            onClick={() => setShowColorPicker(!showColorPicker)}
          >
            <span className="tooltip">Note Color</span>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "9999px",
                backgroundColor: {
                  yellow: "#FFF9C4",
                  pink: "#F8BBD0",
                  blue: "#BBDEFB",
                  green: "#C8E6C9",
                  orange: "#FFE0B2",
                  purple: "#E1BEE7",
                  white: "#FFFFFF",
                }[defaultColor],
                border: "1px solid rgba(0,0,0,0.15)",
              }}
            />
          </button>
          {showColorPicker && (
            <ColorPicker
              selectedColor={defaultColor}
              onSelect={(c) => {
                setDefaultColor(c);
                setShowColorPicker(false);
              }}
              onClose={() => setShowColorPicker(false)}
            />
          )}
        </div>

        <div className="toolbar-separator" />

        {/* Group */}
        <button
          className="toolbar-btn"
          title="Group (G)"
          aria-label="Group selected notes"
          disabled={boardAPI.selectedNoteIds.length < 2}
          onClick={handleGroup}
        >
          <span className="tooltip">Group (G)</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="1" width="5" height="6" rx="1" opacity="0.6" />
            <rect x="8" y="1" width="7" height="6" rx="1" opacity="0.6" />
            <rect x="3" y="9" width="10" height="6" rx="1" />
          </svg>
        </button>

        {/* Ungroup */}
        <button
          className="toolbar-btn"
          title="Ungroup"
          aria-label="Ungroup selected group"
          disabled={!canUngroup}
          onClick={handleUngroup}
        >
          <span className="tooltip">Ungroup</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="3" width="10" height="10" rx="1" />
            <line x1="6" y1="8" x2="10" y2="8" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>

        {/* Delete */}
        <button
          className="toolbar-btn"
          title="Delete (Del)"
          aria-label="Delete selected"
          disabled={!hasSelection}
          onClick={handleDelete}
        >
          <span className="tooltip">Delete (Del)</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 2a1 1 0 00-1 1v1H2a1 1 0 000 2h1v7a1 1 0 001 1h8a1 1 0 001-1V6h1a1 1 0 100-2h-2V3a1 1 0 00-1-1H5zm1 2h4v1H6V4zm0 3h1v5H6V7zm3 0h1v5H9V7z" />
          </svg>
        </button>

        <div className="toolbar-separator" />

        {/* Zoom out */}
        <button
          className="toolbar-btn"
          title="Zoom Out (Ctrl+-)"
          aria-label="Zoom out"
          onClick={handleZoomOut}
        >
          <span className="tooltip">Zoom Out (Ctrl+-)</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 8a1 1 0 011-1h10a1 1 0 110 2H3a1 1 0 01-1-1z" />
          </svg>
        </button>

        {/* Zoom percentage */}
        <button
          className="toolbar-btn toolbar-zoom-btn"
          title="Reset Zoom (click) / Reset View (right-click)"
          aria-label="Reset zoom to 100%"
          onClick={handleResetZoom}
          onContextMenu={(e) => {
            e.preventDefault();
            handleResetView();
          }}
        >
          <span className="tooltip">Reset Zoom (click) | Reset View (right-click)</span>
          {zoomPct}%
        </button>

        {/* Zoom in */}
        <button
          className="toolbar-btn"
          title="Zoom In (Ctrl+=)"
          aria-label="Zoom in"
          onClick={handleZoomIn}
        >
          <span className="tooltip">Zoom In (Ctrl+=)</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2a1 1 0 011 1v4h4a1 1 0 110 2H9v4a1 1 0 01-2 0V9H3a1 1 0 010-2h4V3a1 1 0 011-1z" />
          </svg>
        </button>

        {/* Fit all */}
        <button
          className="toolbar-btn"
          title="Fit All (Ctrl+0)"
          aria-label="Fit all notes in view"
          onClick={handleFitAll}
        >
          <span className="tooltip">Fit All (Ctrl+0)</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 1h5v2H3v3H1V1zm9 0h5v5h-2V3h-3V1zM1 10h2v3h3v2H1v-5zm12 0h2v5h-5v-2h3v-3z" />
          </svg>
        </button>

        <div className="toolbar-separator" />

        {/* Grid toggle */}
        <button
          className="toolbar-btn"
          title="Toggle Grid"
          aria-label="Toggle grid"
          onClick={handleToggleGrid}
          style={{
            opacity: boardAPI.board.settings.gridEnabled ? 1 : 0.45,
          }}
        >
          <span className="tooltip">Toggle Grid</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="1" width="4" height="4" rx="0.5" />
            <rect x="7" y="1" width="4" height="4" rx="0.5" />
            <rect x="13" y="1" width="2" height="4" rx="0.5" />
            <rect x="1" y="7" width="4" height="4" rx="0.5" />
            <rect x="7" y="7" width="4" height="4" rx="0.5" />
            <rect x="13" y="7" width="2" height="4" rx="0.5" />
            <rect x="1" y="13" width="4" height="2" rx="0.5" />
            <rect x="7" y="13" width="4" height="2" rx="0.5" />
            <rect x="13" y="13" width="2" height="2" rx="0.5" />
          </svg>
        </button>

        {/* Export */}
        <button
          className="toolbar-btn"
          title="Export JSON"
          aria-label="Export board as JSON"
          onClick={handleExport}
        >
          <span className="tooltip">Export JSON</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L7 9.586V2a1 1 0 011-1z" />
            <path d="M1 14a1 1 0 011-1h12a1 1 0 110 2H2a1 1 0 01-1-1z" />
          </svg>
        </button>

        {/* Import */}
        <button
          className="toolbar-btn"
          title="Import JSON"
          aria-label="Import board from JSON"
          onClick={handleImport}
        >
          <span className="tooltip">Import JSON</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L7 9.586V2a1 1 0 011-1z" transform="rotate(180 8 8)" />
            <path d="M1 14a1 1 0 011-1h12a1 1 0 110 2H2a1 1 0 01-1-1z" />
          </svg>
        </button>

        {/* Share */}
        <button
          className="toolbar-btn"
          title="Share Board"
          aria-label="Share board link"
          onClick={handleShare}
        >
          <span className="tooltip">Share Board</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11 2a2 2 0 00-1.57 3.28L6.35 7.32a2 2 0 100 1.36l3.08 2.04A2 2 0 1011 10a1.99 1.99 0 00-.37-1.13L7.51 6.83a2 2 0 000-1.66l3.12-2.04A2 2 0 0011 2z" />
          </svg>
        </button>

        <div className="toolbar-separator" />

        {/* Board stats */}
        {(noteCount > 0 || groupCount > 0) && (
          <span className="toolbar-stats">
            {noteCount} note{noteCount !== 1 ? "s" : ""}
            {groupCount > 0 && ` · ${groupCount} group${groupCount !== 1 ? "s" : ""}`}
          </span>
        )}

        <div className="toolbar-separator" />

        {/* Theme toggle */}
        <ThemeToggle />
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="import-input"
        onChange={handleFileChange}
      />
    </>
  );
}
