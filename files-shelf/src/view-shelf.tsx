import {
  ActionPanel,
  Action,
  List,
  Icon,
  confirmAlert,
  Alert,
  showToast,
  Toast,
  Clipboard,
  showHUD,
  getSelectedFinderItems,
  popToRoot,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { ShelfItem } from "./lib/types";
import { getShelfItems, removeFromShelf, clearShelf } from "./lib/shelf-storage";
import { copyItems, moveItems, validateDestination } from "./lib/file-operations";
import RenameShelf from "./rename-shelf";

export default function Command() {
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadItems = async () => {
    const shelfItems = await getShelfItems();
    setItems(shelfItems);
    setIsLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleRemove = async (id: string) => {
    await removeFromShelf(id);
    await loadItems();
    await showToast({ style: Toast.Style.Success, title: "Removed from shelf" });
  };

  const handleClear = async () => {
    const confirmed = await confirmAlert({
      title: "Clear Shelf",
      message: `Are you sure you want to remove all ${items.length} items from the shelf?`,
      primaryAction: {
        title: "Clear All",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (confirmed) {
      await clearShelf();
      await loadItems();
      await showToast({ style: Toast.Style.Success, title: "Shelf cleared" });
    }
  };

  const handleCopyToFinder = async () => {
    if (items.length === 0) {
      await showHUD("Shelf is empty");
      return;
    }

    try {
      const finderItems = await getSelectedFinderItems();
      if (finderItems.length === 0) {
        await showHUD("Please select a destination folder in Finder");
        return;
      }

      const destination = finderItems[0].path;
      const validation = validateDestination(destination);

      if (!validation.valid) {
        await showHUD(validation.error || "Invalid destination");
        return;
      }

      const confirmed = await confirmAlert({
        title: "Copy Items",
        message: `Copy ${items.length} item${items.length > 1 ? "s" : ""} to:\n${destination}`,
        primaryAction: {
          title: "Copy",
        },
      });

      if (confirmed) {
        const results = copyItems(items, destination);
        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        if (failCount > 0) {
          await showHUD(`Copied ${successCount} item${successCount !== 1 ? "s" : ""}, ${failCount} failed`);
        } else {
          await showHUD(`Copied ${successCount} item${successCount !== 1 ? "s" : ""}`);
        }
      }
    } catch {
      await showHUD("Please select a destination folder in Finder");
    }
  };

  const handleMoveToFinder = async () => {
    if (items.length === 0) {
      await showHUD("Shelf is empty");
      return;
    }

    try {
      const finderItems = await getSelectedFinderItems();
      if (finderItems.length === 0) {
        await showHUD("Please select a destination folder in Finder");
        return;
      }

      const destination = finderItems[0].path;
      const validation = validateDestination(destination);

      if (!validation.valid) {
        await showHUD(validation.error || "Invalid destination");
        return;
      }

      const confirmed = await confirmAlert({
        title: "Move Items",
        message: `Move ${items.length} item${items.length > 1 ? "s" : ""} to:\n${destination}\n\n⚠️ Files will be removed from their original locations.`,
        primaryAction: {
          title: "Move",
          style: Alert.ActionStyle.Destructive,
        },
      });

      if (confirmed) {
        const results = moveItems(items, destination);
        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        // Clear shelf after successful move
        if (successCount > 0) {
          await clearShelf();
          await loadItems();
        }

        if (failCount > 0) {
          await showHUD(`Moved ${successCount} item${successCount !== 1 ? "s" : ""}, ${failCount} failed`);
        } else {
          await showHUD(`Moved ${successCount} item${successCount !== 1 ? "s" : ""}`);
          await popToRoot();
        }
      }
    } catch {
      await showHUD("Please select a destination folder in Finder");
    }
  };

  if (items.length === 0 && !isLoading) {
    return (
      <List>
        <List.EmptyView
          icon={Icon.Tray}
          title="Shelf is Empty"
          description="Select files in Finder and use 'Add to Shelf' to get started"
        />
      </List>
    );
  }

  return (
    <List isLoading={isLoading}>
      {items.map((item) => (
        <List.Item
          key={item.id}
          icon={item.type === "folder" ? Icon.Folder : Icon.Document}
          title={item.name}
          subtitle={item.path}
          accessories={[{ text: item.type }]}
          actions={
            <ActionPanel>
              <ActionPanel.Section title="Item Actions">
                <Action.ShowInFinder path={item.path} />
                <Action.OpenWith path={item.path} />
                <Action
                  icon={Icon.Clipboard}
                  title="Copy Path"
                  shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                  onAction={async () => {
                    await Clipboard.copy(item.path);
                    await showToast({ style: Toast.Style.Success, title: "Path copied" });
                  }}
                />
                <Action
                  icon={Icon.Trash}
                  title="Remove from Shelf"
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["ctrl"], key: "x" }}
                  onAction={() => handleRemove(item.id)}
                />
              </ActionPanel.Section>
              <ActionPanel.Section title="Shelf Actions">
                <Action
                  icon={Icon.CopyClipboard}
                  title="Copy All to Finder Selection..."
                  shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
                  onAction={handleCopyToFinder}
                />
                <Action
                  icon={Icon.ArrowRightCircle}
                  title="Move All to Finder Selection..."
                  shortcut={{ modifiers: ["cmd", "shift"], key: "m" }}
                  onAction={handleMoveToFinder}
                />
                <Action.Push
                  icon={Icon.Pencil}
                  title="Rename All..."
                  shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
                  target={<RenameShelf items={items} onComplete={loadItems} />}
                />
                <Action
                  icon={Icon.XMarkCircle}
                  title="Clear Shelf"
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "delete" }}
                  onAction={handleClear}
                />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
