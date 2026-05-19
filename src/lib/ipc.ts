import { invoke } from "@tauri-apps/api/core";
import type { ProtoSchema, ConsumeResult, ExchangeSummary } from "./types";

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

export async function fetchQueueDepth(
  profileName: string,
  queueName: string,
): Promise<number> {
  return invoke<number>("fetch_queue_depth", { profileName, queueName });
}

export async function fetchExchanges(profileName: string): Promise<ExchangeSummary[]> {
  return invoke<ExchangeSummary[]>("fetch_exchanges", { profileName });
}

/**
 * Fetch routing keys from a named exchange's bindings via the Management API.
 * Returns deduplicated, non-empty routing key strings.
 * On any error the frontend silently falls back to plain Input (D-10).
 */
export async function fetchBindings(
  profileName: string,
  exchangeName: string,
): Promise<string[]> {
  return invoke<string[]>("fetch_bindings", { profileName, exchangeName });
}

export interface AmqpPropsIpc {
  contentType?: string | null;
  deliveryMode?: number | null;
  ttl?: number | null;
  correlationId?: string | null;
  replyTo?: string | null;
  headers?: Array<[string, string]> | null;
}

export async function publishMessage(
  profileName: string,
  exchange: string, // "" for default exchange (queue direct), named exchange for PUBL-02
  routingKey: string, // queue name (PUBL-01) or explicit routing key (PUBL-02)
  payload: number[], // binary protobuf bytes as number[] (from encodeMessage)
  amqpProps?: AmqpPropsIpc
): Promise<void> {
  return invoke<void>("publish_message", {
    profileName,
    exchange,
    routingKey,
    payload,
    contentType: amqpProps?.contentType ?? null,
    deliveryMode: amqpProps?.deliveryMode ?? null,
    ttl: amqpProps?.ttl ?? null,
    correlationId: amqpProps?.correlationId ?? null,
    replyTo: amqpProps?.replyTo ?? null,
    headers: amqpProps?.headers ?? null,
  });
}

export async function consumeMessage(
  profileName: string,
  queueName: string,
  messageTypeName: string,
): Promise<ConsumeResult> {
  return invoke<ConsumeResult>("consume_message", {
    profileName,
    queueName,
    messageTypeName,
  });
}
