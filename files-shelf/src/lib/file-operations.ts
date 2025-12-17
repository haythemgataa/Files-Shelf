import { cpSync, renameSync, existsSync, statSync } from "fs";
import { basename, dirname, join, extname } from "path";
import { ShelfItem, RenameOptions, RenamePreview } from "./types";

export interface OperationResult {
  success: boolean;
  item: ShelfItem;
  error?: string;
  newPath?: string;
}

export function copyItems(items: ShelfItem[], destination: string): OperationResult[] {
  const results: OperationResult[] = [];

  for (const item of items) {
    try {
      const destPath = join(destination, item.name);
      cpSync(item.path, destPath, { recursive: true });
      results.push({ success: true, item, newPath: destPath });
    } catch (error) {
      results.push({
        success: false,
        item,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

export function moveItems(items: ShelfItem[], destination: string): OperationResult[] {
  const results: OperationResult[] = [];

  for (const item of items) {
    try {
      const destPath = join(destination, item.name);
      renameSync(item.path, destPath);
      results.push({ success: true, item, newPath: destPath });
    } catch (error) {
      results.push({
        success: false,
        item,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

export function generateRenamePreview(items: ShelfItem[], options: RenameOptions): RenamePreview[] {
  const previews: RenamePreview[] = [];

  items.forEach((item, index) => {
    const ext = extname(item.name);
    const nameWithoutExt = basename(item.name, ext);
    let newName: string;

    switch (options.mode) {
      case "prefix":
        newName = `${options.prefix || ""}${item.name}`;
        break;
      case "suffix":
        newName = `${nameWithoutExt}${options.suffix || ""}${ext}`;
        break;
      case "numbering": {
        const num = (options.startNumber || 1) + index;
        const padding = options.padding || 3;
        const paddedNum = String(num).padStart(padding, "0");
        newName = `${paddedNum}${ext}`;
        break;
      }
      case "replace":
        if (options.find) {
          newName = item.name.replaceAll(options.find, options.replace || "");
        } else {
          newName = item.name;
        }
        break;
      default:
        newName = item.name;
    }

    const dir = dirname(item.path);
    previews.push({
      item,
      oldName: item.name,
      newName,
      newPath: join(dir, newName),
    });
  });

  return previews;
}

export function renameItems(previews: RenamePreview[]): OperationResult[] {
  const results: OperationResult[] = [];

  for (const preview of previews) {
    // Skip if name hasn't changed
    if (preview.oldName === preview.newName) {
      results.push({ success: true, item: preview.item, newPath: preview.item.path });
      continue;
    }

    try {
      renameSync(preview.item.path, preview.newPath);
      results.push({ success: true, item: preview.item, newPath: preview.newPath });
    } catch (error) {
      results.push({
        success: false,
        item: preview.item,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

export function validateDestination(path: string): { valid: boolean; error?: string } {
  if (!existsSync(path)) {
    return { valid: false, error: "Destination does not exist" };
  }

  try {
    const stat = statSync(path);
    if (!stat.isDirectory()) {
      return { valid: false, error: "Destination must be a folder" };
    }
  } catch {
    return { valid: false, error: "Cannot access destination" };
  }

  return { valid: true };
}

