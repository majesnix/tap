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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tag } from "@/components/common/Tag";
import type { ConflictItem } from "@/lib/blockApply";
import type { useRequestForm } from "@/components/compose/useRequestForm";

interface BlockConflictDialogProps {
  conflict: ReturnType<typeof useRequestForm>["conflict"];
}

/** A stable key per conflict row; compound for map keys and oneof sub-fields. */
function choiceKeyOf(item: ConflictItem): string {
  if (item.kind === "map_key_collision") return `${item.fieldName}:${item.collisionKey}`;
  if (item.kind === "oneof_dirty_subfield") return `${item.fieldName}:${item.subFieldName}`;
  return item.fieldName; // oneof_branch_switch
}

function labelOf(item: ConflictItem): string {
  if (item.kind === "map_key_collision") {
    return `"${item.fieldLabel ?? item.fieldName}" — key "${item.collisionKey}" already exists`;
  }
  if (item.kind === "oneof_dirty_subfield") {
    return `"${item.fieldLabel ?? item.fieldName}.${item.subFieldLabel ?? item.subFieldName}" already has a value`;
  }
  return `Switch "${item.fieldLabel ?? item.fieldName}" from "${item.currentBranch}" to "${item.blockBranch}"`;
}

function kindOf(item: ConflictItem): string {
  if (item.kind === "map_key_collision") return "map key";
  if (item.kind === "oneof_dirty_subfield") return "dirty field";
  return "branch switch";
}

const MAX_PREVIEW = 60;

function previewOf(item: ConflictItem): string {
  const raw =
    item.currentValue !== null && item.currentValue !== undefined
      ? JSON.stringify(item.currentValue)
      : "—";
  return raw.length > MAX_PREVIEW ? `${raw.slice(0, MAX_PREVIEW)}...` : raw;
}

/** Asks what to do with the fields a dropped block would overwrite. Rows default to Skip. */
export function BlockConflictDialog({ conflict }: BlockConflictDialogProps) {
  const conflicts = conflict.plan?.conflicts ?? [];

  return (
    <AlertDialog open={conflict.plan !== null}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Review conflicts</AlertDialogTitle>
          <AlertDialogDescription>
            {conflicts.length === 1
              ? "1 field already has a value. Choose what to do."
              : `${conflicts.length} fields already have values. Choose what to do for each.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-[50vh] overflow-y-auto px-6">
          {conflicts.map((item) => {
            const choiceKey = choiceKeyOf(item);
            return (
              <div
                key={choiceKey}
                className="flex items-start gap-2 border-b border-hairline py-2 last:border-0"
              >
                <RadioGroup
                  value={conflict.choices[choiceKey] ?? "skip"}
                  onValueChange={(v) =>
                    conflict.setChoices((prev) => ({
                      ...prev,
                      [choiceKey]: v as "skip" | "overwrite",
                    }))
                  }
                  className="flex flex-col gap-1"
                >
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="skip" id={`skip-${choiceKey}`} />
                    <label htmlFor={`skip-${choiceKey}`} className="cursor-pointer text-12">
                      Skip
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RadioGroupItem value="overwrite" id={`overwrite-${choiceKey}`} />
                    <label htmlFor={`overwrite-${choiceKey}`} className="cursor-pointer text-12">
                      Overwrite
                    </label>
                  </div>
                </RadioGroup>
                <div className="flex flex-1 flex-col items-start gap-1">
                  <span className="text-12 font-semibold">{labelOf(item)}</span>
                  <Tag tone="neutral">{kindOf(item)}</Tag>
                  <span className="text-12 text-muted-foreground">{previewOf(item)}</span>
                </div>
              </div>
            );
          })}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel autoFocus onClick={conflict.discard}>
            Discard block
          </AlertDialogCancel>
          <AlertDialogAction onClick={conflict.apply}>Apply block</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
