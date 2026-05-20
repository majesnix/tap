import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface ResponseHexSectionProps {
  hexString: string;
  decoded: Record<string, unknown> | null;
}

export function ResponseHexSection({ hexString, decoded }: ResponseHexSectionProps) {
  if (!hexString) return null;

  const handleCopyHex = async () => {
    try {
      await navigator.clipboard.writeText(hexString);
      toast("Hex copied", { duration: 2000 });
    } catch {
      toast.error("Copy failed — clipboard access denied", { duration: 2000 });
    }
  };

  const handleCopyJson = async () => {
    if (!decoded) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(decoded, null, 2));
      toast("JSON copied", { duration: 2000 });
    } catch {
      toast.error("Copy failed — clipboard access denied", { duration: 2000 });
    }
  };

  return (
    <>
      <Separator />
      <div className="px-4 py-2">
        {/* Copy action buttons (UI-SPEC: Copy icon + variant="ghost" size="sm") */}
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => void handleCopyHex()}>
            <Copy className="w-3 h-3 mr-1" />
            Copy hex
          </Button>
          {decoded !== null && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => void handleCopyJson()}
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy decoded JSON
            </Button>
          )}
        </div>
        {/* Hex string display (UI-SPEC: text-xs font-mono break-all whitespace-pre-wrap) */}
        <pre className="text-xs font-mono break-all whitespace-pre-wrap text-foreground">
          {hexString}
        </pre>
      </div>
    </>
  );
}
