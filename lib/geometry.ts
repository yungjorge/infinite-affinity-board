import { ViewportState, NoteItem } from "./boardTypes";
import { MIN_ZOOM, MAX_ZOOM, SNAP_GRID_SIZE } from "./constants";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  viewport: ViewportState
): Point {
  return {
    x: (screenX - viewport.x) / viewport.zoom,
    y: (screenY - viewport.y) / viewport.zoom,
  };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: ViewportState
): Point {
  return {
    x: worldX * viewport.zoom + viewport.x,
    y: worldY * viewport.zoom + viewport.y,
  };
}

export function getBoundsForNotes(notes: NoteItem[]): Rect | null {
  if (notes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const note of notes) {
    if (note.x < minX) minX = note.x;
    if (note.y < minY) minY = note.y;
    if (note.x + note.width > maxX) maxX = note.x + note.width;
    if (note.y + note.height > maxY) maxY = note.y + note.height;
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    a.x > b.x + b.width ||
    a.y + a.height < b.y ||
    a.y > b.y + b.height
  );
}

export function fitBoundsToViewport(
  bounds: Rect,
  containerWidth: number,
  containerHeight: number,
  padding: number = 80
): { x: number; y: number; zoom: number } {
  const boundsWidth = bounds.width + padding * 2;
  const boundsHeight = bounds.height + padding * 2;

  const scaleX = containerWidth / boundsWidth;
  const scaleY = containerHeight / boundsHeight;
  const zoom = Math.min(scaleX, scaleY, 2);

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  return {
    x: containerWidth / 2 - centerX * zoom,
    y: containerHeight / 2 - centerY * zoom,
    zoom,
  };
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function getViewportCenter(
  viewport: ViewportState,
  containerWidth: number,
  containerHeight: number
): Point {
  return screenToWorld(containerWidth / 2, containerHeight / 2, viewport);
}

export function isPointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function getSelectionRect(
  start: Point,
  end: Point
): Rect {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return { x, y, width, height };
}

export function noteToRect(note: NoteItem): Rect {
  return { x: note.x, y: note.y, width: note.width, height: note.height };
}

export function snapToGrid(value: number, gridSize: number = SNAP_GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

export function snapPointToGrid(point: Point, gridSize: number = SNAP_GRID_SIZE): Point {
  return {
    x: snapToGrid(point.x, gridSize),
    y: snapToGrid(point.y, gridSize),
  };
}
