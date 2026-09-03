import { useState, useEffect, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { IconButton } from "@/components/common/IconButton";

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
    <IconButton size={22} label="Copy value" onClick={handleCopy}>
      {copied ? (
        <Check size={12} className="text-success" />
      ) : (
        <Copy size={12} className="text-ghost hover:text-foreground" />
      )}
    </IconButton>
  );
}
