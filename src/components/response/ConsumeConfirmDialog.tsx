import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** A destructive broker operation waiting for the user's go-ahead. */
export type ConsumeConfirmRequest =
  | { kind: "consume"; queue: string; host: string; count: number }
  | { kind: "subscribe"; queue: string; host: string };

interface ConsumeConfirmDialogProps {
  request: ConsumeConfirmRequest | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function copyFor(request: ConsumeConfirmRequest) {
  if (request.kind === "subscribe") {
    return {
      title: `Start a competing consumer on ${request.queue}?`,
      body:
        `Subscribe joins the consumer pool of "${request.queue}" on ${request.host}. ` +
        "The broker splits deliveries between Tap and every other consumer, and Tap " +
        "acknowledges what it receives, so those messages never reach the other services.",
      confirmLabel: "Start subscribing",
    };
  }
  const noun = request.count === 1 ? "message" : "messages";
  return {
    title: `Remove messages from ${request.queue}?`,
    body:
      `Consume takes up to ${request.count} ${noun} off "${request.queue}" on ${request.host} ` +
      "and acknowledges them. Services consuming this queue will never see those messages.",
    confirmLabel: `Consume ${request.count} ${noun}`,
  };
}

/**
 * Confirmation shown before Consume or Subscribe touches a queue on a host that
 * is not the developer's own machine. Both operations remove messages from the
 * queue for every other consumer, which is easy to forget when the button says
 * "Start".
 */
export function ConsumeConfirmDialog({ request, onConfirm, onCancel }: ConsumeConfirmDialogProps) {
  const copy = request ? copyFor(request) : null;
  return (
    <AlertDialog
      open={request !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy?.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{copy?.confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
