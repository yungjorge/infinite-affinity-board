"use client";

import { useState, useRef, useCallback } from "react";
import { ViewportState } from "@/lib/boardTypes";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, DEFAULT_ZOOM } from "@/lib/constants";
import {
  screenToWorld as stw,
  worldToScreen as wts,
  clampZoom,
  getSelectionRect,
} from "@/lib/geometry";
import { BoardState } from "@/lib/boardTypes";

export interface CanvasControlsAPI {
  viewport: ViewportState;
  setViewport: (vp: ViewportState | ((prev: ViewportState) => ViewportState)) => void;
  screenToWorld: (sx: number, sy: number) => { x: number; y: number };
  worldToScreen: (wx: number, wy: number) => { x: number; y: number };
  fitAll: (board: BoardState, containerWidth: number, containerHeight: number) => void;
  isPanning: boolean;
  handleCanvasMouseDown: (e: React.MouseEvent, spaceHeld: boolean) => void;
  handleCanvasMouseMove: (e: React.MouseEvent) => void;
  handleCanvasMouseUp: () => void;
  handleWheel: (e: React.WheelEvent) => void;
  selectionRect: { x: number; y: number; width: number; height: number } | null;
}

export function useCanvasControls(
  onViewportChange: (vp: ViewportState) => void
): CanvasControlsAPI {
  const [viewport, setViewportState] = useState<ViewportState>({
    x: 0,
    y: 0,
    zoom: DEFAULT_ZOOM,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const actionRef = useRef<"none" | "panning" | "selecting">("none");
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const viewportStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDragging = useRef(false);

  const setViewport = useCallback(
    (vp: ViewportState | ((prev: ViewportState) => ViewportState)) => {
      setViewportState((prev) => {
        const next = typeof vp === "function" ? vp(prev) : vp;
        onViewportChange(next);
        return next;
      });
    },
    [onViewportChange]
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent, spaceHeld: boolean) => {
      if (spaceHeld) {
        actionRef.current = "panning";
      } else {
        actionRef.current = "selecting";
      }
      isDragging.current = false;
      dragStart.current = { x: e.clientX, y: e.clientY };
      viewportStart.current = { x: viewport.x, y: viewport.y };
      setSelectionRect(null);
      setIsPanning(spaceHeld);
      e.preventDefault();
    },
    [viewport.x, viewport.y]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (actionRef.current === "none") return;

      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;

      // Only start "dragging" after a 3px threshold
      if (!isDragging.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        isDragging.current = true;
      }

      if (!isDragging.current) return;

      if (actionRef.current === "panning") {
        setViewport({
          x: viewportStart.current.x + dx,
          y: viewportStart.current.y + dy,
          zoom: viewport.zoom,
        });
        setIsPanning(true);
      } else if (actionRef.current === "selecting") {
        // Convert screen positions to world coordinates using the viewport at drag start
        const startViewport = {
          ...viewport,
          x: viewportStart.current.x,
          y: viewportStart.current.y,
        };
        const start = stw(dragStart.current.x, dragStart.current.y, startViewport);
        const current = stw(e.clientX, e.clientY, viewport);
        const rect = getSelectionRect(start, current);
        setSelectionRect(rect);
      }
    },
    [viewport, setViewport]
  );

  const handleCanvasMouseUp = useCallback(() => {
    actionRef.current = "none";
    setIsPanning(false);
    setSelectionRect(null);
    isDragging.current = false;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      const newZoom = clampZoom(viewport.zoom * (1 + delta * ZOOM_STEP));

      // Zoom toward cursor position
      const mouseWorld = stw(e.clientX, e.clientY, viewport);
      setViewport({
        zoom: newZoom,
        x: e.clientX - mouseWorld.x * newZoom,
        y: e.clientY - mouseWorld.y * newZoom,
      });
    },
    [viewport, setViewport]
  );

  const fitAll = useCallback(
    (board: BoardState, containerWidth: number, containerHeight: number) => {
      const allItems = [...board.notes];
      for (const group of board.groups) {
        allItems.push({
          id: group.id,
          x: group.x,
          y: group.y,
          width: group.width,
          height: group.height,
          color: "yellow" as const,
          text: "",
          zIndex: group.zIndex,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
        });
      }

      if (allItems.length === 0) {
        setViewport({ x: 0, y: 0, zoom: DEFAULT_ZOOM });
        return;
      }

      // Compute bounds
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const item of allItems) {
        if (item.x < minX) minX = item.x;
        if (item.y < minY) minY = item.y;
        if (item.x + item.width > maxX) maxX = item.x + item.width;
        if (item.y + item.height > maxY) maxY = item.y + item.height;
      }

      const padding = 100;
      const bw = (maxX - minX) + padding * 2;
      const bh = (maxY - minY) + padding * 2;
      const sx = containerWidth / bw;
      const sy = containerHeight / bh;
      const z = Math.min(sx, sy, 2);
      const cx = minX + (maxX - minX) / 2;
      const cy = minY + (maxY - minY) / 2;

      setViewport({
        x: containerWidth / 2 - cx * z,
        y: containerHeight / 2 - cy * z,
        zoom: z,
      });
    },
    [setViewport]
  );

  return {
    viewport,
    setViewport,
    screenToWorld: (sx: number, sy: number) => stw(sx, sy, viewport),
    worldToScreen: (wx: number, wy: number) => wts(wx, wy, viewport),
    fitAll,
    isPanning,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleWheel,
    selectionRect,
  };
}
