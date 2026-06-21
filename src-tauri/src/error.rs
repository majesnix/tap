use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Proto parse error: {0}")]
    ParseError(String),
    #[error("Encode error at field '{field}': {message}")]
    EncodeError { field: String, message: String },
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("AMQP error: {0}")]
    AmqpError(String),
    #[error("Keyring error: {0}")]
    KeyringError(String),
    #[error("Management API error: {0}")]
    ManagementApiError(String),
    #[error("Management API unavailable (HTTP {0})")]
    ManagementApiUnavailable(u16),
    // CRITICAL: This exact message is matched by frontend catch block substring "authentication failed"
    #[error("Management API authentication failed: wrong credentials (HTTP 401)")]
    ManagementApiAuthFailed,
    #[error("Profile not found: {0}")]
    ProfileNotFound(String),
    #[error("Store error: {0}")]
    StoreError(String),
    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_to_display_string() {
        let json = serde_json::to_string(&AppError::ParseError("boom".into())).unwrap();
        assert_eq!(json, "\"Proto parse error: boom\"");
    }

    #[test]
    fn management_api_unavailable_includes_status_code() {
        assert_eq!(
            AppError::ManagementApiUnavailable(404).to_string(),
            "Management API unavailable (HTTP 404)"
        );
    }
}
