import {
  ActionPanel,
  Action,
  List,
  Icon,
  showHUD,
  getSelectedFinderItems,
  popToRoot,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { existsSync } from "fs";
import { basename, join } from "path";
import { ShelfItem } from "./lib/types";
import { clearShelf, getShelfItems, updateShelfItems } from "./lib/shelf-storage";
import { moveItems, validateDestination, ConflictStrategy } from "./lib/file-operations";
import { keepShelfAfterCompletion } from "./lib/preferences";

export default function Command() {
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [destination, setDestination] = useState<string | null>(null);
  const [destinationError, setDestinationError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Load shelf items
      const shelfItems = await getShelfItems();
      setItems(shelfItems);

      // Get destination from Finder
      try {
        const finderItems = await getSelectedFinderItems();
        if (finderItems.length > 0) {
          const destPath = finderItems[0].path;
          const validation = validateDestination(destPath);
          if (validation.valid) {
            setDestination(destPath);
          } else {
            setDestinationError(validation.error || "Invalid destination");
          }
        } else {
          setDestinationError("No folder selected in Finder");
        }
      } catch {
        setDestinationError("Please select a folder in Finder");
      }

      setIsLoading(false);
    };

    load();
  }, []);

  const handleMove = async () => {
    if (!destination || items.length === 0) return;

    // Default action when there are no conflicts.
    return handleMoveWithStrategy("skip");
  };

  const handleMoveWithStrategy = async (onConflict: ConflictStrategy) => {
    if (!destination || items.length === 0) return;

    const results = moveItems(items, destination, { onConflict });
    const successCount = results.filter((r) => r.success).length;
    const skippedCount = results.filter((r) => r.skipped).length;
    const failCount = results.filter((r) => !r.success && !r.skipped).length;

    if (successCount > 0) {
      const movedPathsById = new Map<string, string>();
      for (const r of results) {
        if (r.success && r.newPath) movedPathsById.set(r.item.id, r.newPath);
      }

      const fullySuccessful = failCount === 0 && skippedCount === 0;

      // By default, clear the shelf on a fully successful operation.
      if (fullySuccessful && !keepShelfAfterCompletion()) {
        await clearShelf();
      } else if (keepShelfAfterCompletion()) {
        // Keep items on shelf, but update moved items to their new paths/names.
        const updated = items.map((item) => {
          const newPath = movedPathsById.get(item.id);
          if (!newPath) return item;
          return { ...item, path: newPath, name: basename(newPath) };
        });
        await updateShelfItems(updated);
      } else {
        // Partial success: remove successfully moved items; keep failed/skipped items on the shelf.
        const remaining = items.filter((item) => !movedPathsById.has(item.id));
        await updateShelfItems(remaining);
      }
    }

    if (failCount > 0 || skippedCount > 0) {
      const parts = [`Moved ${successCount} item${successCount !== 1 ? "s" : ""}`];
      if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
      if (failCount > 0) parts.push(`${failCount} failed`);
      await showHUD(parts.join(", "));
    } else {
      await showHUD(`Moved ${successCount} item${successCount !== 1 ? "s" : ""}`);
    }

    await popToRoot();
  };

  if (isLoading) {
    return <List isLoading={true} />;
  }

  if (items.length === 0) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.Tray}
          title="Shelf is Empty"
          description="Add items to the shelf first using 'Add to Shelf'"
        />
      </List>
    );
  }

  if (destinationError) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.Warning}
          title="No Destination Selected"
          description={destinationError}
        />
      </List>
    );
  }

  const conflicts = destination
    ? items.filter((item) => existsSync(join(destination, item.name)))
    : [];

  return (
    <List
      navigationTitle="Confirm Move"
      searchBarPlaceholder={`${items.length} item${items.length > 1 ? "s" : ""} will be moved`}
    >
      <List.Section title={`Destination: ${destination}`}>
        <List.Item
          icon={Icon.ExclamationMark}
          title="⚠️ Confirm Move"
          subtitle={
            conflicts.length > 0
              ? `${conflicts.length} conflict${conflicts.length !== 1 ? "s" : ""} detected — choose what to do`
              : "Files will be removed from their original locations"
          }
          actions={
            <ActionPanel>
              {conflicts.length > 0 ? (
                <>
                  <Action
                    icon={Icon.ArrowRightCircle}
                    title="Move (Skip Conflicts)"
                    style={Action.Style.Destructive}
                    onAction={() => handleMoveWithStrategy("skip")}
                  />
                  <Action
                    icon={Icon.Replace}
                    title="Move (Replace Conflicts)"
                    style={Action.Style.Destructive}
                    onAction={() => handleMoveWithStrategy("replace")}
                  />
                  <Action
                    icon={Icon.Pencil}
                    title="Move (Auto-Rename Conflicts)"
                    style={Action.Style.Destructive}
                    onAction={() => handleMoveWithStrategy("rename")}
                  />
                </>
              ) : (
                <Action
                  icon={Icon.ArrowRightCircle}
                  title="Move Items"
                  style={Action.Style.Destructive}
                  onAction={handleMove}
                />
              )}
              <Action
                icon={Icon.XMarkCircle}
                title="Cancel"
                shortcut={{ modifiers: ["cmd"], key: "." }}
                onAction={popToRoot}
              />
            </ActionPanel>
          }
        />
      </List.Section>
      {conflicts.length > 0 ? (
        <List.Section title={`Conflicts (${conflicts.length})`}>
          {conflicts.slice(0, 50).map((item) => (
            <List.Item
              key={`conflict-${item.id}`}
              icon={Icon.Warning}
              title={item.name}
              subtitle="An item with the same name already exists in the destination"
            />
          ))}
          {conflicts.length > 50 ? (
            <List.Item icon={Icon.Ellipsis} title={`And ${conflicts.length - 50} more...`} />
          ) : null}
        </List.Section>
      ) : null}
      <List.Section title="Items to Move">
        {items.map((item) => (
          <List.Item
            key={item.id}
            icon={item.type === "folder" ? Icon.Folder : Icon.Document}
            title={item.name}
            subtitle={item.path}
            accessories={[{ text: item.type }]}
          />
        ))}
      </List.Section>
    </List>
  );
}

