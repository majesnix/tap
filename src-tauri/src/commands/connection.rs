use reqwest::Client;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::error::AppError;
use crate::profiles::{
    delete_password, get_password, store_password, AmqpEndpoint, ConnectionProfile,
    ManagementEndpoint, AMQP_CONNECT_TIMEOUT, PROFILES_STORE_KEY,
};

/// TCP connect budget for the Management API; a stalled port must not hang the UI.
const MANAGEMENT_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
/// Whole-request budget for one Management API call.
const MANAGEMENT_REQUEST_TIMEOUT: Duration = Duration::from_secs(15);

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
        .store("tap.json")
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
        .store("tap.json")
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
        .store("tap.json")
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
        .store("tap.json")
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
        .store("tap.json")
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
    let endpoint = AmqpEndpoint::from_profile(&profile)?;

    test_connection_core(&endpoint, password).await?;

    tracing::debug!("Connection test passed for profile: {}", profile_name);
    Ok(())
}

/// Pure async core for [`test_connection`]: connect, open a channel, close.
/// Decoupled from Tauri/keychain so it can be integration-tested against a live broker.
///
/// SECURITY: the `password` is moved in, used to build the URI in a tight scope, and
/// dropped before the connect attempt. Connect errors are sanitized — never propagate
/// the raw error (it may contain the cleartext URI).
pub(crate) async fn test_connection_core(
    endpoint: &AmqpEndpoint,
    password: String,
) -> Result<(), AppError> {
    let conn = endpoint.connect(password, AMQP_CONNECT_TIMEOUT, "Connection").await?;

    // Open a channel to verify credentials and vhost access
    conn.create_channel().await.map_err(|_| {
        AppError::AmqpError("Failed to open AMQP channel — check broker permissions".to_string())
    })?;

    // Close the connection — ephemeral pattern, no persistent state
    let _ = conn.close(0, "".into()).await;
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

/// One authenticated GET against the Management API, decoded as JSON.
///
/// Error disambiguation (CRITICAL — per Pitfall 7):
/// - connect error or timeout → ManagementApiUnavailable(0) — frontend shows Manual badge
/// - HTTP 401 → ManagementApiAuthFailed — surfaced as an error (NOT silent fallback)
/// - HTTP 404 → ManagementApiUnavailable(404) — plugin not enabled, silent fallback
/// - Other HTTP → ManagementApiUnavailable(status)
///
/// SECURITY: credentials go in the Authorization header via basic_auth, never in the URL.
/// The profile's CA bundle, if any, is added to the trust store for HTTPS.
async fn management_get<T: DeserializeOwned>(
    endpoint: &ManagementEndpoint,
    path: &str,
    password: &str,
) -> Result<T, AppError> {
    crate::profiles::ensure_crypto_provider();
    let mut builder = Client::builder()
        .connect_timeout(MANAGEMENT_CONNECT_TIMEOUT)
        .timeout(MANAGEMENT_REQUEST_TIMEOUT);
    if let Some(pem) = &endpoint.ca_cert_pem {
        let certs = reqwest::Certificate::from_pem_bundle(pem.as_bytes()).map_err(|e| {
            AppError::InvalidInput(format!("CA certificate is not a valid PEM bundle: {}", e))
        })?;
        for cert in certs {
            builder = builder.add_root_certificate(cert);
        }
    }
    let client = builder
        .build()
        .map_err(|e| AppError::ManagementApiError(e.to_string()))?;

    let url = format!("{}{}", endpoint.base_url(), path);
    let resp = client
        .get(&url)
        .basic_auth(&endpoint.username, Some(password))
        .send()
        .await
        .map_err(|e| {
            if e.is_connect() || e.is_timeout() {
                AppError::ManagementApiUnavailable(0) // port unreachable or stalled
            } else {
                AppError::ManagementApiError(e.to_string())
            }
        })?;

    match resp.status().as_u16() {
        200 => resp
            .json::<T>()
            .await
            .map_err(|e| AppError::ManagementApiError(e.to_string())),
        401 => Err(AppError::ManagementApiAuthFailed),
        404 => Err(AppError::ManagementApiUnavailable(404)),
        other => Err(AppError::ManagementApiUnavailable(other)),
    }
}

/// Fetch queue names from the RabbitMQ Management API for the profile's vhost.
#[tauri::command]
pub async fn fetch_queues(
    app: AppHandle,
    profile_name: String,
) -> Result<Vec<String>, AppError> {
    let (profile, password) = load_profile_with_password(&app, &profile_name)?;
    let endpoint = ManagementEndpoint::from_profile(&profile)?;
    fetch_queues_core(&endpoint, &password).await
}

/// Pure async core for [`fetch_queues`] — decoupled from Tauri/keychain for integration testing.
/// Requests only the `name` column: the default response carries dozens of fields per queue.
pub(crate) async fn fetch_queues_core(
    endpoint: &ManagementEndpoint,
    password: &str,
) -> Result<Vec<String>, AppError> {
    let path = format!("/api/queues/{}?columns=name", endpoint.encoded_vhost());
    let queues: Vec<QueueApiInfo> = management_get(endpoint, &path, password).await?;
    Ok(queues.into_iter().map(|q| q.name).collect())
}

/// Fetch the ready+unacknowledged message count for a single queue.
/// Returns u64 — callers treat None (Management API unavailable) as a silent no-op.
#[tauri::command]
pub async fn fetch_queue_depth(
    app: AppHandle,
    profile_name: String,
    queue_name: String,
) -> Result<u64, AppError> {
    let (profile, password) = load_profile_with_password(&app, &profile_name)?;
    let endpoint = ManagementEndpoint::from_profile(&profile)?;
    fetch_queue_depth_core(&endpoint, &password, &queue_name).await
}

/// Pure async core for [`fetch_queue_depth`] — decoupled from Tauri/keychain for integration testing.
pub(crate) async fn fetch_queue_depth_core(
    endpoint: &ManagementEndpoint,
    password: &str,
    queue_name: &str,
) -> Result<u64, AppError> {
    let encoded_queue =
        percent_encoding::utf8_percent_encode(queue_name, percent_encoding::NON_ALPHANUMERIC);
    let path = format!("/api/queues/{}/{}", endpoint.encoded_vhost(), encoded_queue);
    let info: QueueDepthApiInfo = management_get(endpoint, &path, password).await?;
    Ok(info.messages)
}

/// Fetch exchange names from the RabbitMQ Management API.
/// Filters out: internal exchanges, system exchanges (name starts with "amq."),
/// and the empty-name default exchange.
#[tauri::command]
pub async fn fetch_exchanges(
    app: AppHandle,
    profile_name: String,
) -> Result<Vec<ExchangeSummary>, AppError> {
    let (profile, password) = load_profile_with_password(&app, &profile_name)?;
    let endpoint = ManagementEndpoint::from_profile(&profile)?;
    fetch_exchanges_core(&endpoint, &password).await
}

/// Pure async core for [`fetch_exchanges`] — decoupled from Tauri/keychain for integration testing.
pub(crate) async fn fetch_exchanges_core(
    endpoint: &ManagementEndpoint,
    password: &str,
) -> Result<Vec<ExchangeSummary>, AppError> {
    let path = format!(
        "/api/exchanges/{}?columns=name,type,internal",
        endpoint.encoded_vhost()
    );
    let exchanges: Vec<ExchangeApiInfo> = management_get(endpoint, &path, password).await?;
    Ok(exchanges
        .into_iter()
        .filter(|e| !e.internal && !e.name.starts_with("amq.") && !e.name.is_empty())
        .map(|e| ExchangeSummary { name: e.name, exchange_type: e.exchange_type })
        .collect())
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
    let endpoint = ManagementEndpoint::from_profile(&profile)?;
    fetch_bindings_core(&endpoint, &password, &exchange_name).await
}

/// Pure async core for [`fetch_bindings`] — decoupled from Tauri/keychain for integration testing.
pub(crate) async fn fetch_bindings_core(
    endpoint: &ManagementEndpoint,
    password: &str,
    exchange_name: &str,
) -> Result<Vec<String>, AppError> {
    let encoded_exchange =
        percent_encoding::utf8_percent_encode(exchange_name, percent_encoding::NON_ALPHANUMERIC);
    let path = format!(
        "/api/exchanges/{}/{}/bindings/source?columns=routing_key",
        endpoint.encoded_vhost(),
        encoded_exchange
    );
    let bindings: Vec<BindingApiInfo> = management_get(endpoint, &path, password).await?;
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

// ─── Tests ─────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_connection_core_succeeds_against_live_broker() {
        let Some(b) = crate::test_support::broker_or_skip("test_connection_core_succeeds").await
        else {
            return;
        };
        let res = test_connection_core(&b.endpoint(), b.password.clone()).await;
        assert!(res.is_ok(), "expected successful connection, got {res:?}");
    }

    #[tokio::test]
    async fn test_connection_core_tls_against_plaintext_port_fails_cleanly() {
        let Some(b) = crate::test_support::broker_or_skip("test_connection_core_tls").await
        else {
            return;
        };
        let mut endpoint = b.endpoint();
        endpoint.tls = true;
        let err = test_connection_core(&endpoint, b.password.clone()).await.unwrap_err();
        assert!(matches!(err, AppError::AmqpError(_)), "got {err:?}");
        assert!(err.to_string().contains("TLS"), "message should mention TLS: {err}");
    }

    #[tokio::test]
    async fn test_connection_core_fails_on_bad_credentials() {
        let Some(b) = crate::test_support::broker_or_skip("test_connection_core_bad_creds").await
        else {
            return;
        };
        let res = test_connection_core(
            &AmqpEndpoint::plain(&b.host, b.port, &b.vhost, "wrong-user"),
            "wrong-pass".to_string(),
        )
        .await;
        assert!(res.is_err(), "bad credentials must fail");
    }

    #[tokio::test]
    async fn test_connection_core_fails_on_unreachable_host() {
        // No broker needed — port 1 is refused fast, exercising the connect-error arm.
        let res = test_connection_core(
            &AmqpEndpoint::plain("127.0.0.1", 1, "/", "dev"),
            "dev".to_string(),
        )
        .await;
        assert!(res.is_err(), "unreachable host must error");
    }

    // ── Management API cores (HTTP, port 15672) ──────────────────────────────────

    #[tokio::test]
    async fn fetch_queues_core_lists_predeclared_queues() {
        let Some(b) = crate::test_support::broker_or_skip("fetch_queues").await else { return };
        let queues = fetch_queues_core(&b.management_endpoint(), &b.password).await.unwrap();
        // definitions.json pre-declares these.
        assert!(queues.iter().any(|q| q == "test-queue"));
        assert!(queues.iter().any(|q| q == "proto-test"));
    }

    #[tokio::test]
    async fn fetch_queues_core_bad_credentials_is_auth_failed() {
        let Some(b) = crate::test_support::broker_or_skip("fetch_queues_401").await else { return };
        let err = fetch_queues_core(
            &ManagementEndpoint::plain(&b.host, b.management_port, &b.vhost, "wrong"),
            "wrong",
        )
        .await
        .unwrap_err();
        assert!(matches!(err, AppError::ManagementApiAuthFailed), "got {err:?}");
    }

    #[tokio::test]
    async fn fetch_queues_core_unreachable_is_unavailable_zero() {
        // No broker needed — connect failure maps to ManagementApiUnavailable(0).
        let err = fetch_queues_core(&ManagementEndpoint::plain("127.0.0.1", 1, "/", "dev"), "dev")
            .await
            .unwrap_err();
        assert!(matches!(err, AppError::ManagementApiUnavailable(0)), "got {err:?}");
    }

    #[tokio::test]
    async fn fetch_queue_depth_core_returns_count_for_existing_queue() {
        let Some(b) = crate::test_support::broker_or_skip("fetch_depth").await else { return };
        let depth = fetch_queue_depth_core(&b.management_endpoint(), &b.password, "proto-test")
            .await
            .unwrap();
        let _ = depth; // count varies; just assert the 200/parse path works
    }

    #[tokio::test]
    async fn fetch_queue_depth_core_missing_queue_is_404() {
        let Some(b) = crate::test_support::broker_or_skip("fetch_depth_404").await else { return };
        let err = fetch_queue_depth_core(
            &b.management_endpoint(),
            &b.password,
            "no-such-queue-zzz-404",
        )
        .await
        .unwrap_err();
        assert!(matches!(err, AppError::ManagementApiUnavailable(404)), "got {err:?}");
    }

    #[tokio::test]
    async fn fetch_exchanges_core_filters_system_exchanges() {
        let Some(b) = crate::test_support::broker_or_skip("fetch_exchanges").await else { return };
        let exchanges = fetch_exchanges_core(&b.management_endpoint(), &b.password)
            .await
            .unwrap();
        // User exchanges present; amq.* / internal / default ("") filtered out.
        assert!(exchanges.iter().any(|e| e.name == "test-direct"));
        assert!(exchanges.iter().all(|e| !e.name.starts_with("amq.")));
        assert!(exchanges.iter().all(|e| !e.name.is_empty()));
    }

    #[tokio::test]
    async fn fetch_bindings_core_returns_sorted_dedup_keys() {
        let Some(b) = crate::test_support::broker_or_skip("fetch_bindings").await else { return };
        // test-direct → test-queue with routing key "proto.test" (definitions.json).
        let keys = fetch_bindings_core(&b.management_endpoint(), &b.password, "test-direct")
            .await
            .unwrap();
        assert!(keys.contains(&"proto.test".to_string()));
        // Non-empty keys only, sorted+deduped (no consecutive dupes).
        assert!(keys.iter().all(|k| !k.is_empty()));
        let mut sorted = keys.clone();
        sorted.sort();
        assert_eq!(keys, sorted);
    }
}
