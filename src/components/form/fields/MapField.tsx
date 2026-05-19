// STUB — full implementation in Plan 03 (07-03-PLAN.md)
// This file exists only to satisfy the import in ProtoFormRenderer.tsx

import React from "react";
import type { FieldSchema, RenderFieldFn } from "@/lib/types";

interface MapFieldProps {
  field: FieldSchema;
  path: string;
  depth: number;
  renderValue: RenderFieldFn;
}

export function MapField(_props: MapFieldProps): React.ReactNode {
  return null;
}
