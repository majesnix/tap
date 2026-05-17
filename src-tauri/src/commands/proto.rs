use crate::error::AppError;
use crate::schema::{extractor, types::ProtoSchema};
use std::sync::Mutex;

#[tauri::command]
pub async fn parse_proto(
    file_path: String,
    include_paths: Vec<String>,
    pool_state: tauri::State<'_, Mutex<Option<prost_reflect::DescriptorPool>>>,
) -> Result<ProtoSchema, AppError> {
    let mut compiler = protox::Compiler::new(&include_paths)
        .map_err(|e| AppError::ParseError(e.to_string()))?;
    compiler.include_imports(true);
    compiler
        .open_file(&file_path)
        .map_err(|e| AppError::ParseError(e.to_string()))?;
    let fds = compiler.file_descriptor_set();
    let pool = prost_reflect::DescriptorPool::from_file_descriptor_set(fds)
        .map_err(|e| AppError::ParseError(e.to_string()))?;
    *pool_state.lock().unwrap() = Some(pool.clone());
    let schema = extractor::extract_schema(&pool);
    Ok(schema)
}
