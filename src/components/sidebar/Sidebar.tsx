import { useProtoStore } from "@/stores/useProtoStore";
import { FileSection } from "@/components/sidebar/FileSection";
import { ConnectionSection } from "@/components/sidebar/ConnectionSection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/sidebar/ThemeToggle";

export function Sidebar() {
  const { schema, selectedMessageType, setSelectedType } = useProtoStore();

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold">Proto Sender</h1>
        <p className="text-xs text-muted-foreground">
          Load a .proto file to get started
        </p>
      </div>

      <Separator />

      <FileSection />

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

      {/* Connection panel: profile dropdown + status dot + manage button */}
      <Separator />
      <ConnectionSection />

      <div className="flex-1" />
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">v0.1.0 — Walking Skeleton</div>
        <ThemeToggle />
      </div>
    </div>
  );
}
