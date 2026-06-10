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

#[tauri::command]
pub async fn reload_proto(
    file_paths: Vec<String>,
    include_paths: Vec<Vec<String>>,
    pool_state: tauri::State<'_, Mutex<Option<prost_reflect::DescriptorPool>>>,
) -> Result<Vec<ProtoSchema>, AppError> {
    if file_paths.len() != include_paths.len() {
        return Err(AppError::InvalidInput(
            "file_paths and include_paths must have the same length".into(),
        ));
    }
    if file_paths.is_empty() {
        return Err(AppError::InvalidInput("file_paths must not be empty".into()));
    }

    let mut merged_pool: Option<prost_reflect::DescriptorPool> = None;
    // BUG-3 fix: collect a schema per file (not just the first one)
    let mut schemas: Vec<ProtoSchema> = Vec::with_capacity(file_paths.len());

    for (i, file_path) in file_paths.iter().enumerate() {
        let mut compiler = protox::Compiler::new(&include_paths[i])
            .map_err(|e| AppError::ParseError(e.to_string()))?;
        compiler.include_imports(true);
        compiler
            .open_file(file_path)
            .map_err(|e| AppError::ParseError(e.to_string()))?;

        let pool = prost_reflect::DescriptorPool::from_file_descriptor_set(
            compiler.file_descriptor_set(),
        )
        .map_err(|e| AppError::ParseError(e.to_string()))?;

        // Push a schema for every file, not just the first
        schemas.push(extractor::extract_schema(&pool));

        match merged_pool.as_mut() {
            None => {
                merged_pool = Some(pool);
            }
            Some(existing) => {
                for file_proto in compiler.file_descriptor_set().file {
                    let name = file_proto.name().to_string();
                    if existing.get_file_by_name(&name).is_none() {
                        existing
                            .add_file_descriptor_proto(file_proto)
                            .map_err(|e| AppError::ParseError(e.to_string()))?;
                    }
                }
            }
        }
    }

    let mut guard = pool_state.lock().unwrap();
    *guard = merged_pool;

    Ok(schemas)
}

#[tauri::command]
pub async fn check_paths_exist(paths: Vec<String>) -> Vec<bool> {
    paths
        .iter()
        .map(|p| std::path::Path::new(p).exists())
        .collect()
}
