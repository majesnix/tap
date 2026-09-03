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

/**
 * A broker operation waiting for the user's go-ahead. `broker` is the
 * "host (Environment)" string from describeBroker().
 */
export type BrokerConfirmRequest =
  | { kind: "consume"; queue: string; broker: string; count: number }
  | { kind: "subscribe"; queue: string; broker: string }
  | { kind: "publish"; target: string; broker: string };

interface BrokerConfirmDialogProps {
  request: BrokerConfirmRequest | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function copyFor(request: BrokerConfirmRequest) {
  switch (request.kind) {
    case "subscribe":
      return {
        title: `Start a competing consumer on ${request.queue}?`,
        body:
          `Subscribe joins the consumer pool of "${request.queue}" on ${request.broker}. ` +
          "The broker splits deliveries between Tap and every other consumer, and Tap " +
          "acknowledges what it receives, so those messages never reach the other services.",
        confirmLabel: "Start subscribing",
      };
    case "publish":
      return {
        title: "Publish to production?",
        body: `This sends the message to ${request.target} on ${request.broker}.`,
        confirmLabel: "Publish",
      };
    case "consume": {
      const noun = request.count === 1 ? "message" : "messages";
      return {
        title: `Remove messages from ${request.queue}?`,
        body:
          `Consume takes up to ${request.count} ${noun} off "${request.queue}" on ${request.broker} ` +
          "and acknowledges them. Services consuming this queue will never see those messages.",
        confirmLabel: `Consume ${request.count} ${noun}`,
      };
    }
  }
}

/**
 * Confirmation shown before an operation that affects other people's traffic:
 * consuming or subscribing on a broker that is not the developer's own machine,
 * or publishing to a profile tagged production.
 */
export function BrokerConfirmDialog({ request, onConfirm, onCancel }: BrokerConfirmDialogProps) {
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
