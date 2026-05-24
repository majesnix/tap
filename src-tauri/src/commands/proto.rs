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
    // Build a fresh pool from just this file (for schema extraction).
    let new_pool = prost_reflect::DescriptorPool::from_file_descriptor_set(compiler.file_descriptor_set())
        .map_err(|e| AppError::ParseError(e.to_string()))?;
    let schema = extractor::extract_schema(&new_pool);

    // Merge new descriptors into the global pool so all loaded files stay
    // available for encoding. Skip files already present by name — handles
    // shared imports (e.g. google/protobuf/timestamp.proto) across multiple
    // loaded files. Re-loading a changed .proto won't update pool types;
    // restart the app if you change a .proto during a session.
    let fds_for_merge = compiler.file_descriptor_set();
    let mut guard = pool_state.lock().unwrap();
    match guard.as_mut() {
        None => {
            *guard = Some(new_pool);
        }
        Some(existing) => {
            for file_proto in fds_for_merge.file {
                let name = file_proto.name().to_string();
                if existing.get_file_by_name(&name).is_none() {
                    existing
                        .add_file_descriptor_proto(file_proto)
                        .map_err(|e| AppError::ParseError(e.to_string()))?;
                }
            }
        }
    }

    Ok(schema)
}
