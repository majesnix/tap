import { invoke } from "@tauri-apps/api/core";
import type { ProtoSchema } from "./types";

export async function parseProto(
  filePath: string,
  includePaths: string[]
): Promise<ProtoSchema> {
  return invoke<ProtoSchema>("parse_proto", { filePath, includePaths });
}

export async function encodeMessage(
  messageType: string,
  formValues: unknown
): Promise<number[]> {
  return invoke<number[]>("encode_message", { messageType, formValues });
}
