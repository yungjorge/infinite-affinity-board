"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  BoardState,
  NoteItem,
  GroupItem,
  NoteColor,
  BoardSettings,
  ViewportState,
} from "@/lib/boardTypes";
import { generateId } from "@/lib/id";
import {
  DEFAULT_NOTE_WIDTH,
  DEFAULT_NOTE_HEIGHT,
} from "@/lib/constants";
import { saveBoard, loadBoard } from "@/lib/storage";
import { getViewportCenter, getBoundsForNotes, noteToRect, rectsIntersect } from "@/lib/geometry";
import { compressBoardForUrl } from "@/lib/serialize";

const defaultBoardState: BoardState = {
  version: 1,
  notes: [],
  groups: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  settings: { theme: "system", gridEnabled: true },
  updatedAt: Date.now(),
};

export interface BoardAPI {
  board: BoardState;
  selectedNoteIds: string[];
  selectedGroupIds: string[];

  addNote: (defaultColor?: NoteColor) => NoteItem;
  updateNote: (id: string, updates: Partial<NoteItem>) => void;
  deleteNote: (id: string) => void;
  moveNote: (id: string, x: number, y: number) => void;
  resizeNote: (id: string, width: number, height: number) => void;
  changeNoteColor: (id: string, color: NoteColor) => void;
  bringToFront: (id: string) => void;

  addGroup: (noteIds: string[]) => GroupItem;
  updateGroup: (id: string, updates: Partial<GroupItem>) => void;
  deleteGroup: (id: string) => void;
  renameGroup: (id: string, title: string) => void;
  ungroupNotes: (groupId: string) => void;

  setViewport: (vp: ViewportState) => void;
  setSettings: (settings: Partial<BoardSettings>) => void;

  selectNote: (id: string, multi?: boolean) => void;
  selectGroup: (id: string, multi?: boolean) => void;
  clearSelection: () => void;
  selectAllInRect: (x: number, y: number, width: number, height: number) => void;
  deleteSelected: () => void;

  exportBoard: () => string;
  importBoard: (json: string) => boolean;
  getShareUrl: () => string;

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useBoard(containerSize?: { width: number; height: number }) {
  const [board, setBoard] = useState<BoardState>(() => {
    if (typeof window === "undefined") return defaultBoardState;
    const saved = loadBoard();
    return saved && saved.version >= 1 ? saved : defaultBoardState;
  });

  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [lastZIndex, setLastZIndex] = useState(() => {
    const maxNote = Math.max(0, ...(board.notes.map((n) => n.zIndex)));
    const maxGroup = Math.max(0, ...(board.groups.map((g) => g.zIndex)));
    return Math.max(maxNote, maxGroup);
  });

  const undoStack = useRef<BoardState[]>([]);
  const redoStack = useRef<BoardState[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback((state: BoardState) => {
    undoStack.current.push(JSON.parse(JSON.stringify(state)));
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    setCanUndo(undoStack.current.length > 1);
    setCanRedo(false);
  }, []);

  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistState = useCallback(
    (newBoard: BoardState) => {
      setBoard(newBoard);
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(() => {
        saveBoard(newBoard);
      }, 1000);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) {
        saveBoard(board);
      }
    };
  }, [board]);

  const addNote = useCallback(
    (defaultColor: NoteColor = "yellow"): NoteItem => {
      const center =
        containerSize && containerSize.width > 0
          ? getViewportCenter(board.viewport, containerSize.width, containerSize.height)
          : { x: 200, y: 200 };

      const newZ = lastZIndex + 1;
      setLastZIndex(newZ);

      const now = Date.now();
      const note: NoteItem = {
        id: generateId(),
        x: center.x - DEFAULT_NOTE_WIDTH / 2,
        y: center.y - DEFAULT_NOTE_HEIGHT / 2,
        width: DEFAULT_NOTE_WIDTH,
        height: DEFAULT_NOTE_HEIGHT,
        color: defaultColor,
        text: "",
        zIndex: newZ,
        createdAt: now,
        updatedAt: now,
      };

      const newBoard = {
        ...board,
        notes: [...board.notes, note],
        updatedAt: now,
      };
      pushHistory(board);
      persistState(newBoard);
      return note;
    },
    [board, lastZIndex, persistState, pushHistory, containerSize]
  );

  const updateNote = useCallback(
    (id: string, updates: Partial<NoteItem>) => {
      const newBoard = {
        ...board,
        notes: board.notes.map((n) =>
          n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n
        ),
        updatedAt: Date.now(),
      };
      pushHistory(board);
      persistState(newBoard);
    },
    [board, persistState, pushHistory]
  );

  const deleteNote = useCallback(
    (id: string) => {
      let newBoard = { ...board, notes: board.notes.filter((n) => n.id !== id), updatedAt: Date.now() };
      newBoard.groups = newBoard.groups.map((g) => ({
        ...g,
        noteIds: g.noteIds.filter((nid) => nid !== id),
      }));
      newBoard.groups = newBoard.groups.filter((g) => g.noteIds.length > 0);
      pushHistory(board);
      persistState(newBoard);
    },
    [board, persistState, pushHistory]
  );

  const moveNote = useCallback(
    (id: string, x: number, y: number) => {
      const newBoard = {
        ...board,
        notes: board.notes.map((n) => (n.id === id ? { ...n, x, y, updatedAt: Date.now() } : n)),
        updatedAt: Date.now(),
      };
      persistState(newBoard);
    },
    [board, persistState]
  );

  const resizeNote = useCallback(
    (id: string, width: number, height: number) => {
      const newBoard = {
        ...board,
        notes: board.notes.map((n) =>
          n.id === id ? { ...n, width, height, updatedAt: Date.now() } : n
        ),
        updatedAt: Date.now(),
      };
      persistState(newBoard);
    },
    [board, persistState]
  );

  const changeNoteColor = useCallback(
    (id: string, color: NoteColor) => {
      updateNote(id, { color });
    },
    [updateNote]
  );

  const bringToFront = useCallback(
    (id: string) => {
      const newZ = lastZIndex + 1;
      setLastZIndex(newZ);
      const newBoard = {
        ...board,
        notes: board.notes.map((n) =>
          n.id === id ? { ...n, zIndex: newZ, updatedAt: Date.now() } : n
        ),
        updatedAt: Date.now(),
      };
      persistState(newBoard);
    },
    [board, lastZIndex, persistState]
  );

  const addGroup = useCallback(
    (noteIds: string[]): GroupItem => {
      if (noteIds.length < 2) throw new Error("Need at least 2 notes to group");

      const groupNotes = board.notes.filter((n) => noteIds.includes(n.id));
      const bounds = getBoundsForNotes(groupNotes);
      if (!bounds) throw new Error("Cannot create group");

      const newZ = lastZIndex + 1;
      setLastZIndex(newZ);

      const now = Date.now();
      const group: GroupItem = {
        id: generateId(),
        x: bounds.x - 24,
        y: bounds.y - 48,
        width: bounds.width + 48,
        height: bounds.height + 72,
        title: "Group",
        theme: "corkboard",
        noteIds: [...noteIds],
        zIndex: newZ - 1,
        createdAt: now,
        updatedAt: now,
      };

      const newBoard = {
        ...board,
        notes: board.notes.map((n) =>
          noteIds.includes(n.id) ? { ...n, groupId: group.id, updatedAt: now } : n
        ),
        groups: [...board.groups, group],
        updatedAt: now,
      };
      pushHistory(board);
      persistState(newBoard);
      return group;
    },
    [board, lastZIndex, persistState, pushHistory]
  );

  const updateGroup = useCallback(
    (id: string, updates: Partial<GroupItem>) => {
      const newBoard = {
        ...board,
        groups: board.groups.map((g) =>
          g.id === id ? { ...g, ...updates, updatedAt: Date.now() } : g
        ),
        updatedAt: Date.now(),
      };
      persistState(newBoard);
    },
    [board, persistState]
  );

  const deleteGroup = useCallback(
    (id: string) => {
      const group = board.groups.find((g) => g.id === id);
      if (!group) return;
      const newBoard = {
        ...board,
        groups: board.groups.filter((g) => g.id !== id),
        notes: board.notes.map((n) =>
          n.groupId === id ? { ...n, groupId: undefined, updatedAt: Date.now() } : n
        ),
        updatedAt: Date.now(),
      };
      pushHistory(board);
      persistState(newBoard);
    },
    [board, persistState, pushHistory]
  );

  const renameGroup = useCallback(
    (id: string, title: string) => {
      updateGroup(id, { title });
    },
    [updateGroup]
  );

  const ungroupNotes = useCallback(
    (groupId: string) => {
      const group = board.groups.find((g) => g.id === groupId);
      if (!group) return;
      const newBoard = {
        ...board,
        groups: board.groups.filter((g) => g.id !== groupId),
        notes: board.notes.map((n) =>
          n.groupId === groupId ? { ...n, groupId: undefined, updatedAt: Date.now() } : n
        ),
        updatedAt: Date.now(),
      };
      pushHistory(board);
      persistState(newBoard);
    },
    [board, persistState, pushHistory]
  );

  const selectNote = useCallback((id: string, multi = false) => {
    if (multi) {
      setSelectedNoteIds((prev) =>
        prev.includes(id) ? prev.filter((nid) => nid !== id) : [...prev, id]
      );
      setSelectedGroupIds([]);
    } else {
      setSelectedNoteIds([id]);
      setSelectedGroupIds([]);
    }
  }, []);

  const selectGroup = useCallback((id: string, multi = false) => {
    if (multi) {
      setSelectedGroupIds((prev) =>
        prev.includes(id) ? prev.filter((gid) => gid !== id) : [...prev, id]
      );
      setSelectedNoteIds([]);
    } else {
      setSelectedGroupIds([id]);
      setSelectedNoteIds([]);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNoteIds([]);
    setSelectedGroupIds([]);
  }, []);

  const selectAllInRect = useCallback(
    (x: number, y: number, width: number, height: number) => {
      const selRect = { x, y, width, height };
      const hitNoteIds = board.notes
        .filter((n) => rectsIntersect(noteToRect(n), selRect))
        .map((n) => n.id);
      const hitGroupIds = board.groups
        .filter((g) => rectsIntersect({ x: g.x, y: g.y, width: g.width, height: g.height }, selRect))
        .map((g) => g.id);
      setSelectedNoteIds(hitNoteIds);
      setSelectedGroupIds(hitGroupIds);
    },
    [board]
  );

  const deleteSelected = useCallback(() => {
    const toDeleteNotes = new Set(selectedNoteIds);
    const toDeleteGroups = new Set(selectedGroupIds);

    let newBoard = { ...board, updatedAt: Date.now() };
    newBoard.notes = newBoard.notes.filter((n) => !toDeleteNotes.has(n.id));
    newBoard.groups = newBoard.groups
      .filter((g) => !toDeleteGroups.has(g.id))
      .map((g) => ({
        ...g,
        noteIds: g.noteIds.filter((nid) => !toDeleteNotes.has(nid)),
      }));
    newBoard.groups = newBoard.groups.filter((g) => g.noteIds.length > 0);

    pushHistory(board);
    persistState(newBoard);
    setSelectedNoteIds([]);
    setSelectedGroupIds([]);
  }, [board, selectedNoteIds, selectedGroupIds, persistState, pushHistory]);

  const setViewport = useCallback(
    (vp: ViewportState) => {
      const newBoard = { ...board, viewport: vp, updatedAt: Date.now() };
      persistState(newBoard);
    },
    [board, persistState]
  );

  const setSettings = useCallback(
    (settings: Partial<BoardSettings>) => {
      const newBoard = {
        ...board,
        settings: { ...board.settings, ...settings },
        updatedAt: Date.now(),
      };
      persistState(newBoard);
    },
    [board, persistState]
  );

  const exportBoard = useCallback(() => {
    return JSON.stringify(board, null, 2);
  }, [board]);

  const importBoard = useCallback(
    (json: string): boolean => {
      try {
        const data = JSON.parse(json);
        if (!data.notes || !Array.isArray(data.notes)) return false;
        const newBoard: BoardState = {
          version: data.version || 1,
          notes: data.notes,
          groups: data.groups || [],
          viewport: data.viewport || { x: 0, y: 0, zoom: 1 },
          settings: data.settings || { theme: "system", gridEnabled: true },
          updatedAt: Date.now(),
        };
        pushHistory(board);
        persistState(newBoard);
        return true;
      } catch {
        return false;
      }
    },
    [board, persistState, pushHistory]
  );

  const getShareUrl = useCallback(() => {
    const hash = compressBoardForUrl(board);
    if (typeof window !== "undefined") {
      return `${window.location.origin}/board/${hash}`;
    }
    return `/board/${hash}`;
  }, [board]);

  const undo = useCallback(() => {
    if (undoStack.current.length < 2) return;
    const current = undoStack.current.pop()!;
    redoStack.current.push(JSON.parse(JSON.stringify(board)));
    const previous = undoStack.current[undoStack.current.length - 1];
    setBoard(previous);
    setCanUndo(undoStack.current.length > 1);
    setCanRedo(true);
    saveBoard(previous);
    setSelectedNoteIds([]);
    setSelectedGroupIds([]);
  }, [board]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(JSON.parse(JSON.stringify(next)));
    setBoard(next);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
    saveBoard(next);
    setSelectedNoteIds([]);
    setSelectedGroupIds([]);
  }, []);

  return {
    board,
    selectedNoteIds,
    selectedGroupIds,
    addNote,
    updateNote,
    deleteNote,
    moveNote,
    resizeNote,
    changeNoteColor,
    bringToFront,
    addGroup,
    updateGroup,
    deleteGroup,
    renameGroup,
    ungroupNotes,
    setViewport,
    setSettings,
    selectNote,
    selectGroup,
    clearSelection,
    selectAllInRect,
    deleteSelected,
    exportBoard,
    importBoard,
    getShareUrl,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
