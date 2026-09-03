pub mod connection;
pub mod consume;
pub mod encode;
pub mod plan_runner;
pub mod proto;
pub mod publish;
pub mod subscribe;

use std::sync::{Mutex, MutexGuard};

use crate::error::AppError;

/// Lock managed state, turning a poisoned mutex into an error instead of a panic.
pub(crate) fn lock_state<T>(state: &Mutex<T>) -> Result<MutexGuard<'_, T>, AppError> {
    state.lock().map_err(|_| {
        AppError::InvalidInput("Internal state lock poisoned — restart the application".to_string())
    })
}
