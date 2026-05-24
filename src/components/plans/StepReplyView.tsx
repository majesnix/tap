import { ResponseDecodedView } from "@/components/response/ResponseDecodedView";
import { ResponseHexSection } from "@/components/response/ResponseHexSection";
import type { ReplyMessage } from "@/lib/types";

interface StepReplyViewProps {
  reply: ReplyMessage;
  stepName: string;
}

export function StepReplyView({ reply, stepName }: StepReplyViewProps) {
  return (
    <div className="flex flex-col gap-4 p-4 flex-1 overflow-auto">
      <div className="text-sm text-muted-foreground">Reply from: {stepName}</div>
      <ResponseDecodedView decoded={reply.decoded} error={null} />
      {reply.decoded === null && (
        <div className="text-sm text-muted-foreground">No decoded content available.</div>
      )}
      <ResponseHexSection hexString={reply.hexString} decoded={reply.decoded} />
    </div>
  );
}
