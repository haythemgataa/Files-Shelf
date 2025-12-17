## Files Shelf — Plan

### Goal
Build a Raycast extension that lets users collect files/folders from different locations into a “shelf”, then perform **batch actions**:
- View/manage shelf items
- Copy all to a destination folder
- Move all to a destination folder
- Batch rename items (in place)
- Clear/remove items from the shelf

### Primary user flow
- **Add to Shelf**: Select items in Finder → run “Add to Shelf” → items are stored persistently.
- **View Shelf**: Browse shelf items grouped by parent folder, search, show details, remove items, clear shelf.
- **Batch actions**:
  - **Copy** shelf items → to selected destination folder in Finder
  - **Move** shelf items → to selected destination folder in Finder
  - **Rename** shelf items → preview changes → apply rename → update shelf paths

### Feature scope (v1)
- **Shelf storage**
  - Persist items via `LocalStorage`
  - Prevent duplicates by path
  - Store: `id`, `name`, `path`, `type` (file/folder)
- **View shelf**
  - Group by parent folder
  - Search across items
  - Item actions: show in Finder, open with, copy path, remove
  - Shelf actions: copy all, move all, rename all, clear shelf
- **Copy**
  - Copy files and folders recursively into selected destination folder
  - Show summary result (success/fail counts)
- **Move**
  - Move files/folders into selected destination folder
  - Confirm destructive action
  - Show summary result (success/fail counts)
- **Rename**
  - Modes: prefix, suffix, numbering, find/replace
  - Preview list and confirm step
  - Apply renames and update shelf items

### Missing plan items / risks to address (recommended before “ship”)
#### 1) Name collisions (copy/move)
If destination already contains `item.name`, current behavior may error or overwrite depending on OS/filesystem semantics.
- **Decide behavior**: skip, overwrite, or auto-rename (e.g., “file (1).ext”).
- **Plan UI**: show conflict list before applying.

#### 2) Move across volumes (EXDEV)
`rename`/move can fail when moving across different devices/volumes.
- **Plan**: detect EXDEV and fallback to copy+delete (carefully for folders).

#### 3) Partial failures & shelf consistency
When some items succeed and others fail:
- **Move**: decide whether to clear only moved items (recommended) vs clearing all.
- **Copy**: decide whether to keep shelf unchanged (recommended) and show per-item results.
- **Rename**: ensure shelf updates only for items that actually renamed successfully.

#### 4) Rename safety checks
Before applying rename:
- **Collision detection**: two items renaming to the same `newName` in the same directory.
- **Invalid names**: block empty names, `.`/`..`, disallowed characters (platform-specific), leading/trailing spaces issues.
- **Folder rename effects**: renaming a folder changes paths for any nested items (if nested items could ever be on the shelf).

#### 5) Shelf integrity / stale items
Items may be deleted/moved outside the extension.
- **Plan**: “Prune missing items” action or auto-prune on load.
- **Plan**: show a warning icon for missing paths and offer “Remove”.

#### 6) Performance & UX
- Large shelves: avoid repeated expensive filesystem stats; consider lazy detail computation.
- Long operations: consider progress feedback (toast progress) and per-item error report view.

### Out of scope (explicitly)
- Drag & drop into shelf
- Per-item batch selection (operate on a subset) beyond remove-one
- Advanced rename templating (regex, capture groups)

### Testing plan (lightweight)
- **Manual**:
  - Add files and folders from multiple directories; verify de-dup by path
  - Copy to an empty destination
  - Copy when destination already contains same names (verify chosen behavior)
  - Move within same volume and across volumes (verify fallback if added)
  - Rename each mode; verify preview matches applied result; verify shelf paths update correctly
  - Remove one item, clear shelf, and reload behavior
- **Automated (optional)**:
  - Unit tests for rename preview generation and collision detection

### Release checklist
- Replace placeholders in `CHANGELOG.md`
- Expand README with:
  - Setup/usage steps
  - Known limitations (especially overwrite/conflicts behavior)
  - Short GIF/screenshots (optional)
- Run `npm run lint` and `npm run build`

