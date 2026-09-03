import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { keymap } from "@codemirror/view";
import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jsonEditorTheme } from "./jsonEditorTheme";

export interface JsonEditorProps {
  /** Current JSON string displayed in the editor (controlled — from useRequestForm state) */
  value: string;
  /** Called on every keystroke with the new editor string */
  onChange: (value: string) => void;
  /** "light" | "dark" — from next-themes resolvedTheme in RequestCard */
  resolvedTheme: string | undefined;
  /** Non-null string means banner is shown; null means banner is hidden */
  parseError: string | null;
  /** Called when user clicks "Fix JSON" — useRequestForm clears parseError */
  onFixJson: () => void;
  /** Called when user clicks "Discard changes" — useRequestForm restores entrySnapshot */
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

  const dark = resolvedTheme === "dark";
  const themeExtensions = useMemo(() => jsonEditorTheme(dark), [dark]);
  const extensions = useMemo(
    () => (submitKeymap ? [json(), submitKeymap, ...themeExtensions] : [json(), ...themeExtensions]),
    [submitKeymap, themeExtensions]
  );

  return (
    <>
      <CodeMirror
        value={value}
        height="100%"
        theme="none"
        extensions={extensions}
        onChange={onChange}
        className="flex-1 min-h-0"
        basicSetup={{ lineNumbers: true, bracketMatching: true }}
      />
      {parseError && (
        <div className="mx-4 mt-2 mb-3 rounded-md border border-danger/40 bg-danger/10 p-3">
          <div className="flex items-start gap-2">
            <TriangleAlertIcon strokeWidth={1.5} size={14} className="text-danger shrink-0 mt-1" />
            <div className="flex flex-col gap-1">
              <span className="text-13 font-semibold text-danger">
                Invalid JSON
              </span>
              <p className="text-12 text-danger mt-1" role="alert">
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
