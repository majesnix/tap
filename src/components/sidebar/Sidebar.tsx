import { useProtoStore } from "@/stores/useProtoStore";
import { FileSection } from "@/components/sidebar/FileSection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

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

      <div className="flex-1" />

      <div className="text-xs text-muted-foreground text-center">
        v0.1.0 — Walking Skeleton
      </div>
    </div>
  );
}
