import { createContext, useContext } from "react";
import type { MessageSchema } from "@/lib/types";

export const ProtoSchemaContext = createContext<Record<string, MessageSchema> | null>(null);
export const useMessageMap = () => useContext(ProtoSchemaContext);
