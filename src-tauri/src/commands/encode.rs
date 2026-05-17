use crate::error::AppError;
use prost_reflect::prost::Message;
use prost_reflect::{DynamicMessage, FieldDescriptor, Kind, MessageDescriptor, Value};
use serde_json::Value as JsonValue;
use std::sync::Mutex;

#[tauri::command]
pub async fn encode_message(
    message_type: String,
    form_values: JsonValue,
    pool_state: tauri::State<'_, Mutex<Option<prost_reflect::DescriptorPool>>>,
) -> Result<Vec<u8>, AppError> {
    let pool_guard = pool_state.lock().unwrap();
    let pool = pool_guard.as_ref().ok_or_else(|| {
        AppError::EncodeError {
            field: "<root>".to_string(),
            message: "No proto file has been parsed yet".to_string(),
        }
    })?;

    let msg_desc = pool
        .get_message_by_name(&message_type)
        .ok_or_else(|| AppError::EncodeError {
            field: "<root>".to_string(),
            message: format!("Message type '{}' not found in pool", message_type),
        })?;

    let mut dyn_msg = DynamicMessage::new(msg_desc.clone());
    populate_message(&mut dyn_msg, &msg_desc, &form_values)?;

    let mut buf = Vec::new();
    dyn_msg
        .encode(&mut buf)
        .map_err(|e| AppError::EncodeError {
            field: "<root>".to_string(),
            message: e.to_string(),
        })?;

    Ok(buf)
}

fn populate_message(
    dyn_msg: &mut DynamicMessage,
    msg_desc: &MessageDescriptor,
    values: &JsonValue,
) -> Result<(), AppError> {
    let obj = match values.as_object() {
        Some(o) => o,
        None => return Ok(()),
    };

    // Track which oneof groups have been handled
    let mut handled_oneofs: std::collections::HashSet<String> = std::collections::HashSet::new();

    for field in msg_desc.fields() {
        // Check if this field belongs to a oneof
        if let Some(oneof) = field.containing_oneof() {
            let group_name = oneof.name().to_string();
            if handled_oneofs.contains(&group_name) {
                continue;
            }
            handled_oneofs.insert(group_name.clone());

            // The form stores oneof as { _selected: "branch_name", branch_name: value }
            if let Some(oneof_obj) = obj.get(&group_name).and_then(|v| v.as_object()) {
                let selected = oneof_obj
                    .get("_selected")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                if selected.is_empty() {
                    continue;
                }

                // Find the selected field in the oneof
                if let Some(selected_field) =
                    oneof.fields().find(|f| f.name() == selected)
                {
                    let branch_value = oneof_obj.get(selected).unwrap_or(&JsonValue::Null);
                    set_field_value(dyn_msg, &selected_field, branch_value)?;
                }
            }
        } else {
            // Regular field
            let field_name = field.name().to_string();
            let json_val = obj.get(&field_name).unwrap_or(&JsonValue::Null);
            set_field_value(dyn_msg, &field, json_val)?;
        }
    }

    Ok(())
}

fn set_field_value(
    dyn_msg: &mut DynamicMessage,
    field: &FieldDescriptor,
    json_val: &JsonValue,
) -> Result<(), AppError> {
    if json_val.is_null() {
        return Ok(());
    }

    if field.is_list() {
        let arr = match json_val.as_array() {
            Some(a) => a,
            None => return Ok(()),
        };

        let mut repeated_values: Vec<Value> = Vec::new();
        for item in arr {
            if let Some(val) = scalar_or_message_value(field, item)? {
                repeated_values.push(val);
            }
        }

        if !repeated_values.is_empty() {
            dyn_msg.set_field(field, Value::List(repeated_values));
        }
        return Ok(());
    }

    if let Some(val) = scalar_or_message_value(field, json_val)? {
        dyn_msg.set_field(field, val);
    }

    Ok(())
}

fn scalar_or_message_value(
    field: &FieldDescriptor,
    json_val: &JsonValue,
) -> Result<Option<Value>, AppError> {
    let result = match field.kind() {
        Kind::Bool => {
            let b = match json_val {
                JsonValue::Bool(b) => *b,
                JsonValue::String(s) => s == "true",
                _ => false,
            };
            Some(Value::Bool(b))
        }
        Kind::String => {
            let s = json_val.as_str().unwrap_or("").to_string();
            Some(Value::String(s))
        }
        Kind::Bytes => {
            let bytes = match json_val.as_str() {
                Some(s) => base64_decode_or_empty(s),
                None => vec![],
            };
            Some(Value::Bytes(bytes.into()))
        }
        Kind::Int32 | Kind::Sint32 | Kind::Sfixed32 => {
            let n = parse_i32(json_val).unwrap_or(0);
            Some(Value::I32(n))
        }
        Kind::Int64 | Kind::Sint64 | Kind::Sfixed64 => {
            let n = parse_i64(json_val).unwrap_or(0);
            Some(Value::I64(n))
        }
        Kind::Uint32 | Kind::Fixed32 => {
            let n = parse_u32(json_val).unwrap_or(0);
            Some(Value::U32(n))
        }
        Kind::Uint64 | Kind::Fixed64 => {
            let n = parse_u64(json_val).unwrap_or(0);
            Some(Value::U64(n))
        }
        Kind::Float => {
            let f = json_val
                .as_f64()
                .or_else(|| json_val.as_str().and_then(|s| s.parse::<f64>().ok()))
                .unwrap_or(0.0) as f32;
            Some(Value::F32(f))
        }
        Kind::Double => {
            let f = json_val
                .as_f64()
                .or_else(|| json_val.as_str().and_then(|s| s.parse::<f64>().ok()))
                .unwrap_or(0.0);
            Some(Value::F64(f))
        }
        Kind::Enum(enum_desc) => {
            let number = if let Some(n) = json_val.as_i64() {
                n as i32
            } else if let Some(s) = json_val.as_str() {
                enum_desc
                    .values()
                    .find(|v| v.name() == s)
                    .map(|v| v.number())
                    .unwrap_or(0)
            } else {
                0
            };
            if let Some(ev) = enum_desc.get_value(number) {
                Some(Value::EnumNumber(ev.number()))
            } else {
                Some(Value::EnumNumber(0))
            }
        }
        Kind::Message(msg_desc) => {
            let full_name = msg_desc.full_name();

            // Handle well-known types specially
            match full_name {
                "google.protobuf.Timestamp" => {
                    let secs = if let Some(s) = json_val.as_str() {
                        parse_datetime_to_epoch(s)
                    } else {
                        json_val.as_i64().unwrap_or(0)
                    };
                    let mut ts_msg = DynamicMessage::new(msg_desc.clone());
                    if let Some(secs_field) = msg_desc.get_field_by_name("seconds") {
                        ts_msg.set_field(&secs_field, Value::I64(secs));
                    }
                    if let Some(nanos_field) = msg_desc.get_field_by_name("nanos") {
                        ts_msg.set_field(&nanos_field, Value::I32(0));
                    }
                    Some(Value::Message(ts_msg))
                }
                "google.protobuf.Duration" => {
                    let secs = if let Some(s) = json_val.as_str() {
                        parse_duration_string(s)
                    } else {
                        json_val.as_i64().unwrap_or(0)
                    };
                    let mut dur_msg = DynamicMessage::new(msg_desc.clone());
                    if let Some(secs_field) = msg_desc.get_field_by_name("seconds") {
                        dur_msg.set_field(&secs_field, Value::I64(secs));
                    }
                    if let Some(nanos_field) = msg_desc.get_field_by_name("nanos") {
                        dur_msg.set_field(&nanos_field, Value::I32(0));
                    }
                    Some(Value::Message(dur_msg))
                }
                _ => {
                    // Nested message — recurse
                    let mut nested = DynamicMessage::new(msg_desc.clone());
                    populate_message(&mut nested, &msg_desc, json_val)?;
                    Some(Value::Message(nested))
                }
            }
        }
    };

    Ok(result)
}

fn parse_i32(v: &JsonValue) -> Option<i32> {
    v.as_i64()
        .map(|n| n as i32)
        .or_else(|| v.as_str().and_then(|s| s.parse::<i32>().ok()))
}

fn parse_i64(v: &JsonValue) -> Option<i64> {
    v.as_i64()
        .or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok()))
}

fn parse_u32(v: &JsonValue) -> Option<u32> {
    v.as_u64()
        .map(|n| n as u32)
        .or_else(|| v.as_str().and_then(|s| s.parse::<u32>().ok()))
}

fn parse_u64(v: &JsonValue) -> Option<u64> {
    v.as_u64()
        .or_else(|| v.as_str().and_then(|s| s.parse::<u64>().ok()))
}

/// Parse an ISO-8601 datetime string to Unix epoch seconds.
/// Falls back to 0 on parse failure.
fn parse_datetime_to_epoch(s: &str) -> i64 {
    // Try parsing as a plain integer first
    if let Ok(n) = s.parse::<i64>() {
        return n;
    }
    // Minimal ISO-8601 support: YYYY-MM-DDTHH:MM:SSZ
    // Use a simple calculation — no external date crate dependency
    if s.len() >= 19 {
        let year: i64 = s[0..4].parse().unwrap_or(1970);
        let month: i64 = s[5..7].parse().unwrap_or(1);
        let day: i64 = s[8..10].parse().unwrap_or(1);
        let hour: i64 = s[11..13].parse().unwrap_or(0);
        let min: i64 = s[14..16].parse().unwrap_or(0);
        let sec: i64 = s[17..19].parse().unwrap_or(0);

        // Days since epoch (approximate, ignores leap seconds)
        let y = year - 1970;
        let leap_days = (y / 4) - (y / 100) + (y / 400);
        let days_in_months: [i64; 12] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        let month_days: i64 = days_in_months[..((month - 1) as usize).min(12)]
            .iter()
            .sum();
        let total_days = y * 365 + leap_days + month_days + (day - 1);
        return total_days * 86400 + hour * 3600 + min * 60 + sec;
    }
    0
}

/// Parse a human-readable duration string to seconds.
/// Supports: "30s", "5m", "2h", "1d", plain integer strings.
fn parse_duration_string(s: &str) -> i64 {
    if let Ok(n) = s.parse::<i64>() {
        return n;
    }
    let s = s.trim();
    if s.ends_with('s') {
        s[..s.len() - 1].parse::<i64>().unwrap_or(0)
    } else if s.ends_with('m') {
        s[..s.len() - 1].parse::<i64>().unwrap_or(0) * 60
    } else if s.ends_with('h') {
        s[..s.len() - 1].parse::<i64>().unwrap_or(0) * 3600
    } else if s.ends_with('d') {
        s[..s.len() - 1].parse::<i64>().unwrap_or(0) * 86400
    } else {
        0
    }
}

/// Decode a base64 string to bytes. Returns empty vec on failure.
fn base64_decode_or_empty(s: &str) -> Vec<u8> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    STANDARD.decode(s).unwrap_or_default()
}

// ─── Unit Tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_pool_with_schema(proto_content: &str, file_name: &str) -> prost_reflect::DescriptorPool {
        // Write the proto content to a temp file
        let tmp_dir = std::env::temp_dir().join("proto_sender_tests");
        std::fs::create_dir_all(&tmp_dir).unwrap();
        let proto_path = tmp_dir.join(file_name);
        std::fs::write(&proto_path, proto_content).unwrap();

        let mut compiler =
            protox::Compiler::new(&[tmp_dir.to_str().unwrap()]).unwrap();
        compiler.include_imports(true);
        compiler.open_file(proto_path.to_str().unwrap()).unwrap();
        let fds = compiler.file_descriptor_set();
        prost_reflect::DescriptorPool::from_file_descriptor_set(fds).unwrap()
    }

    #[test]
    fn test_encode_scalar_flat_message() {
        let pool = make_pool_with_schema(
            r#"syntax = "proto3"; message Flat { string name = 1; int32 age = 2; bool active = 3; }"#,
            "flat.proto",
        );
        let msg_desc = pool.get_message_by_name("Flat").unwrap();
        let mut dyn_msg = DynamicMessage::new(msg_desc.clone());
        let values = serde_json::json!({ "name": "Alice", "age": 30, "active": true });
        populate_message(&mut dyn_msg, &msg_desc, &values).unwrap();

        let mut buf = Vec::new();
        dyn_msg.encode(&mut buf).unwrap();
        assert!(!buf.is_empty(), "encoded bytes should not be empty");
    }

    #[test]
    fn test_i64_string_parsing() {
        // i64 fields can arrive as JSON strings (JS loses precision on large ints)
        let pool = make_pool_with_schema(
            r#"syntax = "proto3"; message WithInt64 { int64 trace_id = 1; }"#,
            "int64.proto",
        );
        let msg_desc = pool.get_message_by_name("WithInt64").unwrap();
        let mut dyn_msg = DynamicMessage::new(msg_desc.clone());
        let values = serde_json::json!({ "trace_id": "9007199254740993" });
        populate_message(&mut dyn_msg, &msg_desc, &values).unwrap();

        let mut buf = Vec::new();
        dyn_msg.encode(&mut buf).unwrap();
        assert!(!buf.is_empty());
    }

    #[test]
    fn test_nested_message_encoding() {
        let pool = make_pool_with_schema(
            r#"syntax = "proto3";
               message Address { string city = 1; string zip = 2; }
               message Person { string name = 1; Address address = 2; }"#,
            "nested.proto",
        );
        let msg_desc = pool.get_message_by_name("Person").unwrap();
        let mut dyn_msg = DynamicMessage::new(msg_desc.clone());
        let values = serde_json::json!({
            "name": "Bob",
            "address": { "city": "Berlin", "zip": "10115" }
        });
        populate_message(&mut dyn_msg, &msg_desc, &values).unwrap();

        let mut buf = Vec::new();
        dyn_msg.encode(&mut buf).unwrap();
        assert!(!buf.is_empty());
    }

    #[test]
    fn test_oneof_group_encoding() {
        let pool = make_pool_with_schema(
            r#"syntax = "proto3";
               message Notification {
                 oneof content { string text = 1; bytes data = 2; }
               }"#,
            "oneof.proto",
        );
        let msg_desc = pool.get_message_by_name("Notification").unwrap();
        let mut dyn_msg = DynamicMessage::new(msg_desc.clone());
        // oneof form value convention: { _selected: "text", text: "hello" }
        let values = serde_json::json!({
            "content": { "_selected": "text", "text": "hello world" }
        });
        populate_message(&mut dyn_msg, &msg_desc, &values).unwrap();

        let mut buf = Vec::new();
        dyn_msg.encode(&mut buf).unwrap();
        assert!(!buf.is_empty());
    }

    #[test]
    fn test_duration_string_parsing() {
        assert_eq!(parse_duration_string("30s"), 30);
        assert_eq!(parse_duration_string("5m"), 300);
        assert_eq!(parse_duration_string("2h"), 7200);
        assert_eq!(parse_duration_string("1d"), 86400);
        assert_eq!(parse_duration_string("120"), 120);
        assert_eq!(parse_duration_string("invalid"), 0);
    }
}
