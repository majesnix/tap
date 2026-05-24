import { Channel, invoke } from "@tauri-apps/api/core";
import type { ProtoSchema, ConsumeResult, ExchangeSummary, PublishOutcome, DrainOutcome, DrainResult, PlanStep, StepResult, ReplyMessage } from "./types";

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
): Promise<PublishOutcome> {
  return invoke<PublishOutcome>("publish_message", {
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

/**
 * Drain up to count messages from queueName in one shot.
 * messageTypeNames: ordered candidate list — Rust tries each in order, first success wins (D-19).
 * Returns DrainOutcome { messages: DrainResult[], partialError: string | null }.
 */
export async function drainMessages(
  profileName: string,
  queueName: string,
  messageTypeNames: string[],
  count: number,
): Promise<DrainOutcome> {
  return invoke<DrainOutcome>("drain_messages", {
    profileName,
    queueName,
    messageTypeNames,
    count,
  });
}

// ── Phase 14: Live subscribe IPC wrappers ──────────────────────────────────────

/**
 * Start a persistent AMQP consumer on queueName.
 * Messages are delivered one-at-a-time via the channel callback as DrainResult objects.
 * Returns immediately after spawning the consumer task (D-02).
 * Frontend must call stopSubscribe() or the connection profile must change to stop the loop.
 */
export function startSubscribe(
  profileName: string,
  queueName: string,
  decodeTypes: string[],
  channel: Channel<DrainResult>,
): Promise<void> {
  return invoke("start_subscribe", { profileName, queueName, decodeTypes, channel });
}

/**
 * Cancel the running AMQP consumer by triggering the CancellationToken (D-09).
 * Returns immediately; the consumer task exits asynchronously and the channel closes.
 */
export function stopSubscribe(): Promise<void> {
  return invoke("stop_subscribe");
}

// ── Phase 22: Plan runner IPC types ──────────────────────────────────────────

/**
 * ReplyMessage as serialized by the Rust backend over Tauri IPC.
 * Rust applies #[serde(rename_all = "camelCase")] to ReplyMessage, so all
 * fields arrive as camelCase. No raw_bytes field — not serialized to JS (internal only).
 * No exchange field — not present in the Rust ReplyMessage IPC shape.
 */
export interface ReplyMessageIpc {
  routingKey: string;
  contentType: string | null;
  decoded: Record<string, unknown> | null;
  decodedAs: string | null;
  hexString: string;
}

/**
 * StepResult as returned by the execute_step Tauri command.
 * Rust applies #[serde(rename_all = "camelCase")] to StepResult (plan_runner.rs:97),
 * so the top-level field arrives as stepId over the Tauri IPC channel. (D-02, D-03)
 * The reply field is already camelCase (from ReplyMessageIpc).
 */
export interface StepResultIpc {
  stepId: string;
  status: 'done' | 'error';
  reply: ReplyMessageIpc | null;
  error: string | null;
}

// ── Phase 22: Plan runner invoke wrappers ─────────────────────────────────────

/**
 * Execute a single plan step on the Rust backend.
 * Rust applies rename_all="camelCase" to both StepResult and ReplyMessage,
 * so all fields arrive as camelCase — no field renaming needed. (D-01, D-03)
 */
export async function executeStep(
  profileName: string,
  step: PlanStep,
): Promise<StepResult> {
  const ipc = await invoke<StepResultIpc>('execute_step', { profileName, step });
  return {
    stepId: ipc.stepId,
    status: ipc.status,
    error: ipc.error,
    reply: ipc.reply as ReplyMessage | null,
  };
}

/**
 * Cancel the currently running plan execution.
 * Triggers cancellation in the Rust backend; returns immediately. (D-04)
 */
export async function cancelPlanRun(): Promise<void> {
  return invoke('cancel_plan_run');
}
