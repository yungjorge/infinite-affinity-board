import { NoteColor } from "./boardTypes";

export const DEFAULT_NOTE_WIDTH = 200;
export const DEFAULT_NOTE_HEIGHT = 200;
export const MOBILE_NOTE_WIDTH = 150;
export const MOBILE_NOTE_HEIGHT = 140;
export const MIN_NOTE_WIDTH = 120;
export const MIN_NOTE_HEIGHT = 100;
export const MAX_NOTE_WIDTH = 600;
export const MAX_NOTE_HEIGHT = 600;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;
export const ZOOM_STEP = 0.1;
export const DEFAULT_ZOOM = 1;
export const STORAGE_KEY = "affinity-board";
export const SHARE_PREFIX = "/board/";
export const SNAP_GRID_SIZE = 20;

export const NOTE_COLORS: Record<NoteColor, string> = {
  yellow: "#FFF9C4",
  pink: "#F8BBD0",
  blue: "#BBDEFB",
  green: "#C8E6C9",
  orange: "#FFE0B2",
  purple: "#E1BEE7",
  white: "#FFFFFF",
};

export const GROUP_THEME_COLORS: Record<
  "corkboard" | "markerboard" | "chalkboard",
  { bg: string; border: string; text: string }
> = {
  corkboard: {
    bg: "#D4A574",
    border: "#A67B5B",
    text: "#4A3728",
  },
  markerboard: {
    bg: "#F5F5F5",
    border: "#E0E0E0",
    text: "#333333",
  },
  chalkboard: {
    bg: "#2D4A3E",
    border: "rgba(255,255,255,0.15)",
    text: "#D4E4D8",
  },
};

export const BOARD_VERSION = 1;
export const MAX_HISTORY = 50;
