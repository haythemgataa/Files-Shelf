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
import { ShelfItem } from "./lib/types";
import { getShelfItems, clearShelf } from "./lib/shelf-storage";
import { moveItems, validateDestination } from "./lib/file-operations";

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

    const results = moveItems(items, destination);
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    // Clear shelf after move
    if (successCount > 0) {
      await clearShelf();
    }

    if (failCount > 0) {
      await showHUD(`Moved ${successCount} item${successCount !== 1 ? "s" : ""}, ${failCount} failed`);
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

  return (
    <List
      navigationTitle="Confirm Move"
      searchBarPlaceholder={`${items.length} item${items.length > 1 ? "s" : ""} will be moved`}
    >
      <List.Section title={`Destination: ${destination}`}>
        <List.Item
          icon={Icon.ExclamationMark}
          title="⚠️ Confirm Move"
          subtitle="Files will be removed from their original locations"
          actions={
            <ActionPanel>
              <Action
                icon={Icon.ArrowRightCircle}
                title="Move Items"
                style={Action.Style.Destructive}
                onAction={handleMove}
              />
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

