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

import type { ConnectionProfile } from "./types";

/**
 * Save a profile (non-secret fields) + password (keyring) to the backend.
 * Password is passed as a separate arg — never embedded in ConnectionProfile.
 */
export async function saveProfile(
  profile: ConnectionProfile,
  password: string
): Promise<void> {
  return invoke<void>("save_profile", { profile, password });
}

export async function listProfiles(): Promise<ConnectionProfile[]> {
  return invoke<ConnectionProfile[]>("list_profiles");
}

export async function deleteProfile(profileName: string): Promise<void> {
  return invoke<void>("delete_profile", { profileName });
}

export async function testConnection(profileName: string): Promise<void> {
  return invoke<void>("test_connection", { profileName });
}

export async function activateProfile(profileName: string): Promise<void> {
  return invoke<void>("activate_profile", { profileName });
}

export async function fetchQueues(profileName: string): Promise<string[]> {
  return invoke<string[]>("fetch_queues", { profileName });
}

export async function fetchExchanges(profileName: string): Promise<string[]> {
  return invoke<string[]>("fetch_exchanges", { profileName });
}

export async function publishMessage(
  profileName: string,
  exchange: string,     // "" for default exchange (queue direct), named exchange for PUBL-02
  routingKey: string,   // queue name (PUBL-01) or explicit routing key (PUBL-02)
  payload: number[]     // binary protobuf bytes as number[] (from encodeMessage)
): Promise<void> {
  return invoke<void>("publish_message", { profileName, exchange, routingKey, payload });
}
