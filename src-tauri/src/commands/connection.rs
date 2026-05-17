use lapin::{Connection, ConnectionProperties};
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::error::AppError;
use crate::profiles::{
    build_amqp_uri, delete_password, get_password, store_password, ConnectionProfile,
    PROFILES_STORE_KEY,
};

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
    store.set(PROFILES_STORE_KEY, serde_json::to_value(&profiles).unwrap());
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

    store.set(PROFILES_STORE_KEY, serde_json::to_value(&profiles).unwrap());
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
