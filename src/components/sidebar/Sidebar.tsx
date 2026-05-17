import { useProtoStore } from "@/stores/useProtoStore";
import { parseProto } from "@/lib/ipc";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export function Sidebar() {
  const { schema, activeFilePath, selectedMessageType, setFile, setSelectedType } =
    useProtoStore();

  const handleOpenFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Proto files", extensions: ["proto"] }],
    });

    if (!selected || typeof selected !== "string") return;

    try {
      // Use file directory as default include path
      const pathParts = selected.split("/");
      pathParts.pop();
      const dir = pathParts.join("/") || "/";
      const result = await parseProto(selected, [dir]);
      setFile(selected, result);
    } catch (err) {
      console.error("Failed to parse proto:", err);
    }
  };

  const fileName = activeFilePath
    ? activeFilePath.split("/").pop() ?? activeFilePath
    : null;

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold">Proto Sender</h1>
        <p className="text-xs text-muted-foreground">
          Load a .proto file to get started
        </p>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <Button onClick={handleOpenFile} variant="outline" className="w-full">
          Open .proto File
        </Button>

        {fileName && (
          <p className="text-xs text-muted-foreground truncate" title={activeFilePath ?? ""}>
            {fileName}
          </p>
        )}
      </div>

      {schema && schema.messages.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Message Type</label>
            <Select
              value={selectedMessageType ?? ""}
              onValueChange={setSelectedType}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select message..." />
              </SelectTrigger>
              <SelectContent>
                {schema.messages.map((msg) => (
                  <SelectItem key={msg.full_name} value={msg.full_name}>
                    {msg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      <div className="flex-1" />

      <div className="text-xs text-muted-foreground text-center">
        v0.1.0 — Walking Skeleton
      </div>
    </div>
  );
}
