use crate::error::AppError;
use crate::schema::{extractor, types::ProtoSchema};
use std::sync::Mutex;

#[tauri::command]
pub async fn parse_proto(
    file_path: String,
    include_paths: Vec<String>,
    pool_state: tauri::State<'_, Mutex<Option<prost_reflect::DescriptorPool>>>,
) -> Result<ProtoSchema, AppError> {
    parse_proto_core(&file_path, &include_paths, &pool_state)
}

/// Pure core for [`parse_proto`]: compile one file, extract its schema, merge into the pool.
/// Decoupled from `tauri::State` so it can be unit-tested with a plain `Mutex`.
pub(crate) fn parse_proto_core(
    file_path: &str,
    include_paths: &[String],
    pool_state: &Mutex<Option<prost_reflect::DescriptorPool>>,
) -> Result<ProtoSchema, AppError> {
    let mut compiler = protox::Compiler::new(include_paths)
        .map_err(|e| AppError::ParseError(e.to_string()))?;
    compiler.include_imports(true);
    compiler
        .open_file(file_path)
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
    reload_proto_core(&file_paths, &include_paths, &pool_state)
}

/// Pure core for [`reload_proto`]: recompile a set of files into a fresh merged pool.
/// Decoupled from `tauri::State` so it can be unit-tested with a plain `Mutex`.
pub(crate) fn reload_proto_core(
    file_paths: &[String],
    include_paths: &[Vec<String>],
    pool_state: &Mutex<Option<prost_reflect::DescriptorPool>>,
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

#[cfg(test)]
mod tests {
    use super::*;

    fn write_proto(content: &str, file_name: &str) -> String {
        let tmp_dir = std::env::temp_dir().join("tap_proto_tests");
        std::fs::create_dir_all(&tmp_dir).unwrap();
        let path = tmp_dir.join(file_name);
        std::fs::write(&path, content).unwrap();
        path.to_str().unwrap().to_string()
    }

    fn dir_of(path: &str) -> String {
        std::path::Path::new(path)
            .parent()
            .unwrap()
            .to_str()
            .unwrap()
            .to_string()
    }

    #[test]
    fn parse_proto_core_extracts_schema_and_initializes_pool() {
        let path = write_proto(
            r#"syntax = "proto3"; message Widget { string name = 1; }"#,
            "widget.proto",
        );
        let pool = Mutex::new(None);

        let schema = parse_proto_core(&path, &[dir_of(&path)], &pool).unwrap();

        assert!(schema.messages.iter().any(|m| m.name == "Widget"));
        assert!(pool.lock().unwrap().is_some(), "pool should be initialized");
    }

    #[test]
    fn parse_proto_core_merges_into_existing_pool() {
        let a = write_proto(
            r#"syntax = "proto3"; message AAA { string a = 1; }"#,
            "merge_a.proto",
        );
        let b = write_proto(
            r#"syntax = "proto3"; message BBB { string b = 1; }"#,
            "merge_b.proto",
        );
        let pool = Mutex::new(None);

        parse_proto_core(&a, &[dir_of(&a)], &pool).unwrap();
        parse_proto_core(&b, &[dir_of(&b)], &pool).unwrap();

        let guard = pool.lock().unwrap();
        let p = guard.as_ref().unwrap();
        assert!(p.get_message_by_name("AAA").is_some());
        assert!(p.get_message_by_name("BBB").is_some());
    }

    #[test]
    fn parse_proto_core_invalid_file_returns_parse_error() {
        let path = write_proto("not valid proto", "bad.proto");
        let pool = Mutex::new(None);
        let err = parse_proto_core(&path, &[dir_of(&path)], &pool).unwrap_err();
        assert!(matches!(err, AppError::ParseError(_)), "got {err:?}");
    }

    #[test]
    fn reload_proto_core_returns_one_schema_per_file() {
        let a = write_proto(
            r#"syntax = "proto3"; message One { string a = 1; }"#,
            "reload_one.proto",
        );
        let b = write_proto(
            r#"syntax = "proto3"; message Two { string b = 1; }"#,
            "reload_two.proto",
        );
        let pool = Mutex::new(None);

        let schemas = reload_proto_core(
            &[a.clone(), b.clone()],
            &[vec![dir_of(&a)], vec![dir_of(&b)]],
            &pool,
        )
        .unwrap();

        assert_eq!(schemas.len(), 2, "one schema per input file (BUG-3)");
        let guard = pool.lock().unwrap();
        let p = guard.as_ref().unwrap();
        assert!(p.get_message_by_name("One").is_some());
        assert!(p.get_message_by_name("Two").is_some());
    }

    #[test]
    fn reload_proto_core_rejects_length_mismatch() {
        let pool = Mutex::new(None);
        let err = reload_proto_core(&["a.proto".into()], &[], &pool).unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)), "got {err:?}");
    }

    #[test]
    fn reload_proto_core_rejects_empty_input() {
        let pool = Mutex::new(None);
        let err = reload_proto_core(&[], &[], &pool).unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)), "got {err:?}");
    }

    #[tokio::test]
    async fn check_paths_exist_reports_existence() {
        let path = write_proto("syntax = \"proto3\";", "exists.proto");
        let result =
            check_paths_exist(vec![path, "/no/such/path/xyz.proto".to_string()]).await;
        assert_eq!(result, vec![true, false]);
    }
}
