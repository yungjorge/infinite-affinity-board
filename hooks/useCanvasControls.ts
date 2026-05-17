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
  // Touch handlers (call from Canvas component)
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: (e: React.TouchEvent) => void;
  selectionRect: { x: number; y: number; width: number; height: number } | null;
  // Whether this is a touch/mobile device
  isTouchDevice: boolean;
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
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const actionRef = useRef<"none" | "panning" | "selecting">("none");
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const viewportStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDragging = useRef(false);

  // Pinch zoom state
  const pinchStart = useRef<{
    distance: number;
    zoom: number;
    centerX: number;
    centerY: number;
    viewportX: number;
    viewportY: number;
  } | null>(null);
  const isPinching = useRef(false);

  // Detect touch device on mount
  useState(() => {
    if (typeof window !== "undefined") {
      setIsTouchDevice(
        "ontouchstart" in window || navigator.maxTouchPoints > 0
      );
    }
  });

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
      const mouseWorld = stw(e.clientX, e.clientY, viewport);
      setViewport({
        zoom: newZoom,
        x: e.clientX - mouseWorld.x * newZoom,
        y: e.clientY - mouseWorld.y * newZoom,
      });
    },
    [viewport, setViewport]
  );

  // ── Touch Handlers ────────────────────────────────────

  const getTouchDistance = (touches: React.TouchList): number => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch zoom start
        e.preventDefault();
        isPinching.current = true;
        actionRef.current = "none";
        isDragging.current = false;
        setSelectionRect(null);

        const dist = getTouchDistance(e.touches);
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        pinchStart.current = {
          distance: dist,
          zoom: viewport.zoom,
          centerX: cx,
          centerY: cy,
          viewportX: viewport.x,
          viewportY: viewport.y,
        };
      } else if (e.touches.length === 1 && !isPinching.current) {
        // Single finger: pan or select
        const touch = e.touches[0];
        // On mobile, single finger on canvas = pan by default
        actionRef.current = "panning";
        isDragging.current = false;
        dragStart.current = { x: touch.clientX, y: touch.clientY };
        viewportStart.current = { x: viewport.x, y: viewport.y };
        setSelectionRect(null);
        setIsPanning(true);
      }
    },
    [viewport]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 2 && pinchStart.current) {
        // Pinch zoom
        const dist = getTouchDistance(e.touches);
        const ratio = dist / pinchStart.current.distance;
        const newZoom = clampZoom(pinchStart.current.zoom * ratio);

        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        // Zoom toward pinch center
        const worldCenter = stw(
          pinchStart.current.centerX,
          pinchStart.current.centerY,
          { x: pinchStart.current.viewportX, y: pinchStart.current.viewportY, zoom: pinchStart.current.zoom }
        );

        const dx = cx - pinchStart.current.centerX;
        const dy = cy - pinchStart.current.centerY;

        setViewport({
          zoom: newZoom,
          x: cx - worldCenter.x * newZoom,
          y: cy - worldCenter.y * newZoom,
        });

        setIsPanning(true);
      } else if (e.touches.length === 1 && actionRef.current === "panning") {
        const touch = e.touches[0];
        const dx = touch.clientX - dragStart.current.x;
        const dy = touch.clientY - dragStart.current.y;

        if (!isDragging.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
          isDragging.current = true;
        }

        if (isDragging.current) {
          setViewport({
            x: viewportStart.current.x + dx,
            y: viewportStart.current.y + dy,
            zoom: viewport.zoom,
          });
          setIsPanning(true);
        }
      }
    },
    [viewport, setViewport]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 0) {
        actionRef.current = "none";
        setIsPanning(false);
        setSelectionRect(null);
        isDragging.current = false;
        isPinching.current = false;
        pinchStart.current = null;
      }
    },
    []
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
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    selectionRect,
    isTouchDevice,
  };
}
