import { cpSync, renameSync, existsSync, statSync, rmSync } from "fs";
import { basename, dirname, join, extname } from "path";
import { ShelfItem, RenameOptions, RenamePreview } from "./types";

export interface OperationResult {
  success: boolean;
  item: ShelfItem;
  error?: string;
  newPath?: string;
  skipped?: boolean;
}

export type ConflictStrategy = "skip" | "replace" | "rename";

export interface BatchOperationOptions {
  onConflict: ConflictStrategy;
}

function splitName(name: string): { base: string; ext: string } {
  const ext = extname(name);
  const base = ext ? basename(name, ext) : name;
  return { base, ext };
}

function getAutoRenamedName(originalName: string, n: number): string {
  const { base, ext } = splitName(originalName);
  return `${base} (${n})${ext}`;
}

function getAvailableDestinationPath(destinationDir: string, desiredName: string): { destPath: string; finalName: string } {
  const desiredPath = join(destinationDir, desiredName);
  if (!existsSync(desiredPath)) return { destPath: desiredPath, finalName: desiredName };

  for (let n = 1; n < 10_000; n++) {
    const candidateName = getAutoRenamedName(desiredName, n);
    const candidatePath = join(destinationDir, candidateName);
    if (!existsSync(candidatePath)) return { destPath: candidatePath, finalName: candidateName };
  }

  // Extremely unlikely fallback: return original desired path (will error).
  return { destPath: desiredPath, finalName: desiredName };
}

function removeIfExists(path: string) {
  if (!existsSync(path)) return;
  rmSync(path, { recursive: true, force: true });
}

export function copyItems(items: ShelfItem[], destination: string, options: BatchOperationOptions): OperationResult[] {
  const results: OperationResult[] = [];

  for (const item of items) {
    try {
      let destPath = join(destination, item.name);

      if (existsSync(destPath)) {
        if (options.onConflict === "skip") {
          results.push({ success: false, skipped: true, item, error: "Destination already contains an item with the same name" });
          continue;
        }

        if (options.onConflict === "replace") {
          removeIfExists(destPath);
        }

        if (options.onConflict === "rename") {
          const available = getAvailableDestinationPath(destination, item.name);
          destPath = available.destPath;
        }
      }

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

function moveWithFallback(src: string, dest: string) {
  try {
    renameSync(src, dest);
    return;
  } catch (error) {
    // Cross-device move: fallback to copy + delete.
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "EXDEV") {
      cpSync(src, dest, { recursive: true });
      rmSync(src, { recursive: true, force: true });
      return;
    }
    throw error;
  }
}

export function moveItems(items: ShelfItem[], destination: string, options: BatchOperationOptions): OperationResult[] {
  const results: OperationResult[] = [];

  for (const item of items) {
    try {
      let destPath = join(destination, item.name);

      // Moving an item onto itself is a no-op.
      if (destPath === item.path) {
        results.push({ success: false, skipped: true, item, error: "Item is already in the destination folder" });
        continue;
      }

      if (existsSync(destPath)) {
        if (options.onConflict === "skip") {
          results.push({ success: false, skipped: true, item, error: "Destination already contains an item with the same name" });
          continue;
        }

        if (options.onConflict === "replace") {
          removeIfExists(destPath);
        }

        if (options.onConflict === "rename") {
          const available = getAvailableDestinationPath(destination, item.name);
          destPath = available.destPath;
        }
      }

      moveWithFallback(item.path, destPath);
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

