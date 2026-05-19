import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { FieldSchema } from "@/lib/types";

interface BytesFieldProps {
  field: FieldSchema;
  path: string;
}

/**
 * Encode arbitrary UTF-8 text to standard base64 (RFC 4648).
 * Uses TextEncoder to handle non-ASCII characters safely.
 * NOTE: bare btoa(text) throws InvalidCharacterError for code points > 255
 * (e.g. "café", "日本語") — TextEncoder is the correct approach (D-04).
 */
function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Zod schema for standard base64 (RFC 4648 +/ alphabet).
 *
 * Two-layer validation:
 * 1. Character-set regex — rejects URL-safe characters (- and _) (D-06, BFLD-03)
 * 2. .refine with structural regex — catches invalid lengths like "abc"
 *    (3 chars, no padding) that pass layer 1 but are structurally invalid
 *    (base64 must be empty, or n*4 chars, or end in == or =).
 *    Rust's base64_decode_or_empty would silently return empty Vec<u8> on such
 *    inputs (BFLD-04, D-07). Note: bare atob() is NOT used here because Node
 *    and jsdom's atob() pads "abc" silently rather than throwing.
 *
 * Both layers use the same error message (D-08).
 */
const base64Schema = z
  .string()
  .regex(
    /^[A-Za-z0-9+/]*={0,2}$/,
    "Must be valid base64 (standard alphabet, not URL-safe)"
  )
  .refine(
    (s) => {
      if (s === "") return true;
      // Strict structural check: valid base64 must match the full RFC 4648 pattern.
      // Groups of 4 chars, with optional 2-char+== or 3-char+= tail.
      return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s);
    },
    "Must be valid base64 (standard alphabet, not URL-safe)"
  );

/**
 * BytesField renders a proto `bytes` scalar field with:
 * - Base64 text input (RFC 4648 standard +/ alphabet)
 * - Zod character-set + structural validation (BFLD-03, BFLD-04)
 * - Byte count label when valid and non-empty
 * - "From text" popover helper for UTF-8 → base64 conversion via TextEncoder (BFLD-02)
 *
 * Wired into ProtoFormRenderer via pre-dispatch branch (D-01).
 * Replaces the bare z.string() fallback in ScalarField (D-02).
 */
export function BytesField({ field, path }: BytesFieldProps) {
  const { control } = useFormContext();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [utf8Input, setUtf8Input] = useState("");

  const validate = (value: unknown) => {
    const result = base64Schema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message ?? "Invalid value";
    }
    return true;
  };

  return (
    <div className="flex flex-col gap-1 mb-3">
      {/* Label row */}
      <div className="flex items-center gap-2">
        <Label className="text-xs font-semibold text-foreground" htmlFor={path}>
          {field.label}
        </Label>
        <Badge variant="outline" className="text-xs px-1.5 py-0 w-fit">
          bytes
        </Badge>
      </div>

      {/* Single Controller — wraps input, byte count, error, and popover trigger */}
      <Controller
        name={path}
        control={control}
        defaultValue=""
        rules={{ validate }}
        render={({ field: rhfField, fieldState }) => (
          <>
            <Input
              id={path}
              type="text"
              value={rhfField.value ?? ""}
              onChange={(e) => rhfField.onChange(e.target.value)}
              onBlur={rhfField.onBlur}
              aria-invalid={!!fieldState.error}
              className={fieldState.error ? "border-destructive" : ""}
              placeholder="base64 encoded value"
            />

            {/* Layout order per UI-SPEC: byte count OR error (mutually exclusive), then From text */}
            {/* Guard with safeParse before atob() — mode:'onBlur' means fieldState.error is
                undefined during typing, so atob() would throw InvalidCharacterError on partial
                inputs (e.g. "a", "aG"). Only call atob() when the value is known-valid. */}
            {!fieldState.error &&
              rhfField.value !== "" &&
              base64Schema.safeParse(rhfField.value).success && (
                <p className="text-xs text-muted-foreground">
                  {atob(rhfField.value).length} bytes
                </p>
              )}

            {fieldState.error && (
              <p className="text-xs text-destructive" role="alert">
                {field.label}: {fieldState.error.message}
              </p>
            )}

            {/* "From text" helper — below input, left-aligned (D-05) */}
            <Popover open={popoverOpen} onOpenChange={(open) => { setPopoverOpen(open); if (!open) setUtf8Input(""); }}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="text-xs w-fit">
                  From text
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" side="bottom" align="start">
                <div className="flex flex-col gap-2">
                  <Textarea
                    placeholder="Type UTF-8 text to convert to base64…"
                    value={utf8Input}
                    onChange={(e) => setUtf8Input(e.target.value)}
                    className="min-h-20 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs"
                    disabled={utf8Input === ""}
                    onClick={() => {
                      rhfField.onChange(utf8ToBase64(utf8Input));
                      setPopoverOpen(false);
                      setUtf8Input("");
                    }}
                  >
                    Convert
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}
      />
    </div>
  );
}
