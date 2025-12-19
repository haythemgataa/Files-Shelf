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
import { join } from "path";
import { ShelfItem } from "./lib/types";
import { clearShelf, getShelfItems } from "./lib/shelf-storage";
import { copyItems, validateDestination, ConflictStrategy } from "./lib/file-operations";
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

  const handleCopy = async () => {
    if (!destination || items.length === 0) return;

    // Default action when there are no conflicts.
    return handleCopyWithStrategy("skip");
  };

  const handleCopyWithStrategy = async (onConflict: ConflictStrategy) => {
    if (!destination || items.length === 0) return;

    const results = copyItems(items, destination, { onConflict });
    const successCount = results.filter((r) => r.success).length;
    const skippedCount = results.filter((r) => r.skipped).length;
    const failCount = results.filter((r) => !r.success && !r.skipped).length;

    if (failCount > 0 || skippedCount > 0) {
      const parts = [`Copied ${successCount} item${successCount !== 1 ? "s" : ""}`];
      if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
      if (failCount > 0) parts.push(`${failCount} failed`);
      await showHUD(parts.join(", "));
    } else {
      await showHUD(`Copied ${successCount} item${successCount !== 1 ? "s" : ""}`);
    }

    // By default, clear the shelf on a fully successful operation.
    if (failCount === 0 && skippedCount === 0 && !keepShelfAfterCompletion()) {
      await clearShelf();
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
      navigationTitle="Confirm Copy"
      searchBarPlaceholder={`${items.length} item${items.length > 1 ? "s" : ""} will be copied`}
    >
      <List.Section title={`Destination: ${destination}`}>
        <List.Item
          icon={Icon.CheckCircle}
          title="Confirm Copy"
          subtitle={
            conflicts.length > 0
              ? `${conflicts.length} conflict${conflicts.length !== 1 ? "s" : ""} detected — choose what to do`
              : `Copy ${items.length} item${items.length > 1 ? "s" : ""} to destination`
          }
          actions={
            <ActionPanel>
              {conflicts.length > 0 ? (
                <>
                  <Action icon={Icon.CopyClipboard} title="Copy (Skip Conflicts)" onAction={() => handleCopyWithStrategy("skip")} />
                  <Action icon={Icon.Replace} title="Copy (Replace Conflicts)" onAction={() => handleCopyWithStrategy("replace")} />
                  <Action icon={Icon.Pencil} title="Copy (Auto-Rename Conflicts)" onAction={() => handleCopyWithStrategy("rename")} />
                </>
              ) : (
                <Action icon={Icon.CopyClipboard} title="Copy Items" onAction={handleCopy} />
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
      <List.Section title="Items to Copy">
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

