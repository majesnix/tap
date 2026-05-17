use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use crate::error::AppError;
use crate::profiles::{
    delete_password, store_password, ConnectionProfile, PROFILES_STORE_KEY,
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
