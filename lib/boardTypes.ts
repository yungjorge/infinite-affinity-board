export type BoardState = {
  version: number;
  notes: NoteItem[];
  groups: GroupItem[];
  viewport: ViewportState;
  settings: BoardSettings;
  updatedAt: number;
};

export type NoteItem = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: NoteColor;
  text: string;
  zIndex: number;
  groupId?: string;
  createdAt: number;
  updatedAt: number;
};

export type GroupItem = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  theme: "corkboard" | "markerboard" | "chalkboard";
  noteIds: string[];
  zIndex: number;
  createdAt: number;
  updatedAt: number;
};

export type ViewportState = {
  x: number;
  y: number;
  zoom: number;
};

export type BoardSettings = {
  theme: "light" | "dark" | "system";
  snapEnabled: boolean;
};

export type NoteColor =
  | "yellow"
  | "pink"
  | "blue"
  | "green"
  | "orange"
  | "purple"
  | "white";
