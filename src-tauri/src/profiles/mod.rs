use keyring_core::Entry;
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

pub const KEYRING_SERVICE: &str = "dev.majesnix.tap";
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
    #[serde(default)]
    pub management_ssl: bool,
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

/// Build a percent-encoded AMQP URI.
/// SECURITY: The returned String contains the cleartext password — use immediately,
/// do NOT store in any field, log file, or tracing output. Drop after use.
pub fn build_amqp_uri(host: &str, port: u16, vhost: &str, user: &str, pass: &str) -> String {
    let enc_vhost = utf8_percent_encode(vhost, NON_ALPHANUMERIC);
    let enc_user = utf8_percent_encode(user, NON_ALPHANUMERIC);
    let enc_pass = utf8_percent_encode(pass, NON_ALPHANUMERIC);
    // "/" vhost → "%2F"; "@" in password/username → "%40"
    format!("amqp://{}:{}@{}:{}/{}", enc_user, enc_pass, host, port, enc_vhost)
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
mod keychain_tests {
    use super::*;
    use std::sync::Once;

    static INIT: Once = Once::new();

    /// Install the in-memory mock keychain store once for the whole test process.
    fn init_mock_store() {
        INIT.call_once(|| {
            keyring_core::set_default_store(keyring_core::mock::Store::new().unwrap());
        });
    }

    #[test]
    fn store_get_delete_password_round_trip() {
        init_mock_store();
        let profile = "tap-test-profile-roundtrip";
        store_password(profile, "s3cret").unwrap();
        assert_eq!(get_password(profile).unwrap(), "s3cret");

        // Overwrite is allowed.
        store_password(profile, "rotated").unwrap();
        assert_eq!(get_password(profile).unwrap(), "rotated");

        delete_password(profile).unwrap();
        assert!(get_password(profile).is_err(), "password must be gone after delete");
    }

    #[test]
    fn get_password_missing_profile_errors() {
        init_mock_store();
        let err = get_password("tap-test-profile-never-stored").unwrap_err();
        assert!(matches!(err, AppError::KeyringError(_)), "got {err:?}");
    }
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
            management_ssl: false,
        };
        let json = serde_json::to_string(&profile).unwrap();
        assert!(!json.contains("password"), "password must never appear in serialized ConnectionProfile");
    }
}

#[cfg(test)]
mod uri_tests {
    use super::*;

    #[test]
    fn default_vhost_encodes_correctly() {
        let uri = build_amqp_uri("localhost", 5672, "/", "guest", "guest");
        assert!(uri.contains("%2F"), "default vhost '/' must become '%2F' in URI");
        let after_port = uri.split(':').last().unwrap_or("");
        assert!(!after_port.starts_with("5672//"), "unencoded '/' in path causes wrong vhost");
    }

    #[test]
    fn special_chars_in_password_encoded() {
        let uri = build_amqp_uri("localhost", 5672, "/", "user", "p@ss:w0rd#");
        assert!(!uri.contains("@p"), "bare '@' in password would break URI parsing");
    }

    #[test]
    fn special_chars_in_username_encoded() {
        let uri = build_amqp_uri("localhost", 5672, "/", "user@domain", "pass");
        assert!(!uri.contains("user@domain"), "bare '@' in username would break URI parsing");
        assert!(uri.contains("user%40domain"), "username must be percent-encoded");
    }
}
