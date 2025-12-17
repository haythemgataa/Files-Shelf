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
import { getShelfItems } from "./lib/shelf-storage";
import { copyItems, validateDestination } from "./lib/file-operations";

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

    const results = copyItems(items, destination);
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    if (failCount > 0) {
      await showHUD(`Copied ${successCount} item${successCount !== 1 ? "s" : ""}, ${failCount} failed`);
    } else {
      await showHUD(`Copied ${successCount} item${successCount !== 1 ? "s" : ""}`);
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
      navigationTitle="Confirm Copy"
      searchBarPlaceholder={`${items.length} item${items.length > 1 ? "s" : ""} will be copied`}
    >
      <List.Section title={`Destination: ${destination}`}>
        <List.Item
          icon={Icon.CheckCircle}
          title="Confirm Copy"
          subtitle={`Copy ${items.length} item${items.length > 1 ? "s" : ""} to destination`}
          actions={
            <ActionPanel>
              <Action
                icon={Icon.CopyClipboard}
                title="Copy Items"
                onAction={handleCopy}
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

