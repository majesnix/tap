import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion } from "@/components/ui/accordion";
import { MessageFeedRow } from "@/components/response/MessageFeedRow";
import { usePlanExecutionStore } from "@/stores/usePlanExecutionStore";

export function PlanReplyFeedTab() {
  const planReplyFeed = usePlanExecutionStore((s) => s.planReplyFeed);

  if (planReplyFeed.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No replies received yet — run a plan with correlation-id or first-arrival steps to see
        responses here.
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 overflow-hidden">
      <Accordion type="single" collapsible className="w-full">
        {planReplyFeed.map((msg) => (
          <MessageFeedRow key={msg.id} message={msg} />
        ))}
      </Accordion>
    </ScrollArea>
  );
}
