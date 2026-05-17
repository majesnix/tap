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
    #[error("Management API authentication failed")]
    ManagementApiAuthFailed,
    #[error("Profile not found: {0}")]
    ProfileNotFound(String),
    #[error("Store error: {0}")]
    StoreError(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
