# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Files Shelf is a Raycast extension that lets users collect files and folders from different locations into a virtual "shelf" and then perform batch operations (copy, move, rename) on them. Built with React, TypeScript, and the Raycast API.

## Development Commands

```bash
# Development mode with hot reload
npm run dev

# Build the extension
npm run build

# Lint the code
npm run lint

# Auto-fix linting issues
npm run fix-lint

# Publish to Raycast Store
npm run publish
```

## Architecture

### Core Data Flow

1. **Storage Layer** (`src/lib/shelf-storage.ts`): Uses Raycast's LocalStorage API to persist shelf items. All shelf operations (add, remove, clear, validate) go through this module.

2. **File Operations** (`src/lib/file-operations.ts`): Handles actual filesystem operations (copy, move, rename) with conflict resolution strategies. Includes cross-volume move support (falls back to copy+delete when renameSync fails with EXDEV).

3. **Commands** (src/*.tsx): Five Raycast commands that interface with the storage and operations layers:
   - `add-to-shelf.ts`: No-view command that adds Finder selection to shelf
   - `view-shelf.tsx`: Main UI for browsing/managing shelf items
   - `copy-to-selection.tsx`: Batch copy to Finder destination
   - `move-to-selection.tsx`: Batch move to Finder destination
   - `rename-shelf.tsx`: Batch rename with expression support

### Key Concepts

**Shelf Items**: Stored as JSON array in LocalStorage with structure:
```typescript
{
  id: string;           // Unique ID (timestamp + random)
  name: string;         // Filename/folder name
  path: string;         // Absolute path (used for deduplication)
  type: "file" | "folder";
}
```

**Stale Items**: Items that no longer exist or are inaccessible. The UI marks them with red tint and warning icons. Users can remove them via "Remove Stale Items" action.

**Finder Integration**: Commands use `getSelectedFinderItems()` for selected items. The `finder-destination.ts` module provides fallback logic:
1. Try selected Finder item
2. Fall back to front Finder window path (via AppleScript)
3. Reject special windows like "Recents" or "All My Files"

**Conflict Strategies**: Three modes for handling filename conflicts during operations:
- `skip`: Leave existing file, mark operation as skipped
- `replace`: Delete existing file and replace with new one
- `rename`: Auto-append " (n)" to filename until unique

**Expression-based Renaming**: Advanced renaming system (`expression-parser.ts`) supporting:
- Name tokens: `$f.e$` (full name), `$f$` (name without ext), `$.e$` (extension only)
- Numbering: `$n$`, `$nn$` (padded), `$nnn:10$` (start at 10), `$n-$` (descending)
- Dates: `$d$`, `$d:YYYY-MM-DD$`, `$d:f$` (file's modification date)
- Time: `$t$`, `$t:HH:mm:ss$`, `$t:f$` (file's modification time)
- Match patterns: Apply expressions only to matched substrings

## File Structure

```
src/
├── lib/
│   ├── types.ts              # TypeScript interfaces
│   ├── shelf-storage.ts      # LocalStorage operations
│   ├── file-operations.ts    # Filesystem operations
│   ├── finder-destination.ts # Finder integration logic
│   ├── expression-parser.ts  # Rename expression engine
│   └── file-icons.ts         # Icon/category utilities
├── add-to-shelf.ts           # No-view command
├── view-shelf.tsx            # Main shelf UI
├── copy-to-selection.tsx     # Copy command UI
├── move-to-selection.tsx     # Move command UI
└── rename-shelf.tsx          # Rename command UI
```

## Important Patterns

**Preference Handling**: Extension has one preference `keepShelfAfterCompletion` (default: false). Access via:
```typescript
const { keepShelfAfterCompletion } = getPreferenceValues();
```

**Result Tracking**: Operations return `OperationResult[]` arrays with per-item success/failure status:
```typescript
interface OperationResult {
  success: boolean;
  item: ShelfItem;
  error?: string;
  newPath?: string;
  skipped?: boolean;
}
```

**Validation Before Operations**: Always validate source items exist and destination is valid before starting batch operations. Use `validateSourceItems()` and `validateDestination()`.

**Grouping in UI**: view-shelf groups items by parent directory for better organization when displaying shelf contents.

## Testing Notes

- Test with files across different volumes to verify cross-device move fallback
- Test conflict resolution with all three strategies
- Test stale item detection (delete a file, then view shelf)
- Test expression parser with edge cases (empty expressions, missing $, etc.)
- Verify AppleScript fallback works when no Finder selection exists
