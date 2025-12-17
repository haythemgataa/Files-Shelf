import {
  ActionPanel,
  Action,
  List,
  Form,
  Icon,
  showHUD,
  popToRoot,
  useNavigation,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { ShelfItem, RenameMode, RenameOptions, RenamePreview } from "./lib/types";
import { generateRenamePreview, renameItems } from "./lib/file-operations";
import { updateShelfItems, getShelfItems } from "./lib/shelf-storage";

interface RenameShelfProps {
  items?: ShelfItem[];
  onComplete?: () => Promise<void>;
}

function RenameConfirmation({
  previews,
  onConfirm,
  onBack,
}: {
  previews: RenamePreview[];
  onConfirm: () => void;
  onBack: () => void;
}) {
  const changedPreviews = previews.filter((p) => p.oldName !== p.newName);

  return (
    <List navigationTitle="Confirm Rename">
      <List.Section title={`${changedPreviews.length} file${changedPreviews.length !== 1 ? "s" : ""} will be renamed`}>
        <List.Item
          icon={Icon.CheckCircle}
          title="Apply Rename"
          subtitle="Rename files in their original locations"
          actions={
            <ActionPanel>
              <Action icon={Icon.Pencil} title="Apply Rename" onAction={onConfirm} />
              <Action icon={Icon.ArrowLeft} title="Go Back" onAction={onBack} />
            </ActionPanel>
          }
        />
      </List.Section>
      <List.Section title="Preview">
        {previews.map((preview, index) => (
          <List.Item
            key={index}
            icon={preview.oldName !== preview.newName ? Icon.ArrowRight : Icon.Minus}
            title={preview.newName}
            subtitle={preview.oldName !== preview.newName ? `← ${preview.oldName}` : "No change"}
            accessories={[{ text: preview.item.type }]}
          />
        ))}
      </List.Section>
    </List>
  );
}

export default function RenameShelf({ items: propItems, onComplete }: RenameShelfProps) {
  const { push, pop } = useNavigation();
  const [items, setItems] = useState<ShelfItem[]>(propItems || []);
  const [isLoading, setIsLoading] = useState(!propItems);
  const [mode, setMode] = useState<RenameMode>("prefix");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [startNumber, setStartNumber] = useState("1");
  const [padding, setPadding] = useState("3");
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");

  useEffect(() => {
    if (!propItems) {
      getShelfItems().then((shelfItems) => {
        setItems(shelfItems);
        setIsLoading(false);
      });
    }
  }, [propItems]);

  const getOptions = (): RenameOptions => ({
    mode,
    prefix,
    suffix,
    startNumber: parseInt(startNumber) || 1,
    padding: parseInt(padding) || 3,
    find,
    replace,
  });

  const previews = generateRenamePreview(items, getOptions());

  if (isLoading) {
    return <Form isLoading={true} />;
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

  const handleConfirm = async () => {
    const results = renameItems(previews);
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    // Update shelf with new paths/names
    const updatedItems = items.map((item, index) => {
      const result = results[index];
      if (result.success && result.newPath) {
        const newName = previews[index].newName;
        return { ...item, name: newName, path: result.newPath };
      }
      return item;
    });

    await updateShelfItems(updatedItems);
    if (onComplete) {
      await onComplete();
    }

    if (failCount > 0) {
      await showHUD(`Renamed ${successCount} item${successCount !== 1 ? "s" : ""}, ${failCount} failed`);
    } else {
      await showHUD(`Renamed ${successCount} item${successCount !== 1 ? "s" : ""}`);
    }

    await popToRoot();
  };

  const handleReview = () => {
    push(
      <RenameConfirmation
        previews={previews}
        onConfirm={handleConfirm}
        onBack={pop}
      />
    );
  };

  return (
    <Form
      navigationTitle="Rename Items"
      actions={
        <ActionPanel>
          <Action icon={Icon.Eye} title="Review Changes" onAction={handleReview} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="mode" title="Rename Mode" value={mode} onChange={(v) => setMode(v as RenameMode)}>
        <Form.Dropdown.Item value="prefix" title="Add Prefix" icon={Icon.Text} />
        <Form.Dropdown.Item value="suffix" title="Add Suffix" icon={Icon.Text} />
        <Form.Dropdown.Item value="numbering" title="Numbering" icon={Icon.List} />
        <Form.Dropdown.Item value="replace" title="Find & Replace" icon={Icon.MagnifyingGlass} />
      </Form.Dropdown>

      {mode === "prefix" && (
        <Form.TextField
          id="prefix"
          title="Prefix"
          placeholder="e.g., 2024_"
          value={prefix}
          onChange={setPrefix}
        />
      )}

      {mode === "suffix" && (
        <Form.TextField
          id="suffix"
          title="Suffix"
          placeholder="e.g., _backup"
          value={suffix}
          onChange={setSuffix}
          info="Added before the file extension"
        />
      )}

      {mode === "numbering" && (
        <>
          <Form.TextField
            id="startNumber"
            title="Start Number"
            placeholder="1"
            value={startNumber}
            onChange={setStartNumber}
          />
          <Form.TextField
            id="padding"
            title="Number Padding"
            placeholder="3"
            value={padding}
            onChange={setPadding}
            info="e.g., padding 3 gives 001, 002, 003..."
          />
        </>
      )}

      {mode === "replace" && (
        <>
          <Form.TextField
            id="find"
            title="Find"
            placeholder="Text to find"
            value={find}
            onChange={setFind}
          />
          <Form.TextField
            id="replace"
            title="Replace With"
            placeholder="Replacement text"
            value={replace}
            onChange={setReplace}
          />
        </>
      )}

      <Form.Separator />

      <Form.Description title="Preview" text={previews.map((p) => `${p.oldName} → ${p.newName}`).join("\n")} />
    </Form>
  );
}

