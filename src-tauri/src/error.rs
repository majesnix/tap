use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Proto parse error: {0}")]
    ParseError(String),
    #[error("Encode error at field '{field}': {message}")]
    EncodeError { field: String, message: String },
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
