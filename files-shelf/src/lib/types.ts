export interface ShelfItem {
  id: string;
  name: string;
  path: string;
  type: "file" | "folder";
}

export type RenameMode = "prefix" | "suffix" | "numbering" | "replace";

export interface RenameOptions {
  mode: RenameMode;
  prefix?: string;
  suffix?: string;
  startNumber?: number;
  padding?: number;
  find?: string;
  replace?: string;
}

export interface RenamePreview {
  item: ShelfItem;
  oldName: string;
  newName: string;
  newPath: string;
}

