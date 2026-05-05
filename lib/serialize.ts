import { BoardState, NoteColor } from "./boardTypes";


export function serializeBoard(boardState: BoardState): string {
  return JSON.stringify(boardState);
}

export function deserializeBoard(jsonString: string): BoardState | null {
  try {
    const data = JSON.parse(jsonString);
    if (!validateBoardShape(data)) return null;
    return data as BoardState;
  } catch {
    return null;
  }
}

const VALID_COLORS: NoteColor[] = [
  "yellow",
  "pink",
  "blue",
  "green",
  "orange",
  "purple",
  "white",
];

const VALID_THEMES = ["corkboard", "markerboard", "chalkboard"];

export function validateBoardShape(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const board = data as Record<string, unknown>;

  if (typeof board.version !== "number") return false;
  if (!Array.isArray(board.notes)) return false;
  if (!Array.isArray(board.groups)) return false;
  if (!board.viewport || typeof board.viewport !== "object") return false;
  if (!board.settings || typeof board.settings !== "object") return false;

  // Validate notes
  for (const note of board.notes) {
    if (typeof note !== "object" || !note) return false;
    const n = note as Record<string, unknown>;
    if (typeof n.id !== "string") return false;
    if (typeof n.x !== "number" || typeof n.y !== "number") return false;
    if (typeof n.width !== "number" || typeof n.height !== "number") return false;
    if (!VALID_COLORS.includes(n.color as NoteColor)) return false;
    if (typeof n.text !== "string") return false;
  }

  // Validate groups
  for (const group of board.groups) {
    if (typeof group !== "object" || !group) return false;
    const g = group as Record<string, unknown>;
    if (typeof g.id !== "string") return false;
    if (typeof g.x !== "number" || typeof g.y !== "number") return false;
    if (!VALID_THEMES.includes(g.theme as string)) return false;
    if (!Array.isArray(g.noteIds)) return false;
  }

  return true;
}

export function compressBoardForUrl(boardState: BoardState): string {
  const json = JSON.stringify(boardState);
  if (typeof window !== "undefined") {
    // Use base64 with Unicode-safe encoding
    return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    ));
  }
  return Buffer.from(json).toString("base64");
}

export function decompressBoardFromUrl(hash: string): BoardState | null {
  try {
    let json: string;
    if (typeof window !== "undefined") {
      const decoded = atob(hash);
      json = decodeURIComponent(
        Array.from(decoded)
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
    } else {
      json = Buffer.from(hash, "base64").toString("utf-8");
    }
    return deserializeBoard(json);
  } catch {
    return null;
  }
}

export function createShareUrl(boardState: BoardState): string {
  const hash = compressBoardForUrl(boardState);
  if (typeof window !== "undefined") {
    return `${window.location.origin}/board/${hash}`;
  }
  return `/board/${hash}`;
}
