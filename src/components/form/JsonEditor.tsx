import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { keymap } from "@codemirror/view";
import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface JsonEditorProps {
  /** Current JSON string displayed in the editor (controlled — from FormPanel state) */
  value: string;
  /** Called on every keystroke with the new editor string */
  onChange: (value: string) => void;
  /** "light" | "dark" — from next-themes resolvedTheme in FormPanel */
  resolvedTheme: string | undefined;
  /** Non-null string means banner is shown; null means banner is hidden */
  parseError: string | null;
  /** Called when user clicks "Fix JSON" — FormPanel clears parseError */
  onFixJson: () => void;
  /** Called when user clicks "Discard changes" — FormPanel restores entrySnapshot */
  onDiscard: () => void;
  /** Called on Cmd+Enter inside the CodeMirror editor */
  onSubmit?: () => void;
}

export function JsonEditor({
  value,
  onChange,
  resolvedTheme,
  parseError,
  onFixJson,
  onDiscard,
  onSubmit,
}: JsonEditorProps) {
  const submitKeymap = useMemo(() => {
    if (!onSubmit) return null;
    return keymap.of([{
      key: "Mod-Enter",
      run: () => { onSubmit(); return true; },
    }]);
  }, [onSubmit]);

  return (
    <>
      <CodeMirror
        value={value}
        height="100%"
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        extensions={submitKeymap ? [json(), submitKeymap] : [json()]}
        onChange={onChange}
        className="flex-1 min-h-0"
        basicSetup={{ lineNumbers: true, bracketMatching: true }}
      />
      {parseError && (
        <div className="mx-4 mt-2 mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3">
          <div className="flex items-start gap-2">
            <TriangleAlertIcon className="size-4 text-destructive shrink-0 mt-1" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-destructive">
                Invalid JSON
              </span>
              <p className="text-xs text-destructive mt-1" role="alert">
                {parseError}
              </p>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={onFixJson}>
                  Fix JSON
                </Button>
                <Button variant="destructive" size="sm" onClick={onDiscard}>
                  Discard changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
