"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
  handleCanvasMouseUp: () => { selectedIds: string[] } | null;
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

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
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
        const start = stw(dragStart.current.x, dragStart.current.y, {
          ...viewport,
          x: viewportStart.current.x,
          y: viewportStart.current.y,
        });
        const current = stw(e.clientX, e.clientY, viewport);
        const rect = getSelectionRect(start, current);
        setSelectionRect(rect);
      }
    },
    [viewport, setViewport]
  );

  const handleCanvasMouseUp = useCallback((): { selectedIds: string[] } | null => {
    if (actionRef.current === "selecting" && selectionRect) {
      actionRef.current = "none";
      setSelectionRect(null);
      return null;
    }
    actionRef.current = "none";
    setIsPanning(false);
    setSelectionRect(null);
    return null;
  }, [selectionRect]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      const newZoom = clampZoom(viewport.zoom * (1 + delta * ZOOM_STEP));

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
      // Build a temporary list of all items as notes for bounds calculation
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

      const { getBoundsForNotes, fitBoundsToViewport } = {
        getBoundsForNotes: (items: typeof allItems) => {
          if (items.length === 0) return null;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const item of items) {
            if (item.x < minX) minX = item.x;
            if (item.y < minY) minY = item.y;
            if (item.x + item.width > maxX) maxX = item.x + item.width;
            if (item.y + item.height > maxY) maxY = item.y + item.height;
          }
          return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        },
        fitBoundsToViewport: (
          bounds: { x: number; y: number; width: number; height: number },
          cw: number,
          ch: number,
          p: number
        ) => {
          const bw = bounds.width + p * 2;
          const bh = bounds.height + p * 2;
          const sx = cw / bw;
          const sy = ch / bh;
          const z = Math.min(sx, sy, 2);
          const cx = bounds.x + bounds.width / 2;
          const cy = bounds.y + bounds.height / 2;
          return { x: cw / 2 - cx * z, y: ch / 2 - cy * z, zoom: z };
        },
      };
      const bounds = getBoundsForNotes(allItems);
      if (!bounds) {
        setViewport({ x: 0, y: 0, zoom: DEFAULT_ZOOM });
        return;
      }
      const fit = fitBoundsToViewport(bounds, containerWidth, containerHeight, 80);
      setViewport(fit);
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
