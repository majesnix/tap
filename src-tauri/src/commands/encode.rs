use crate::error::AppError;
use prost_reflect::prost::Message;
use prost_reflect::{DynamicMessage, FieldDescriptor, Kind, MapKey, MessageDescriptor, Value};
use serde_json::Value as JsonValue;
use std::sync::Mutex;

#[tauri::command]
pub async fn encode_message(
    message_type: String,
    form_values: JsonValue,
    pool_state: tauri::State<'_, Mutex<Option<prost_reflect::DescriptorPool>>>,
) -> Result<Vec<u8>, AppError> {
    let pool_guard = pool_state
        .lock()
        .map_err(|_| AppError::EncodeError {
            field: "<root>".to_string(),
            message: "Internal state lock poisoned — restart the application".to_string(),
        })?;
    let pool = pool_guard.as_ref().ok_or_else(|| AppError::EncodeError {
        field: "<root>".to_string(),
        message: "No proto file has been parsed yet".to_string(),
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

/// Encode a message using a pre-resolved pool reference.
/// Extracted so plan_runner can encode without going through the Tauri State
/// wrapper (which isn't Send across awaits).
pub fn encode_message_with_pool(
    pool: &prost_reflect::DescriptorPool,
    message_type: &str,
    form_values: &JsonValue,
) -> Result<Vec<u8>, AppError> {
    let msg_desc = pool
        .get_message_by_name(message_type)
        .ok_or_else(|| AppError::EncodeError {
            field: "<root>".to_string(),
            message: format!("Message type '{}' not found in pool", message_type),
        })?;

    let mut dyn_msg = DynamicMessage::new(msg_desc.clone());
    populate_message(&mut dyn_msg, &msg_desc, form_values)?;

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

    // MAP FIELDS: must come before is_list() check.
    // Frontend stores map rows as Array<{key, value}> via useFieldArray.
    // Use as_array() — NOT as_object() (JsonValue::Array.as_object() returns None).
    // Per D-03 (corrected by RESEARCH to HashMap from BTreeMap):
    // Value::Map wraps HashMap<MapKey, Value> in prost-reflect 0.16.3.
    if field.is_map() {
        let arr = match json_val.as_array() {
            Some(a) => a,
            None => return Ok(()),
        };
        let mut map: std::collections::HashMap<MapKey, Value> =
            std::collections::HashMap::new();
        for row in arr {
            let key_json = row.get("key").unwrap_or(&JsonValue::Null);
            let val_json = row.get("value").unwrap_or(&JsonValue::Null);
            // Skip rows where the value field is absent/null — avoids inserting
            // silent zero-value entries for incomplete form rows.
            if val_json.is_null() {
                continue;
            }
            let map_key = json_to_map_key(field, key_json)?;
            if let Some(val) = scalar_or_message_value_for_map_entry(field, val_json)? {
                if map.contains_key(&map_key) {
                    return Err(AppError::EncodeError {
                        field: field.name().to_string(),
                        message: format!("duplicate map key: {:?}", map_key),
                    });
                }
                map.insert(map_key, val);
            }
        }
        if !map.is_empty() {
            dyn_msg.set_field(field, Value::Map(map));
        }
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

/// Convert a JSON key value to prost_reflect::MapKey.
/// Bool keys: accepts both JsonValue::Bool and JsonValue::String "true"/"false"
/// (the frontend stores bool Select values as strings per D-11).
fn json_to_map_key(
    field: &FieldDescriptor,
    key_json: &JsonValue,
) -> Result<MapKey, AppError> {
    let map_entry = match field.kind() {
        Kind::Message(m) => m,
        _ => {
            return Err(AppError::EncodeError {
                field: field.name().to_string(),
                message: "expected map entry message for map key".into(),
            })
        }
    };
    let key_field = map_entry.map_entry_key_field();
    let map_key = match key_field.kind() {
        Kind::String => MapKey::String(key_json.as_str().unwrap_or("").to_string()),
        Kind::Bool => {
            let b = match key_json {
                JsonValue::Bool(b) => *b,
                JsonValue::String(s) => s == "true",
                _ => false,
            };
            MapKey::Bool(b)
        }
        Kind::Int32 | Kind::Sint32 | Kind::Sfixed32 => {
            MapKey::I32(parse_i32(key_json).unwrap_or(0))
        }
        Kind::Int64 | Kind::Sint64 | Kind::Sfixed64 => {
            MapKey::I64(parse_i64(key_json).unwrap_or(0))
        }
        Kind::Uint32 | Kind::Fixed32 => MapKey::U32(parse_u32(key_json).unwrap_or(0)),
        Kind::Uint64 | Kind::Fixed64 => MapKey::U64(parse_u64(key_json).unwrap_or(0)),
        _ => {
            return Err(AppError::EncodeError {
                field: field.name().to_string(),
                message: format!("unsupported map key kind: {:?}", key_field.kind()),
            })
        }
    };
    Ok(map_key)
}

/// Get the prost_reflect Value for a map entry's value field.
/// The value field is obtained from the map entry MessageDescriptor.
fn scalar_or_message_value_for_map_entry(
    field: &FieldDescriptor,
    val_json: &JsonValue,
) -> Result<Option<Value>, AppError> {
    let map_entry = match field.kind() {
        Kind::Message(m) => m,
        _ => return Ok(None),
    };
    let val_field = map_entry.map_entry_value_field();
    scalar_or_message_value(&val_field, val_json)
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
                    let (secs, nanos) = if let Some(s) = json_val.as_str() {
                        parse_datetime_to_epoch(s)
                    } else {
                        (json_val.as_i64().unwrap_or(0), 0i32)
                    };
                    let mut ts_msg = DynamicMessage::new(msg_desc.clone());
                    if let Some(secs_field) = msg_desc.get_field_by_name("seconds") {
                        ts_msg.set_field(&secs_field, Value::I64(secs));
                    }
                    if let Some(nanos_field) = msg_desc.get_field_by_name("nanos") {
                        ts_msg.set_field(&nanos_field, Value::I32(nanos));
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
        .and_then(|n| i32::try_from(n).ok())
        .or_else(|| v.as_str().and_then(|s| s.parse::<i32>().ok()))
}

fn parse_i64(v: &JsonValue) -> Option<i64> {
    v.as_i64()
        .or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok()))
}

fn parse_u32(v: &JsonValue) -> Option<u32> {
    v.as_u64()
        .and_then(|n| u32::try_from(n).ok())
        .or_else(|| v.as_str().and_then(|s| s.parse::<u32>().ok()))
}

fn parse_u64(v: &JsonValue) -> Option<u64> {
    v.as_u64()
        .or_else(|| v.as_str().and_then(|s| s.parse::<u64>().ok()))
}

/// Howard Hinnant's days_from_civil algorithm: computes the number of days since
/// the Unix epoch (1970-01-01) for a given proleptic Gregorian calendar date.
/// Correctly handles leap years including century/400-year rules.
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let (y, era_m) = if m <= 2 {
        (y - 1, m + 9)
    } else {
        (y, m - 3)
    };
    // Use flooring division for negative years (Rust % is remainder, not modulo)
    let era = if y >= 0 { y / 400 } else { (y - 399) / 400 };
    let yoe = y - era * 400; // year-of-era: 0..=399
    let doy = (153 * era_m + 2) / 5 + d - 1; // day-of-year within era-year: 0..=365
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy; // day-of-era: 0..=146096
    era * 146097 + doe - 719468 // days since Unix epoch
}

/// Parse an ISO-8601 datetime string to `(unix_seconds, nanos)`.
/// Returns `(0, 0)` on any parse failure (no panic).
///
/// Supported forms:
///   - Plain integer → `(n, 0)`
///   - "YYYY-MM-DDTHH:MM:SS[.frac][Z|±HH:MM]"
fn parse_datetime_to_epoch(s: &str) -> (i64, i32) {
    // 1. Try plain integer first
    if let Ok(n) = s.parse::<i64>() {
        return (n, 0);
    }

    // 2. Must be ASCII-only — reject multi-byte UTF-8 to prevent any panic on byte indexing
    if !s.is_ascii() {
        return (0, 0);
    }

    // 3. Require at least "YYYY-MM-DDTHH:MM:SS" (19 chars)
    if s.len() < 19 {
        return (0, 0);
    }

    // 4. Parse date/time components using safe .get() slices
    let year: i64 = s.get(0..4).unwrap_or("0").parse().unwrap_or(0);
    let month: i64 = s.get(5..7).unwrap_or("0").parse().unwrap_or(0);
    let day: i64 = s.get(8..10).unwrap_or("0").parse().unwrap_or(0);
    let hour: i64 = s.get(11..13).unwrap_or("0").parse().unwrap_or(0);
    let min: i64 = s.get(14..16).unwrap_or("0").parse().unwrap_or(0);
    let sec: i64 = s.get(17..19).unwrap_or("0").parse().unwrap_or(0);

    // 5. Compute total UTC seconds using days_from_civil
    let total_days = days_from_civil(year, month, day);
    let mut total_secs = total_days * 86400 + hour * 3600 + min * 60 + sec;

    // 6. Fractional seconds: parse digits after '.' if present at position 19
    let mut nanos: i32 = 0;
    let mut tz_start = 19usize;

    if s.as_bytes().get(19) == Some(&b'.') {
        // Collect digit characters after the dot
        let frac_start = 20usize;
        let frac_end = s[frac_start..]
            .find(|c: char| !c.is_ascii_digit())
            .map(|rel| frac_start + rel)
            .unwrap_or(s.len());

        let frac_str = &s[frac_start..frac_end];
        // Left-pad / truncate to exactly 9 digits for nanoseconds
        if !frac_str.is_empty() {
            let digits: String = if frac_str.len() >= 9 {
                frac_str[..9].to_string()
            } else {
                format!("{:0<9}", frac_str) // right-pad with zeros to 9 digits
            };
            nanos = digits.parse::<i32>().unwrap_or(0);
        }
        tz_start = frac_end;
    }

    // 7. Timezone offset: scan suffix starting at tz_start for Z, +HH:MM, -HH:MM
    let tz_suffix = s.get(tz_start..).unwrap_or("");
    let tz_offset_secs: i64 = if tz_suffix.starts_with('Z') || tz_suffix.is_empty() {
        0
    } else if tz_suffix.starts_with('+') || tz_suffix.starts_with('-') {
        let sign: i64 = if tz_suffix.starts_with('-') { -1 } else { 1 };
        let tz_str = &tz_suffix[1..];
        let tz_hour: i64 = tz_str.get(0..2).unwrap_or("0").parse().unwrap_or(0);
        let tz_min: i64 = tz_str.get(3..5).unwrap_or("0").parse().unwrap_or(0);
        sign * (tz_hour * 3600 + tz_min * 60)
    } else {
        0
    };

    // UTC = local - offset
    total_secs -= tz_offset_secs;

    (total_secs, nanos)
}

/// Parse a human-readable duration string to seconds.
/// Supports: "30s", "5m", "2h", "1d", plain integer strings.
fn parse_duration_string(s: &str) -> i64 {
    if let Ok(n) = s.parse::<i64>() {
        return n;
    }
    let s = s.trim();
    if let Some(n) = s.strip_suffix('s') {
        n.parse::<i64>().unwrap_or(0)
    } else if let Some(n) = s.strip_suffix('m') {
        n.parse::<i64>().unwrap_or(0) * 60
    } else if let Some(n) = s.strip_suffix('h') {
        n.parse::<i64>().unwrap_or(0) * 3600
    } else if let Some(n) = s.strip_suffix('d') {
        n.parse::<i64>().unwrap_or(0) * 86400
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
        let tmp_dir = std::env::temp_dir().join("tap_tests");
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

    #[test]
    fn test_encode_map_string_key_scalar_value() {
        let pool = make_pool_with_schema(
            r#"syntax = "proto3"; message M { map<string, int32> labels = 1; }"#,
            "map_string.proto",
        );
        let msg_desc = pool.get_message_by_name("M").unwrap();
        let mut dyn_msg = DynamicMessage::new(msg_desc.clone());
        let values = serde_json::json!({
            "labels": [{"key": "a", "value": 1}, {"key": "b", "value": 2}]
        });
        populate_message(&mut dyn_msg, &msg_desc, &values).unwrap();
        let mut buf = Vec::new();
        dyn_msg.encode(&mut buf).unwrap();
        assert!(!buf.is_empty(), "map with entries should encode to non-empty bytes");
    }

    #[test]
    fn test_encode_map_int32_key() {
        let pool = make_pool_with_schema(
            r#"syntax = "proto3"; message M { map<int32, string> tags = 1; }"#,
            "map_int32.proto",
        );
        let msg_desc = pool.get_message_by_name("M").unwrap();
        let mut dyn_msg = DynamicMessage::new(msg_desc.clone());
        let values = serde_json::json!({ "tags": [{"key": 42, "value": "hello"}] });
        populate_message(&mut dyn_msg, &msg_desc, &values).unwrap();
        let mut buf = Vec::new();
        dyn_msg.encode(&mut buf).unwrap();
        assert!(!buf.is_empty());
    }

    #[test]
    fn test_encode_map_bool_key_as_string() {
        let pool = make_pool_with_schema(
            r#"syntax = "proto3"; message M { map<bool, string> flags = 1; }"#,
            "map_bool.proto",
        );
        let msg_desc = pool.get_message_by_name("M").unwrap();
        let mut dyn_msg = DynamicMessage::new(msg_desc.clone());
        // Frontend stores bool Select as string "true"/"false" per D-11
        let values = serde_json::json!({ "flags": [{"key": "true", "value": "yes"}] });
        populate_message(&mut dyn_msg, &msg_desc, &values).unwrap();
        let mut buf = Vec::new();
        dyn_msg.encode(&mut buf).unwrap();
        assert!(!buf.is_empty(), "bool key 'true' string should encode");
    }

    #[test]
    fn test_encode_map_empty_array() {
        let pool = make_pool_with_schema(
            r#"syntax = "proto3"; message M { map<string, int32> labels = 1; }"#,
            "map_empty.proto",
        );
        let msg_desc = pool.get_message_by_name("M").unwrap();
        let mut dyn_msg = DynamicMessage::new(msg_desc.clone());
        let values = serde_json::json!({ "labels": [] });
        populate_message(&mut dyn_msg, &msg_desc, &values).unwrap();
        let mut buf = Vec::new();
        dyn_msg.encode(&mut buf).unwrap();
        assert!(buf.is_empty(), "empty map array should encode as absent field (empty bytes)");
    }

    // ── Timestamp epoch tests (BUG-1) ────────────────────────────────────────

    #[test]
    fn test_epoch_unix_origin() {
        let (secs, nanos) = parse_datetime_to_epoch("1970-01-01T00:00:00Z");
        assert_eq!(secs, 0, "Unix epoch origin must be 0");
        assert_eq!(nanos, 0);
    }

    #[test]
    fn test_epoch_leap_day_1972_02_29() {
        // 1972 is a leap year; 1972-02-29 must be a valid date
        let (secs, _) = parse_datetime_to_epoch("1972-02-29T00:00:00Z");
        // Days from 1970-01-01 to 1972-02-29: 365 (1970) + 365 (1971) + 59 (Jan+Feb leap) = 789
        assert_eq!(secs, 789 * 86400, "1972-02-29 should be 789 days after epoch");
    }

    #[test]
    fn test_epoch_1972_03_01_is_one_day_after_leap() {
        let (leap_secs, _) = parse_datetime_to_epoch("1972-02-29T00:00:00Z");
        let (next_secs, _) = parse_datetime_to_epoch("1972-03-01T00:00:00Z");
        assert_eq!(next_secs - leap_secs, 86400, "1972-03-01 must be exactly 1 day after 1972-02-29");
    }

    #[test]
    fn test_epoch_2025_06_10() {
        let (secs, nanos) = parse_datetime_to_epoch("2025-06-10T00:00:00Z");
        assert_eq!(secs, 1749513600, "2025-06-10T00:00:00Z must equal Unix epoch 1749513600");
        assert_eq!(nanos, 0);
    }

    #[test]
    fn test_epoch_2024_leap_year_feb_29() {
        // 2024 is a leap year (divisible by 4, not by 100)
        let (secs, _) = parse_datetime_to_epoch("2024-02-29T00:00:00Z");
        // 2024-02-28 is day (2024-02-28T00:00:00Z) — should not panic and should be adjacent
        let (prev_secs, _) = parse_datetime_to_epoch("2024-02-28T00:00:00Z");
        assert_eq!(secs - prev_secs, 86400, "2024-02-29 should be exactly 1 day after 2024-02-28");
    }

    #[test]
    fn test_epoch_fractional_seconds() {
        let (secs, nanos) = parse_datetime_to_epoch("2025-06-10T12:30:45.123456789Z");
        // 2025-06-10T12:30:45Z = 1749513600 + 12*3600 + 30*60 + 45 = 1749513600 + 45045
        let expected_secs = 1749513600i64 + 12 * 3600 + 30 * 60 + 45;
        assert_eq!(secs, expected_secs, "base seconds should match");
        assert_eq!(nanos, 123456789, "full 9-digit fractional seconds should be preserved");
    }

    #[test]
    fn test_epoch_fractional_short() {
        // ".123" → 123000000 nanos (3 digits left-padded to 9)
        let (_, nanos) = parse_datetime_to_epoch("2025-06-10T00:00:00.123Z");
        assert_eq!(nanos, 123000000, ".123 should become 123000000 nanos");
    }

    #[test]
    fn test_epoch_positive_timezone_offset() {
        // 2025-06-10T14:30:00+02:00 should equal 2025-06-10T12:30:00Z
        let (with_tz, _) = parse_datetime_to_epoch("2025-06-10T14:30:00+02:00");
        let (utc, _) = parse_datetime_to_epoch("2025-06-10T12:30:00Z");
        assert_eq!(with_tz, utc, "+02:00 should be subtracted to yield UTC equivalent");
    }

    #[test]
    fn test_epoch_negative_timezone_offset() {
        // 2025-06-10T10:30:00-02:00 should equal 2025-06-10T12:30:00Z
        let (with_tz, _) = parse_datetime_to_epoch("2025-06-10T10:30:00-02:00");
        let (utc, _) = parse_datetime_to_epoch("2025-06-10T12:30:00Z");
        assert_eq!(with_tz, utc, "-02:00 should be added to yield UTC equivalent");
    }

    #[test]
    fn test_epoch_invalid_string_returns_zero() {
        let (secs, nanos) = parse_datetime_to_epoch("not-a-date");
        assert_eq!(secs, 0, "invalid string should return 0 seconds");
        assert_eq!(nanos, 0, "invalid string should return 0 nanos");
    }

    #[test]
    fn test_epoch_multibyte_utf8_no_panic() {
        // Multi-byte UTF-8 must not panic; must return (0, 0)
        let (secs, nanos) = parse_datetime_to_epoch("2025-éé-10T00:00:00Z");
        assert_eq!(secs, 0, "multi-byte UTF-8 input must return 0 seconds");
        assert_eq!(nanos, 0, "multi-byte UTF-8 input must return 0 nanos");
    }

    #[test]
    fn test_epoch_short_string_no_panic() {
        let (secs, nanos) = parse_datetime_to_epoch("short");
        assert_eq!(secs, 0, "short string must return 0 seconds");
        assert_eq!(nanos, 0, "short string must return 0 nanos");
    }

    #[test]
    fn test_epoch_plain_integer() {
        // A plain integer string should be returned as-is
        let (secs, nanos) = parse_datetime_to_epoch("1749513600");
        assert_eq!(secs, 1749513600, "plain integer string should parse as epoch seconds");
        assert_eq!(nanos, 0);
    }
}
