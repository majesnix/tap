import { useState, useEffect, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const FEEDBACK_DURATION_MS = 1500;

interface CopyButtonProps {
  value: string;
}

export function CopyButton({ value }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), FEEDBACK_DURATION_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast.error("Copy failed — clipboard access denied");
    }
  }, [value]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={handleCopy}
      aria-label="Copy value"
      title="Copy value"
    >
      {copied ? (
        <Check className="size-3.5 text-green-500" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </Button>
  );
}
