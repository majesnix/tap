use lapin::{Connection, ConnectionProperties};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::error::AppError;
use crate::profiles::{
    build_amqp_uri, delete_password, get_password, store_password, ConnectionProfile,
    PROFILES_STORE_KEY,
};

/// Intermediate struct for deserializing Management API /api/queues response.
/// Uses serde to ignore all fields except name — the Management API returns 50+ fields.
#[derive(Deserialize)]
struct QueueApiInfo {
    name: String,
}

/// Intermediate struct for deserializing a single queue's depth from the Management API.
#[derive(Deserialize)]
struct QueueDepthApiInfo {
    messages: u64,
}

/// Intermediate struct for deserializing Management API /api/exchanges response.
#[derive(Deserialize)]
struct ExchangeApiInfo {
    name: String,
    #[serde(rename = "type")]
    exchange_type: String,
    internal: bool,
}

/// Public output struct for fetch_exchanges — carries exchange type for frontend eligibility checks.
#[derive(Serialize)]
pub struct ExchangeSummary {
    pub name: String,
    pub exchange_type: String, // raw from API: "direct" | "fanout" | "topic" | "headers"
}

/// Helper: load profile from store and retrieve password from keychain.
/// Returns (profile, password) — password is cleartext, use immediately.
pub(crate) fn load_profile_with_password(
    app: &AppHandle,
    profile_name: &str,
) -> Result<(crate::profiles::ConnectionProfile, String), AppError> {
    let store = app
        .store("proto-sender.json")
        .map_err(|e| AppError::StoreError(e.to_string()))?;

    let profiles: Vec<crate::profiles::ConnectionProfile> = store
        .get(crate::profiles::PROFILES_STORE_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    let profile = profiles
        .into_iter()
        .find(|p| p.name == profile_name)
        .ok_or_else(|| AppError::ProfileNotFound(profile_name.to_string()))?;

    let password = crate::profiles::get_password(profile_name)?;
    Ok((profile, password))
}

/// Save a connection profile (non-secret fields to tauri-plugin-store; password to OS keychain).
/// SECURITY: password param is used then dropped — never stored in any struct or logged.
// SECURITY: do not log password or AMQP URI
#[tauri::command]
pub async fn save_profile(
    app: AppHandle,
    profile: ConnectionProfile,
    password: String,
) -> Result<(), AppError> {
    // 1. Store password in OS keychain
    store_password(&profile.name, &password)?;
    tracing::debug!("Saving profile: {}", profile.name);

    // 2. Load existing profiles from store
    let store = app
        .store("proto-sender.json")
        .map_err(|e| AppError::StoreError(e.to_string()))?;

    let mut profiles: Vec<ConnectionProfile> = store
        .get(PROFILES_STORE_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    // 3. Upsert: replace existing profile with same name or append
    if let Some(existing) = profiles.iter_mut().find(|p| p.name == profile.name) {
        *existing = profile;
    } else {
        profiles.push(profile);
    }

    // 4. Persist non-secret fields (no password in JSON)
    let profiles_value = serde_json::to_value(&profiles)
        .map_err(|e| AppError::StoreError(e.to_string()))?;
    store.set(PROFILES_STORE_KEY, profiles_value);
    store
        .save()
        .map_err(|e| AppError::StoreError(e.to_string()))?;

    Ok(())
}

/// Return all saved profiles (no passwords — retrieved from keychain separately).
#[tauri::command]
pub async fn list_profiles(app: AppHandle) -> Result<Vec<ConnectionProfile>, AppError> {
    let store = app
        .store("proto-sender.json")
        .map_err(|e| AppError::StoreError(e.to_string()))?;

    let profiles: Vec<ConnectionProfile> = store
        .get(PROFILES_STORE_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    Ok(profiles)
}

/// Delete a profile: remove from store and delete password from OS keychain.
#[tauri::command]
pub async fn delete_profile(app: AppHandle, profile_name: String) -> Result<(), AppError> {
    // 1. Remove from store
    let store = app
        .store("proto-sender.json")
        .map_err(|e| AppError::StoreError(e.to_string()))?;

    let mut profiles: Vec<ConnectionProfile> = store
        .get(PROFILES_STORE_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    profiles.retain(|p| p.name != profile_name);

    let profiles_value = serde_json::to_value(&profiles)
        .map_err(|e| AppError::StoreError(e.to_string()))?;
    store.set(PROFILES_STORE_KEY, profiles_value);
    store
        .save()
        .map_err(|e| AppError::StoreError(e.to_string()))?;

    // 2. Delete password from OS keychain (best-effort — ignore if not found)
    let _ = delete_password(&profile_name);

    Ok(())
}

/// Test an AMQP connection for a saved profile.
/// Ephemeral: connects, opens a channel, closes. No persistent state kept.
/// SECURITY: AMQP URI is built inside this function, used, and dropped.
/// Never logged — tracing only records profile name and success/failure.
/// Wraps lapin connect in a 10s timeout to prevent indefinite hang on unreachable brokers.
#[tauri::command]
pub async fn test_connection(app: AppHandle, profile_name: String) -> Result<(), AppError> {
    // Load profile from store
    let store = app
        .store("proto-sender.json")
        .map_err(|e| AppError::StoreError(e.to_string()))?;

    let profiles: Vec<ConnectionProfile> = store
        .get(PROFILES_STORE_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    let profile = profiles
        .into_iter()
        .find(|p| p.name == profile_name)
        .ok_or_else(|| AppError::ProfileNotFound(profile_name.clone()))?;

    // Load password from OS keychain (NOT from store JSON)
    let password = get_password(&profile_name)?;

    // Build AMQP URI — use immediately, drop after connection attempt
    let uri = build_amqp_uri(&profile.host, profile.port, &profile.vhost, &profile.username, &password);

    // Connect with 10s timeout to prevent indefinite hang
    // SECURITY: uri contains cleartext password — never log it
    let conn = tokio::time::timeout(
        Duration::from_secs(10),
        Connection::connect(&uri, ConnectionProperties::default()),
    )
    .await
    .map_err(|_| AppError::AmqpError("Connection timed out (10s)".to_string()))?
    .map_err(|e| AppError::AmqpError(e.to_string()))?;

    // Open a channel to verify credentials and vhost access
    conn.create_channel()
        .await
        .map_err(|e| AppError::AmqpError(e.to_string()))?;

    // Close the connection — ephemeral pattern, no persistent state
    let _ = conn.close(0, "".into()).await;

    tracing::debug!("Connection test passed for profile: {}", profile_name);
    Ok(())
}

/// Activate a profile: test its connection and update frontend connection state.
/// Called when user switches profiles in the sidebar dropdown.
/// Returns Ok(()) on success — frontend updates status dot via store on Ok/Err.
#[tauri::command]
pub async fn activate_profile(app: AppHandle, profile_name: String) -> Result<(), AppError> {
    // Reuse test_connection logic — if it succeeds, this profile is now active
    test_connection(app, profile_name).await
}

/// Fetch queue names from the RabbitMQ Management API.
/// Returns Vec<String> of queue names for the profile's vhost.
///
/// Error disambiguation (CRITICAL — per Pitfall 7):
/// - reqwest connect error (is_connect=true) → ManagementApiUnavailable(0)  — frontend shows Manual badge
/// - HTTP 401 → ManagementApiAuthFailed — surface as error (NOT silent fallback)
/// - HTTP 404 → ManagementApiUnavailable(404) — plugin not enabled, silent fallback
/// - Other HTTP → ManagementApiUnavailable(status)
///
/// SECURITY: Uses reqwest basic_auth (Authorization header), NOT URL-embedded credentials.
#[tauri::command]
pub async fn fetch_queues(
    app: AppHandle,
    profile_name: String,
) -> Result<Vec<String>, AppError> {
    let (profile, password) = load_profile_with_password(&app, &profile_name)?;

    let encoded_vhost = percent_encoding::utf8_percent_encode(
        &profile.vhost,
        percent_encoding::NON_ALPHANUMERIC,
    );
    let scheme = if profile.management_ssl { "https" } else { "http" };
    let url = format!(
        "{}://{}:{}/api/queues/{}",
        scheme, profile.host, profile.management_port, encoded_vhost
    );

    let client = Client::new();
    let resp = client
        .get(&url)
        .basic_auth(&profile.username, Some(&password))
        // SECURITY: basic_auth sets Authorization header — credentials NOT in URL
        .send()
        .await
        .map_err(|e| {
            if e.is_connect() {
                AppError::ManagementApiUnavailable(0) // port unreachable
            } else {
                AppError::ManagementApiError(e.to_string())
            }
        })?;

    match resp.status().as_u16() {
        200 => {
            let queues: Vec<QueueApiInfo> = resp
                .json()
                .await
                .map_err(|e| AppError::ManagementApiError(e.to_string()))?;
            Ok(queues.into_iter().map(|q| q.name).collect())
        }
        401 => Err(AppError::ManagementApiAuthFailed),
        404 => Err(AppError::ManagementApiUnavailable(404)),
        other => Err(AppError::ManagementApiUnavailable(other)),
    }
}

/// Fetch the ready+unacknowledged message count for a single queue.
/// Returns u64 — callers treat None (Management API unavailable) as a silent no-op.
///
/// SECURITY: credentials passed via Authorization header, not URL.
#[tauri::command]
pub async fn fetch_queue_depth(
    app: AppHandle,
    profile_name: String,
    queue_name: String,
) -> Result<u64, AppError> {
    let (profile, password) = load_profile_with_password(&app, &profile_name)?;

    let encoded_vhost = percent_encoding::utf8_percent_encode(
        &profile.vhost,
        percent_encoding::NON_ALPHANUMERIC,
    );
    let encoded_queue = percent_encoding::utf8_percent_encode(
        &queue_name,
        percent_encoding::NON_ALPHANUMERIC,
    );
    let scheme = if profile.management_ssl { "https" } else { "http" };
    let url = format!(
        "{}://{}:{}/api/queues/{}/{}",
        scheme, profile.host, profile.management_port, encoded_vhost, encoded_queue
    );

    let client = Client::new();
    let resp = client
        .get(&url)
        .basic_auth(&profile.username, Some(&password))
        .send()
        .await
        .map_err(|e| {
            if e.is_connect() {
                AppError::ManagementApiUnavailable(0)
            } else {
                AppError::ManagementApiError(e.to_string())
            }
        })?;

    match resp.status().as_u16() {
        200 => {
            let info: QueueDepthApiInfo = resp
                .json()
                .await
                .map_err(|e| AppError::ManagementApiError(e.to_string()))?;
            Ok(info.messages)
        }
        401 => Err(AppError::ManagementApiAuthFailed),
        404 => Err(AppError::ManagementApiUnavailable(404)),
        other => Err(AppError::ManagementApiUnavailable(other)),
    }
}

/// Fetch exchange names from the RabbitMQ Management API.
/// Filters out: internal exchanges, system exchanges (name starts with "amq."),
/// and the empty-name default exchange.
///
/// Same error disambiguation as fetch_queues.
#[tauri::command]
pub async fn fetch_exchanges(
    app: AppHandle,
    profile_name: String,
) -> Result<Vec<ExchangeSummary>, AppError> {
    let (profile, password) = load_profile_with_password(&app, &profile_name)?;

    let encoded_vhost = percent_encoding::utf8_percent_encode(
        &profile.vhost,
        percent_encoding::NON_ALPHANUMERIC,
    );
    let scheme = if profile.management_ssl { "https" } else { "http" };
    let url = format!(
        "{}://{}:{}/api/exchanges/{}",
        scheme, profile.host, profile.management_port, encoded_vhost
    );

    let client = Client::new();
    let resp = client
        .get(&url)
        .basic_auth(&profile.username, Some(&password))
        .send()
        .await
        .map_err(|e| {
            if e.is_connect() {
                AppError::ManagementApiUnavailable(0)
            } else {
                AppError::ManagementApiError(e.to_string())
            }
        })?;

    match resp.status().as_u16() {
        200 => {
            let exchanges: Vec<ExchangeApiInfo> = resp
                .json()
                .await
                .map_err(|e| AppError::ManagementApiError(e.to_string()))?;
            Ok(exchanges
                .into_iter()
                .filter(|e| !e.internal && !e.name.starts_with("amq.") && !e.name.is_empty())
                .map(|e| ExchangeSummary { name: e.name, exchange_type: e.exchange_type })
                .collect())
        }
        401 => Err(AppError::ManagementApiAuthFailed),
        404 => Err(AppError::ManagementApiUnavailable(404)),
        other => Err(AppError::ManagementApiUnavailable(other)),
    }
}

/// Intermediate struct for deserializing exchange binding entries from the Management API.
#[derive(Deserialize)]
struct BindingApiInfo {
    routing_key: String,
}

/// Fetch routing keys from exchange bindings via the RabbitMQ Management API.
///
/// Returns deduplicated, non-empty routing key strings for a named exchange.
/// Used by the frontend combobox (PUBL-01).
///
/// Errors are intentionally NOT discriminated — the frontend silently falls back to
/// plain Input on ANY error (D-10). Auth errors (401) are returned as AppError but
/// the frontend catches all errors identically.
#[tauri::command]
pub async fn fetch_bindings(
    app: AppHandle,
    profile_name: String,
    exchange_name: String,
) -> Result<Vec<String>, AppError> {
    let (profile, password) = load_profile_with_password(&app, &profile_name)?;

    let encoded_vhost = percent_encoding::utf8_percent_encode(
        &profile.vhost,
        percent_encoding::NON_ALPHANUMERIC,
    );
    let encoded_exchange = percent_encoding::utf8_percent_encode(
        &exchange_name,
        percent_encoding::NON_ALPHANUMERIC,
    );
    let scheme = if profile.management_ssl { "https" } else { "http" };
    let url = format!(
        "{}://{}:{}/api/exchanges/{}/{}/bindings/source",
        scheme, profile.host, profile.management_port, encoded_vhost, encoded_exchange
    );

    let client = Client::new();
    let resp = client
        .get(&url)
        .basic_auth(&profile.username, Some(&password))
        .send()
        .await
        .map_err(|e| {
            if e.is_connect() {
                AppError::ManagementApiUnavailable(0)
            } else {
                AppError::ManagementApiError(e.to_string())
            }
        })?;

    match resp.status().as_u16() {
        200 => {
            let bindings: Vec<BindingApiInfo> = resp
                .json()
                .await
                .map_err(|e| AppError::ManagementApiError(e.to_string()))?;
            // Filter empty keys (default-exchange bindings have empty routing_key).
            // sort() MUST precede dedup() in Rust — dedup only removes consecutive duplicates.
            let mut keys: Vec<String> = bindings
                .into_iter()
                .map(|b| b.routing_key)
                .filter(|k| !k.is_empty())
                .collect();
            keys.sort();
            keys.dedup();
            Ok(keys)
        }
        401 => Err(AppError::ManagementApiAuthFailed),
        404 => Err(AppError::ManagementApiUnavailable(404)),
        other => Err(AppError::ManagementApiUnavailable(other)),
    }
}
