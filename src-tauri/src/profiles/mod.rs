use keyring_core::Entry;
use serde::{Deserialize, Serialize};

use crate::error::AppError;

pub const KEYRING_SERVICE: &str = "dev.protosender.app";
pub const PROFILES_STORE_KEY: &str = "connection-profiles";

/// Non-secret connection profile fields stored in tauri-plugin-store JSON.
/// Password is NEVER included — it lives in the OS keychain only.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConnectionProfile {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub vhost: String,
    pub username: String,
    pub management_port: u16,
}

/// Store the password in the OS keychain. Service = KEYRING_SERVICE, username = profile name.
/// SECURITY: never log the password or the profile name alongside it in tracing.
pub fn store_password(profile_name: &str, password: &str) -> Result<(), AppError> {
    let entry = Entry::new(KEYRING_SERVICE, profile_name)
        .map_err(|e| AppError::KeyringError(e.to_string()))?;
    entry
        .set_password(password)
        .map_err(|e| AppError::KeyringError(e.to_string()))?;
    Ok(())
}

/// Retrieve the password from the OS keychain.
/// SECURITY: the returned String is cleartext — use immediately, do not store in any struct or log.
pub fn get_password(profile_name: &str) -> Result<String, AppError> {
    let entry = Entry::new(KEYRING_SERVICE, profile_name)
        .map_err(|e| AppError::KeyringError(e.to_string()))?;
    entry
        .get_password()
        .map_err(|e| AppError::KeyringError(e.to_string()))
}

/// Delete the password from the OS keychain. Called on profile delete.
pub fn delete_password(profile_name: &str) -> Result<(), AppError> {
    let entry = Entry::new(KEYRING_SERVICE, profile_name)
        .map_err(|e| AppError::KeyringError(e.to_string()))?;
    // keyring-core 1.x uses delete_credential (not delete_password from v3)
    entry
        .delete_credential()
        .map_err(|e| AppError::KeyringError(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn connection_profile_serializes_without_password() {
        let profile = ConnectionProfile {
            name: "test".to_string(),
            host: "localhost".to_string(),
            port: 5672,
            vhost: "/".to_string(),
            username: "guest".to_string(),
            management_port: 15672,
        };
        let json = serde_json::to_string(&profile).unwrap();
        assert!(!json.contains("password"), "password must never appear in serialized ConnectionProfile");
    }
}
