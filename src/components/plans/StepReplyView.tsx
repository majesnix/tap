import { ResponseDecodedView } from "@/components/response/ResponseDecodedView";
import { ResponseHexSection } from "@/components/response/ResponseHexSection";
import type { ReplyMessage } from "@/lib/types";

interface StepReplyViewProps {
  reply: ReplyMessage;
  stepName: string;
}

export function StepReplyView({ reply, stepName }: StepReplyViewProps) {
  const meta: { label: string; value: string }[] = [
    { label: "step", value: stepName },
    { label: "rkey", value: reply.routingKey || "(none)" },
  ];
  if (reply.exchange) meta.push({ label: "exchange", value: reply.exchange });
  if (reply.contentType) meta.push({ label: "type", value: reply.contentType });
  if (reply.correlationId) meta.push({ label: "corr", value: reply.correlationId });
  if (reply.decodedAs) meta.push({ label: "decoded as", value: reply.decodedAs });

  return (
    <div className="flex flex-col gap-4 p-4 flex-1 overflow-auto">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {meta.map(({ label, value }) => (
          <span key={label} className="text-xs font-mono text-muted-foreground">
            <span className="text-foreground/50">{label}:</span> {value}
          </span>
        ))}
      </div>
      <ResponseDecodedView decoded={reply.decoded} error={null} />
      {reply.decoded === null && (
        <div className="text-sm text-muted-foreground">No decoded content available.</div>
      )}
      <ResponseHexSection hexString={reply.hexString} decoded={reply.decoded} />
    </div>
  );
}
