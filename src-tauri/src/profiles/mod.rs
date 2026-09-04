use keyring_core::Entry;
use lapin::tcp::OwnedTLSConfig;
use lapin::types::LongString;
use lapin::{Connection, ConnectionProperties, DefaultConnectionBuilder};
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use serde::{Deserialize, Serialize};
use std::time::Duration;

use crate::error::AppError;

/// Upper bound for opening an AMQP connection (TCP + TLS + AMQP handshake).
pub const AMQP_CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

/// Install the process-wide rustls crypto provider exactly once.
///
/// Two providers end up compiled in: reqwest enables `aws-lc-rs`, and the TLS
/// certificate verifier pulls `ring`. With both present rustls panics at the first
/// handshake ("Could not automatically determine the process-level CryptoProvider"),
/// which killed lapin's I/O thread as soon as an `amqps://` connection was attempted.
/// Calling this before any TLS use, from the app and from tests, removes the ambiguity.
pub fn ensure_crypto_provider() {
    static INSTALL: std::sync::Once = std::sync::Once::new();
    INSTALL.call_once(|| {
        // Err means another component installed a provider first; that is fine.
        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
    });
}

pub const KEYRING_SERVICE: &str = "dev.majesnix.tap";
pub const PROFILES_STORE_KEY: &str = "connection-profiles";

static KEYRING_SERVICE_OVERRIDE: std::sync::OnceLock<String> = std::sync::OnceLock::new();

/// Keychain service name used for all entries.
pub fn keyring_service() -> &'static str {
    KEYRING_SERVICE_OVERRIDE
        .get()
        .map(String::as_str)
        .unwrap_or(KEYRING_SERVICE)
}

/// Development builds (bundle identifier ending in ".dev", see tauri.dev.conf.json) get
/// their own keychain namespace so they never read or overwrite the installed app's secrets.
pub fn keyring_service_for_identifier(identifier: &str) -> String {
    if identifier.ends_with(".dev") {
        format!("{}.dev", KEYRING_SERVICE)
    } else {
        KEYRING_SERVICE.to_string()
    }
}

/// Select the keychain service once at startup; later calls are ignored.
pub fn set_keyring_service(service: String) {
    let _ = KEYRING_SERVICE_OVERRIDE.set(service);
}

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
    /// Connect with `amqps://` (TLS). Profiles saved before this field existed default to plain AMQP.
    #[serde(default)]
    pub amqp_tls: bool,
    /// Optional PEM bundle the broker certificate must chain to (internal PKI).
    /// Applies to both the AMQP and the Management API connection.
    #[serde(default)]
    pub ca_cert_path: Option<String>,
    /// "local" | "shared" | "production". Interpreted by the frontend; stored verbatim.
    #[serde(default)]
    pub environment: Option<String>,
    /// Read-only profiles may list and inspect but never publish, consume, subscribe or run plans.
    /// The frontend hides those actions; this flag is also enforced in every command.
    #[serde(default)]
    pub read_only: bool,
    /// Keep sent messages in the local history (frontend concern; stored here, default true).
    #[serde(default = "default_true")]
    pub record_history: bool,
}

fn default_true() -> bool {
    true
}

/// Validate a profile at the command boundary: the form checks too, but the command
/// must not trust its caller.
pub fn validate_profile(profile: &ConnectionProfile) -> Result<(), AppError> {
    if profile.name.trim().is_empty() {
        return Err(AppError::InvalidInput("Profile name must not be empty".to_string()));
    }
    let host = profile.host.trim();
    if host.is_empty() {
        return Err(AppError::InvalidInput("Host must not be empty".to_string()));
    }
    if host
        .chars()
        .any(|c| c.is_whitespace() || matches!(c, '/' | '@' | '?' | '#'))
    {
        return Err(AppError::InvalidInput(format!(
            "Host '{}' must be a bare host name or IP address, without paths, credentials or spaces",
            host
        )));
    }
    if host.contains(':') {
        let bare = host.trim_start_matches('[').trim_end_matches(']');
        if bare.parse::<std::net::Ipv6Addr>().is_err() {
            return Err(AppError::InvalidInput(format!(
                "Host '{}' looks like an IPv6 address but does not parse as one",
                host
            )));
        }
    }
    if profile.port == 0 {
        return Err(AppError::InvalidInput("AMQP port must be between 1 and 65535".to_string()));
    }
    if profile.management_port == 0 {
        return Err(AppError::InvalidInput(
            "Management API port must be between 1 and 65535".to_string(),
        ));
    }
    Ok(())
}

/// A host as it must appear inside a URI: IPv6 literals need brackets.
pub(crate) fn uri_host(host: &str) -> String {
    let host = host.trim();
    if host.contains(':') && !host.starts_with('[') {
        format!("[{}]", host)
    } else {
        host.to_string()
    }
}

/// Refuse mutating broker operations for read-only profiles (defense in depth: the
/// frontend disables the buttons, the commands still check).
pub fn ensure_writable(profile: &ConnectionProfile) -> Result<(), AppError> {
    if profile.read_only {
        return Err(AppError::InvalidInput(format!(
            "Profile '{}' is read-only: sending, consuming, subscribing and plan runs are disabled",
            profile.name
        )));
    }
    Ok(())
}

/// Everything needed to reach one broker over AMQP, minus the password.
///
/// Built from a [`ConnectionProfile`] once per command so that the CA bundle is
/// read from disk (and validated) before any credential is touched.
#[derive(Debug, Clone)]
pub struct AmqpEndpoint {
    pub host: String,
    pub port: u16,
    pub vhost: String,
    pub username: String,
    pub tls: bool,
    /// PEM text of the CA bundle, if the profile names one.
    pub ca_cert_pem: Option<String>,
}

impl AmqpEndpoint {
    /// Resolve a profile into an endpoint, loading the CA bundle if configured.
    pub fn from_profile(profile: &ConnectionProfile) -> Result<Self, AppError> {
        let ca_cert_pem = match profile.ca_cert_path.as_deref().map(str::trim) {
            Some(path) if !path.is_empty() => Some(read_ca_bundle(path)?),
            _ => None,
        };
        Ok(Self {
            host: profile.host.clone(),
            port: profile.port,
            vhost: profile.vhost.clone(),
            username: profile.username.clone(),
            tls: profile.amqp_tls,
            ca_cert_pem,
        })
    }

    /// Plain-AMQP endpoint without TLS or CA bundle (test helper).
    #[cfg(test)]
    pub fn plain(host: &str, port: u16, vhost: &str, username: &str) -> Self {
        Self {
            host: host.to_string(),
            port,
            vhost: vhost.to_string(),
            username: username.to_string(),
            tls: false,
            ca_cert_pem: None,
        }
    }

    /// Percent-encoded AMQP URI for this endpoint.
    /// SECURITY: contains the cleartext password; build in a tight scope and drop after use.
    pub fn uri(&self, password: &str) -> String {
        build_amqp_uri(&self.host, self.port, &self.vhost, &self.username, password, self.tls)
    }

    /// Open a connection using this endpoint's TLS settings, bounded by `timeout`.
    ///
    /// `purpose` prefixes the timeout message ("Publish connection timed out").
    ///
    /// SECURITY: the password is consumed here. The URI exists only inside this
    /// function, and connect errors are replaced with fixed messages so neither
    /// the URI nor the password can reach an `AppError` sent to the frontend.
    pub async fn connect(
        &self,
        password: String,
        timeout: Duration,
        purpose: &str,
    ) -> Result<Connection, AppError> {
        ensure_crypto_provider();
        let uri = self.uri(&password);
        drop(password);
        let properties = ConnectionProperties::default()
            .with_connection_name(LongString::from(connection_name().into_bytes()));
        let tls = OwnedTLSConfig {
            identity: None,
            cert_chain: self.ca_cert_pem.clone(),
        };
        let builder = DefaultConnectionBuilder::new()
            .map_err(|e| AppError::AmqpError(format!("AMQP runtime unavailable: {}", e)))?
            .with_uri_str(uri)
            .with_properties(properties)
            .with_tls_config(tls);
        let result = tokio::time::timeout(timeout, builder.connect()).await;
        result
            .map_err(|_| {
                AppError::AmqpError(format!(
                    "{} connection timed out ({}s)",
                    purpose,
                    timeout.as_secs()
                ))
            })?
            .map_err(|_| AppError::AmqpError(self.connect_failed_message()))
    }

    fn connect_failed_message(&self) -> String {
        if self.tls {
            "AMQP TLS connection failed — check host, port, certificate trust (CA bundle), vhost, and credentials"
                .to_string()
        } else {
            "AMQP connection failed — check host, port, vhost, and credentials".to_string()
        }
    }
}

/// Everything needed to reach the RabbitMQ Management API for one profile, minus the password.
#[derive(Debug, Clone)]
pub struct ManagementEndpoint {
    pub host: String,
    pub port: u16,
    pub ssl: bool,
    pub vhost: String,
    pub username: String,
    /// PEM text of the CA bundle, if the profile names one.
    pub ca_cert_pem: Option<String>,
}

impl ManagementEndpoint {
    /// Resolve a profile into a Management API endpoint, loading the CA bundle if configured.
    pub fn from_profile(profile: &ConnectionProfile) -> Result<Self, AppError> {
        let ca_cert_pem = match profile.ca_cert_path.as_deref().map(str::trim) {
            Some(path) if !path.is_empty() => Some(read_ca_bundle(path)?),
            _ => None,
        };
        Ok(Self {
            host: profile.host.clone(),
            port: profile.management_port,
            ssl: profile.management_ssl,
            vhost: profile.vhost.clone(),
            username: profile.username.clone(),
            ca_cert_pem,
        })
    }

    /// Plain-HTTP endpoint without a CA bundle (test helper).
    #[cfg(test)]
    pub fn plain(host: &str, port: u16, vhost: &str, username: &str) -> Self {
        Self {
            host: host.to_string(),
            port,
            ssl: false,
            vhost: vhost.to_string(),
            username: username.to_string(),
            ca_cert_pem: None,
        }
    }

    /// `http(s)://host:port` — no credentials, those travel in the Authorization header.
    pub fn base_url(&self) -> String {
        let scheme = if self.ssl { "https" } else { "http" };
        format!("{}://{}:{}", scheme, uri_host(&self.host), self.port)
    }

    /// Percent-encoded vhost for use in Management API paths (`/` becomes `%2F`).
    pub fn encoded_vhost(&self) -> String {
        utf8_percent_encode(&self.vhost, NON_ALPHANUMERIC).to_string()
    }
}

/// Connection name shown in the RabbitMQ management UI: `tap/<os user>`.
/// Lets operators tell whose Tap holds a connection or consumer on a shared broker.
pub fn connection_name() -> String {
    format!("tap/{}", current_user())
}

/// Unique consumer tag carrying the tool, its role and the developer: `tap:<role>:<user>:<id>`.
pub fn consumer_tag(role: &str) -> String {
    let id = uuid::Uuid::new_v4().simple().to_string();
    format!("tap:{}:{}:{}", role, current_user(), &id[..8])
}

fn current_user() -> String {
    std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_else(|_| "unknown".to_string())
}

/// Read a PEM CA bundle and make sure it actually holds a certificate, so a typo
/// in the path or the wrong file surfaces at save time rather than as an opaque
/// TLS handshake failure later.
fn read_ca_bundle(path: &str) -> Result<String, AppError> {
    let pem = std::fs::read_to_string(path).map_err(|e| {
        AppError::InvalidInput(format!("Cannot read CA certificate '{}': {}", path, e))
    })?;
    if !pem.contains("-----BEGIN CERTIFICATE-----") {
        return Err(AppError::InvalidInput(format!(
            "CA certificate '{}' does not contain a PEM certificate block",
            path
        )));
    }
    Ok(pem)
}

/// Store the password in the OS keychain. Service = KEYRING_SERVICE, username = profile name.
/// SECURITY: never log the password or the profile name alongside it in tracing.
pub fn store_password(profile_name: &str, password: &str) -> Result<(), AppError> {
    let entry = Entry::new(keyring_service(), profile_name)
        .map_err(|e| AppError::KeyringError(e.to_string()))?;
    entry
        .set_password(password)
        .map_err(|e| AppError::KeyringError(e.to_string()))?;
    Ok(())
}

/// Retrieve the password from the OS keychain.
/// SECURITY: the returned String is cleartext — use immediately, do not store in any struct or log.
pub fn get_password(profile_name: &str) -> Result<String, AppError> {
    let entry = Entry::new(keyring_service(), profile_name)
        .map_err(|e| AppError::KeyringError(e.to_string()))?;
    entry
        .get_password()
        .map_err(|e| AppError::KeyringError(e.to_string()))
}

/// Build a percent-encoded AMQP URI.
/// SECURITY: The returned String contains the cleartext password — use immediately,
/// do NOT store in any field, log file, or tracing output. Drop after use.
pub fn build_amqp_uri(
    host: &str,
    port: u16,
    vhost: &str,
    user: &str,
    pass: &str,
    tls: bool,
) -> String {
    let enc_vhost = utf8_percent_encode(vhost, NON_ALPHANUMERIC);
    let enc_user = utf8_percent_encode(user, NON_ALPHANUMERIC);
    let enc_pass = utf8_percent_encode(pass, NON_ALPHANUMERIC);
    let scheme = if tls { "amqps" } else { "amqp" };
    // "/" vhost → "%2F"; "@" in password/username → "%40"; IPv6 hosts get brackets
    format!(
        "{}://{}:{}@{}:{}/{}",
        scheme,
        enc_user,
        enc_pass,
        uri_host(host),
        port,
        enc_vhost
    )
}

/// Delete the password from the OS keychain. Called on profile delete.
pub fn delete_password(profile_name: &str) -> Result<(), AppError> {
    let entry = Entry::new(keyring_service(), profile_name)
        .map_err(|e| AppError::KeyringError(e.to_string()))?;
    // keyring-core 1.x uses delete_credential (not delete_password from v3).
    // A profile whose secret is already gone is not an error worth stopping for.
    match entry.delete_credential() {
        Ok(()) | Err(keyring_core::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::KeyringError(e.to_string())),
    }
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
    fn deleting_a_missing_password_is_not_an_error() {
        init_mock_store();
        assert!(delete_password("tap-test-profile-never-stored-delete").is_ok());
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
            amqp_tls: false,
            ca_cert_path: None,
            environment: None,
            read_only: false,
            record_history: true,
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
        let uri = build_amqp_uri("localhost", 5672, "/", "guest", "guest", false);
        assert!(uri.contains("%2F"), "default vhost '/' must become '%2F' in URI");
        let after_port = uri.split(':').next_back().unwrap_or("");
        assert!(!after_port.starts_with("5672//"), "unencoded '/' in path causes wrong vhost");
    }

    #[test]
    fn special_chars_in_password_encoded() {
        let uri = build_amqp_uri("localhost", 5672, "/", "user", "p@ss:w0rd#", false);
        assert!(!uri.contains("@p"), "bare '@' in password would break URI parsing");
    }

    #[test]
    fn ipv6_hosts_are_bracketed_in_uris_and_urls() {
        let uri = build_amqp_uri("::1", 5672, "/", "u", "p", false);
        assert_eq!(uri, "amqp://u:p@[::1]:5672/%2F");
        let already = build_amqp_uri("[::1]", 5672, "/", "u", "p", true);
        assert_eq!(already, "amqps://u:p@[::1]:5672/%2F");
        assert_eq!(ManagementEndpoint::plain("::1", 15672, "/", "u").base_url(), "http://[::1]:15672");
        assert_eq!(ManagementEndpoint::plain("localhost", 15672, "/", "u").base_url(), "http://localhost:15672");
    }

    #[test]
    fn validate_profile_rejects_unusable_names_hosts_and_ports() {
        let ok = ConnectionProfile {
            name: "dev".into(),
            host: "rabbit.example.internal".into(),
            port: 5672,
            vhost: "/".into(),
            username: "u".into(),
            management_port: 15672,
            management_ssl: false,
            amqp_tls: false,
            ca_cert_path: None,
            environment: None,
            read_only: false,
            record_history: true,
        };
        assert!(validate_profile(&ok).is_ok());
        for host in ["localhost", "10.0.0.5", "::1", "[fe80::1]", "broker-1.example.com"] {
            let p = ConnectionProfile { host: host.into(), ..ok.clone() };
            assert!(validate_profile(&p).is_ok(), "host {host} should be accepted");
        }
        for host in ["", "  ", "host/with/path", "user@host", "host?x=1", "host#frag", "two words"] {
            let p = ConnectionProfile { host: host.into(), ..ok.clone() };
            assert!(matches!(validate_profile(&p), Err(AppError::InvalidInput(_))), "host {host:?} should be rejected");
        }
        let unnamed = ConnectionProfile { name: "   ".into(), ..ok.clone() };
        assert!(matches!(validate_profile(&unnamed), Err(AppError::InvalidInput(_))));
        let no_port = ConnectionProfile { port: 0, ..ok.clone() };
        assert!(matches!(validate_profile(&no_port), Err(AppError::InvalidInput(_))));
        let no_mgmt_port = ConnectionProfile { management_port: 0, ..ok.clone() };
        assert!(matches!(validate_profile(&no_mgmt_port), Err(AppError::InvalidInput(_))));
    }

    #[test]
    fn special_chars_in_username_encoded() {
        let uri = build_amqp_uri("localhost", 5672, "/", "user@domain", "pass", false);
        assert!(!uri.contains("user@domain"), "bare '@' in username would break URI parsing");
        assert!(uri.contains("user%40domain"), "username must be percent-encoded");
    }
}

#[cfg(test)]
mod endpoint_tests {
    use super::*;

    fn profile(tls: bool, ca: Option<&str>) -> ConnectionProfile {
        ConnectionProfile {
            name: "p".into(),
            host: "broker.example.internal".into(),
            port: if tls { 5671 } else { 5672 },
            vhost: "/".into(),
            username: "user".into(),
            management_port: 15672,
            management_ssl: false,
            amqp_tls: tls,
            ca_cert_path: ca.map(|s| s.to_string()),
            environment: None,
            read_only: false,
            record_history: true,
        }
    }

    #[test]
    fn uri_uses_amqps_when_tls_is_on() {
        let ep = AmqpEndpoint::from_profile(&profile(true, None)).unwrap();
        let uri = ep.uri("pw");
        assert!(uri.starts_with("amqps://"), "got {uri}");
        assert!(uri.ends_with("@broker.example.internal:5671/%2F"), "got {uri}");
    }

    #[test]
    fn uri_uses_plain_amqp_without_tls() {
        let ep = AmqpEndpoint::from_profile(&profile(false, None)).unwrap();
        assert!(ep.uri("pw").starts_with("amqp://"));
        assert!(ep.ca_cert_pem.is_none());
    }

    #[test]
    fn missing_ca_file_is_reported_as_invalid_input() {
        let err = AmqpEndpoint::from_profile(&profile(true, Some("/no/such/dir/ca.pem"))).unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)), "got {err:?}");
        assert!(err.to_string().contains("ca.pem"), "message should name the file: {err}");
    }

    #[test]
    fn ca_file_contents_are_loaded_as_pem() {
        let dir = std::env::temp_dir().join("tap_endpoint_tests");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("ca.pem");
        let pem = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n";
        std::fs::write(&path, pem).unwrap();
        let ep = AmqpEndpoint::from_profile(&profile(true, path.to_str())).unwrap();
        assert_eq!(ep.ca_cert_pem.as_deref(), Some(pem));
    }

    #[test]
    fn ca_file_without_a_certificate_block_is_rejected() {
        let dir = std::env::temp_dir().join("tap_endpoint_tests");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("not-a-cert.txt");
        std::fs::write(&path, "hello").unwrap();
        let err = AmqpEndpoint::from_profile(&profile(true, path.to_str())).unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)), "got {err:?}");
    }

    #[test]
    fn profiles_saved_before_tls_support_still_deserialize() {
        let json = r#"{"name":"a","host":"h","port":5672,"vhost":"/","username":"u","management_port":15672}"#;
        let p: ConnectionProfile = serde_json::from_str(json).unwrap();
        assert!(!p.amqp_tls);
        assert!(p.ca_cert_path.is_none());
        assert!(!p.management_ssl);
    }

    #[test]
    fn dev_identifiers_get_their_own_keyring_namespace() {
        assert_eq!(keyring_service_for_identifier("com.tap.app"), KEYRING_SERVICE);
        assert_eq!(keyring_service_for_identifier("com.tap.dev"), format!("{}.dev", KEYRING_SERVICE));
    }

    #[test]
    fn connection_name_and_consumer_tag_identify_tap_and_role() {
        assert!(connection_name().starts_with("tap/"));
        let tag = consumer_tag("subscribe");
        assert!(tag.starts_with("tap:subscribe:"), "got {tag}");
        assert_ne!(tag, consumer_tag("subscribe"), "tags must be unique per consumer");
    }

    #[test]
    fn management_endpoint_builds_scheme_and_encodes_vhost() {
        let mut p = profile(false, None);
        p.management_ssl = true;
        p.management_port = 15671;
        let ep = ManagementEndpoint::from_profile(&p).unwrap();
        assert_eq!(ep.base_url(), "https://broker.example.internal:15671");
        assert_eq!(ep.encoded_vhost(), "%2F");
        assert_eq!(ManagementEndpoint::plain("h", 1, "/", "u").base_url(), "http://h:1");
    }

    #[test]
    fn plain_constructor_matches_from_profile() {
        let ep = AmqpEndpoint::plain("localhost", 5672, "/", "guest");
        assert_eq!(ep.uri("guest"), build_amqp_uri("localhost", 5672, "/", "guest", "guest", false));
    }
}

#[cfg(test)]
mod writable_tests {
    use super::*;

    fn profile(read_only: bool) -> ConnectionProfile {
        ConnectionProfile {
            name: "ops".into(),
            host: "h".into(),
            port: 5672,
            vhost: "/".into(),
            username: "u".into(),
            management_port: 15672,
            management_ssl: false,
            amqp_tls: false,
            ca_cert_path: None,
            environment: Some("production".into()),
            read_only,
            record_history: true,
        }
    }

    #[test]
    fn writable_profile_passes() {
        assert!(ensure_writable(&profile(false)).is_ok());
    }

    #[test]
    fn read_only_profile_is_refused_with_its_name() {
        let err = ensure_writable(&profile(true)).unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)), "got {err:?}");
        assert!(err.to_string().contains("ops"), "message should name the profile: {err}");
        assert!(err.to_string().contains("read-only"), "got {err}");
    }

    #[test]
    fn environment_and_read_only_default_when_absent() {
        let json = r#"{"name":"a","host":"h","port":5672,"vhost":"/","username":"u","management_port":15672}"#;
        let p: ConnectionProfile = serde_json::from_str(json).unwrap();
        assert!(p.environment.is_none());
        assert!(!p.read_only);
        assert!(p.record_history, "history recording defaults to on");
    }
}
