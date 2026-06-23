use prost_reflect::{DescriptorPool, FieldDescriptor, Kind, MessageDescriptor};
use std::collections::HashMap;

use super::types::{EnumSchema, EnumValue, FieldKind, FieldSchema, MessageSchema, ProtoSchema, ScalarKind};

const WELL_KNOWN_TYPES: &[&str] = &[
    "google.protobuf.Timestamp",
    "google.protobuf.Duration",
    "google.protobuf.Any",
    "google.protobuf.Struct",
    "google.protobuf.Value",
    "google.protobuf.ListValue",
    "google.protobuf.FieldMask",
    "google.protobuf.StringValue",
    "google.protobuf.Int32Value",
    "google.protobuf.Int64Value",
    "google.protobuf.UInt32Value",
    "google.protobuf.UInt64Value",
    "google.protobuf.FloatValue",
    "google.protobuf.DoubleValue",
    "google.protobuf.BoolValue",
    "google.protobuf.BytesValue",
];

/// Extract a ProtoSchema from a compiled DescriptorPool.
/// Only includes messages that are not google.protobuf.* well-known types.
pub fn extract_schema(pool: &DescriptorPool) -> ProtoSchema {
    let messages: Vec<MessageSchema> = pool
        .all_messages()
        .filter(|m| !m.full_name().starts_with("google.protobuf."))
        .filter(|m| !m.is_map_entry())
        .map(|m| extract_message(&m))
        .collect();

    let message_map: HashMap<String, MessageSchema> = messages
        .iter()
        .map(|m| (m.full_name.clone(), m.clone()))
        .collect();

    let enums: Vec<EnumSchema> = pool
        .all_enums()
        .filter(|e| !e.full_name().starts_with("google.protobuf."))
        .map(|e| EnumSchema {
            name: e.name().to_string(),
            full_name: e.full_name().to_string(),
            values: e
                .values()
                .map(|v| EnumValue {
                    name: v.name().to_string(),
                    number: v.number(),
                })
                .collect(),
        })
        .collect();

    ProtoSchema {
        messages,
        message_map,
        enums,
    }
}

fn extract_message(msg: &MessageDescriptor) -> MessageSchema {
    // Build a set of field names that belong to a oneof group
    let mut oneof_field_names: HashMap<String, String> = HashMap::new();
    for oneof in msg.oneofs() {
        for field in oneof.fields() {
            oneof_field_names.insert(field.name().to_string(), oneof.name().to_string());
        }
    }

    // Extract regular fields (non-oneof)
    let mut fields: Vec<FieldSchema> = Vec::new();
    let mut seen_oneof_groups: Vec<String> = Vec::new();

    for field in msg.fields() {
        let oneof_group = oneof_field_names.get(field.name()).cloned();

        if let Some(ref group_name) = oneof_group {
            // Already emitted this oneof group as a synthetic Oneof field?
            if seen_oneof_groups.contains(group_name) {
                continue;
            }
            seen_oneof_groups.push(group_name.clone());

            // Find the oneof descriptor and build branches
            if let Some(oneof) = msg.oneofs().find(|o| o.name() == group_name.as_str()) {
                let branches: Vec<Vec<FieldSchema>> = oneof
                    .fields()
                    .map(|f| vec![extract_field_schema(&f, None)])
                    .collect();

                fields.push(FieldSchema {
                    name: group_name.clone(),
                    label: to_label(group_name),
                    field_number: 0,
                    kind: FieldKind::Oneof { branches },
                    repeated: false,
                    oneof_group: None,
                    default_value: None,
                });
            }
        } else {
            fields.push(extract_field_schema(&field, None));
        }
    }

    MessageSchema {
        name: msg.name().to_string(),
        full_name: msg.full_name().to_string(),
        fields,
    }
}

fn extract_field_schema(field: &FieldDescriptor, oneof_group: Option<String>) -> FieldSchema {
    // Map fields: MUST check is_map() before field.kind() match.
    // Map fields have Kind::Message(synthetic_entry_type) underneath.
    // Without this guard they fall through as nested messages (Pitfall 1).
    if field.is_map() {
        let map_entry_msg = match field.kind() {
            Kind::Message(m) => m,
            _ => unreachable!(
                "BUG: map field '{}' has non-Message kind — prost-reflect invariant violated",
                field.name()
            ),
        };
        let key_field = map_entry_msg.map_entry_key_field();
        let val_field = map_entry_msg.map_entry_value_field();
        let value_kind = extract_field_kind(&val_field);
        let key_type = match extract_field_kind(&key_field) {
            FieldKind::Scalar { scalar } => scalar,
            _ => unreachable!(
                "BUG: map field '{}' has non-scalar key kind — proto3 spec violation",
                field.name()
            ),
        };
        return FieldSchema {
            name: field.name().to_string(),
            label: to_label(field.name()),
            field_number: field.number(),
            kind: FieldKind::Map { key_type, value_kind: Box::new(value_kind) },
            repeated: false, // is_list() returns false for map fields; set explicitly per D-02
            oneof_group,
            default_value: None,
        };
    }
    // EXISTING code continues unchanged:
    let repeated = field.is_list();
    let kind = extract_field_kind(field);

    FieldSchema {
        name: field.name().to_string(),
        label: to_label(field.name()),
        field_number: field.number(),
        kind,
        repeated,
        oneof_group,
        default_value: None,
    }
}

fn extract_field_kind(field: &FieldDescriptor) -> FieldKind {
    match field.kind() {
        Kind::Bool => FieldKind::Scalar {
            scalar: ScalarKind::Bool,
        },
        Kind::String => FieldKind::Scalar {
            scalar: ScalarKind::String,
        },
        Kind::Bytes => FieldKind::Scalar {
            scalar: ScalarKind::Bytes,
        },
        Kind::Int32 => FieldKind::Scalar {
            scalar: ScalarKind::Int32,
        },
        Kind::Int64 => FieldKind::Scalar {
            scalar: ScalarKind::Int64,
        },
        Kind::Uint32 => FieldKind::Scalar {
            scalar: ScalarKind::Uint32,
        },
        Kind::Uint64 => FieldKind::Scalar {
            scalar: ScalarKind::Uint64,
        },
        Kind::Sint32 => FieldKind::Scalar {
            scalar: ScalarKind::Sint32,
        },
        Kind::Sint64 => FieldKind::Scalar {
            scalar: ScalarKind::Sint64,
        },
        Kind::Fixed32 => FieldKind::Scalar {
            scalar: ScalarKind::Fixed32,
        },
        Kind::Fixed64 => FieldKind::Scalar {
            scalar: ScalarKind::Fixed64,
        },
        Kind::Sfixed32 => FieldKind::Scalar {
            scalar: ScalarKind::Sfixed32,
        },
        Kind::Sfixed64 => FieldKind::Scalar {
            scalar: ScalarKind::Sfixed64,
        },
        Kind::Float => FieldKind::Scalar {
            scalar: ScalarKind::Float,
        },
        Kind::Double => FieldKind::Scalar {
            scalar: ScalarKind::Double,
        },
        Kind::Message(msg_desc) => {
            let full_name = msg_desc.full_name().to_string();
            if WELL_KNOWN_TYPES.contains(&full_name.as_str()) {
                let wkt = msg_desc.name().to_string();
                FieldKind::WellKnown { wkt }
            } else {
                FieldKind::Message { full_name }
            }
        }
        Kind::Enum(enum_desc) => {
            let values = enum_desc
                .values()
                .map(|v| EnumValue {
                    name: v.name().to_string(),
                    number: v.number(),
                })
                .collect();
            FieldKind::Enum { values }
        }
    }
}

/// Convert snake_case field name to a Title Case label.
fn to_label(name: &str) -> String {
    name.split('_')
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Compile inline `.proto` content into a DescriptorPool for testing.
    fn make_pool(proto_content: &str, file_name: &str) -> DescriptorPool {
        let tmp_dir = std::env::temp_dir().join("tap_extractor_tests");
        std::fs::create_dir_all(&tmp_dir).unwrap();
        let proto_path = tmp_dir.join(file_name);
        std::fs::write(&proto_path, proto_content).unwrap();

        let mut compiler = protox::Compiler::new(&[tmp_dir.to_str().unwrap()]).unwrap();
        compiler.include_imports(true);
        compiler.open_file(proto_path.to_str().unwrap()).unwrap();
        let fds = compiler.file_descriptor_set();
        DescriptorPool::from_file_descriptor_set(fds).unwrap()
    }

    /// Find a message in a ProtoSchema by its short name.
    fn find_message<'a>(schema: &'a ProtoSchema, name: &str) -> &'a MessageSchema {
        schema
            .messages
            .iter()
            .find(|m| m.name == name)
            .unwrap_or_else(|| panic!("message '{name}' not found in schema"))
    }

    /// Find a field within a MessageSchema by name.
    fn find_field<'a>(msg: &'a MessageSchema, name: &str) -> &'a FieldSchema {
        msg.fields
            .iter()
            .find(|f| f.name == name)
            .unwrap_or_else(|| panic!("field '{name}' not found in message '{}'", msg.name))
    }

    // ---- to_label ----------------------------------------------------------

    #[test]
    fn to_label_capitalizes_each_snake_case_word() {
        assert_eq!(to_label("user_id"), "User Id");
        assert_eq!(to_label("first_name_field"), "First Name Field");
    }

    #[test]
    fn to_label_handles_single_word() {
        assert_eq!(to_label("name"), "Name");
    }

    #[test]
    fn to_label_handles_empty_string() {
        assert_eq!(to_label(""), "");
    }

    #[test]
    fn to_label_handles_leading_and_trailing_underscores() {
        // Empty segments collapse to empty words, preserving surrounding spaces.
        assert_eq!(to_label("_leading"), " Leading");
        assert_eq!(to_label("trailing_"), "Trailing ");
    }

    // ---- scalar field extraction ------------------------------------------

    #[test]
    fn extracts_all_scalar_kinds() {
        let pool = make_pool(
            r#"syntax = "proto3";
               message Scalars {
                 bool b = 1;
                 string s = 2;
                 bytes by = 3;
                 int32 i32 = 4;
                 int64 i64 = 5;
                 uint32 u32 = 6;
                 uint64 u64 = 7;
                 sint32 si32 = 8;
                 sint64 si64 = 9;
                 fixed32 f32 = 10;
                 fixed64 f64 = 11;
                 sfixed32 sf32 = 12;
                 sfixed64 sf64 = 13;
                 float fl = 14;
                 double db = 15;
               }"#,
            "scalars.proto",
        );
        let schema = extract_schema(&pool);
        let msg = find_message(&schema, "Scalars");

        let expected = [
            ("b", ScalarKind::Bool),
            ("s", ScalarKind::String),
            ("by", ScalarKind::Bytes),
            ("i32", ScalarKind::Int32),
            ("i64", ScalarKind::Int64),
            ("u32", ScalarKind::Uint32),
            ("u64", ScalarKind::Uint64),
            ("si32", ScalarKind::Sint32),
            ("si64", ScalarKind::Sint64),
            ("f32", ScalarKind::Fixed32),
            ("f64", ScalarKind::Fixed64),
            ("sf32", ScalarKind::Sfixed32),
            ("sf64", ScalarKind::Sfixed64),
            ("fl", ScalarKind::Float),
            ("db", ScalarKind::Double),
        ];

        for (field_name, expected_scalar) in expected {
            let field = find_field(msg, field_name);
            match &field.kind {
                FieldKind::Scalar { scalar } => assert_eq!(
                    std::mem::discriminant(scalar),
                    std::mem::discriminant(&expected_scalar),
                    "field '{field_name}' had unexpected scalar kind"
                ),
                other => panic!("field '{field_name}' expected Scalar, got {other:?}"),
            }
            assert!(!field.repeated, "scalar field '{field_name}' should not be repeated");
        }
    }

    #[test]
    fn populates_field_metadata() {
        let pool = make_pool(
            r#"syntax = "proto3"; message Meta { string user_name = 7; }"#,
            "meta.proto",
        );
        let schema = extract_schema(&pool);
        let field = find_field(find_message(&schema, "Meta"), "user_name");

        assert_eq!(field.name, "user_name");
        assert_eq!(field.label, "User Name");
        assert_eq!(field.field_number, 7);
        assert!(field.oneof_group.is_none());
        assert!(field.default_value.is_none());
    }

    // ---- repeated fields ---------------------------------------------------

    #[test]
    fn marks_repeated_scalar_fields() {
        let pool = make_pool(
            r#"syntax = "proto3"; message Tags { repeated string tags = 1; string single = 2; }"#,
            "tags.proto",
        );
        let schema = extract_schema(&pool);
        let msg = find_message(&schema, "Tags");

        assert!(find_field(msg, "tags").repeated);
        assert!(!find_field(msg, "single").repeated);
    }

    // ---- nested message fields --------------------------------------------

    #[test]
    fn extracts_nested_message_field() {
        let pool = make_pool(
            r#"syntax = "proto3";
               message Address { string city = 1; }
               message Person { string name = 1; Address address = 2; }"#,
            "nested.proto",
        );
        let schema = extract_schema(&pool);
        let field = find_field(find_message(&schema, "Person"), "address");

        match &field.kind {
            FieldKind::Message { full_name } => assert_eq!(full_name, "Address"),
            other => panic!("expected Message kind, got {other:?}"),
        }
    }

    #[test]
    fn message_map_indexes_all_messages_by_full_name() {
        let pool = make_pool(
            r#"syntax = "proto3";
               message Address { string city = 1; }
               message Person { string name = 1; Address address = 2; }"#,
            "msgmap.proto",
        );
        let schema = extract_schema(&pool);

        assert_eq!(schema.message_map.len(), 2);
        assert!(schema.message_map.contains_key("Address"));
        assert!(schema.message_map.contains_key("Person"));
        assert_eq!(schema.message_map["Person"].name, "Person");
    }

    // ---- enums -------------------------------------------------------------

    #[test]
    fn extracts_enum_field_with_values() {
        let pool = make_pool(
            r#"syntax = "proto3";
               enum Status { UNKNOWN = 0; ACTIVE = 1; INACTIVE = 2; }
               message Account { Status status = 1; }"#,
            "enum_field.proto",
        );
        let schema = extract_schema(&pool);
        let field = find_field(find_message(&schema, "Account"), "status");

        match &field.kind {
            FieldKind::Enum { values } => {
                assert_eq!(values.len(), 3);
                assert_eq!(values[0].name, "UNKNOWN");
                assert_eq!(values[0].number, 0);
                assert_eq!(values[2].name, "INACTIVE");
                assert_eq!(values[2].number, 2);
            }
            other => panic!("expected Enum kind, got {other:?}"),
        }
    }

    #[test]
    fn extracts_top_level_enums() {
        let pool = make_pool(
            r#"syntax = "proto3";
               enum Color { RED = 0; GREEN = 1; }
               message Dummy { string x = 1; }"#,
            "top_enum.proto",
        );
        let schema = extract_schema(&pool);

        let color = schema
            .enums
            .iter()
            .find(|e| e.name == "Color")
            .expect("Color enum should be extracted");
        assert_eq!(color.full_name, "Color");
        assert_eq!(color.values.len(), 2);
        assert_eq!(color.values[1].name, "GREEN");
        assert_eq!(color.values[1].number, 1);
    }

    // ---- oneof -------------------------------------------------------------

    #[test]
    fn extracts_oneof_as_synthetic_field_with_branches() {
        let pool = make_pool(
            r#"syntax = "proto3";
               message Contact {
                 string name = 1;
                 oneof method { string email = 2; string phone = 3; }
               }"#,
            "oneof.proto",
        );
        let schema = extract_schema(&pool);
        let msg = find_message(&schema, "Contact");

        // The two oneof members collapse into a single synthetic "method" field.
        assert_eq!(msg.fields.len(), 2, "expected name + synthetic oneof field");
        let oneof_field = find_field(msg, "method");
        assert_eq!(oneof_field.label, "Method");
        assert_eq!(oneof_field.field_number, 0);
        assert!(!oneof_field.repeated);

        match &oneof_field.kind {
            FieldKind::Oneof { branches } => {
                assert_eq!(branches.len(), 2);
                assert_eq!(branches[0].len(), 1);
                assert_eq!(branches[0][0].name, "email");
                assert_eq!(branches[1][0].name, "phone");
            }
            other => panic!("expected Oneof kind, got {other:?}"),
        }
    }

    // ---- maps --------------------------------------------------------------

    #[test]
    fn extracts_map_field_and_excludes_synthetic_entry() {
        let pool = make_pool(
            r#"syntax = "proto3";
               message WithMap { map<string, int32> counts = 1; }"#,
            "map.proto",
        );
        let schema = extract_schema(&pool);

        // The synthetic map-entry message must not appear as a top-level message.
        assert_eq!(schema.messages.len(), 1);
        let field = find_field(find_message(&schema, "WithMap"), "counts");

        assert!(!field.repeated, "map fields must report repeated=false");
        match &field.kind {
            FieldKind::Map { key_type, value_kind } => {
                assert!(matches!(key_type, ScalarKind::String));
                match value_kind.as_ref() {
                    FieldKind::Scalar { scalar } => assert!(matches!(scalar, ScalarKind::Int32)),
                    other => panic!("expected scalar map value, got {other:?}"),
                }
            }
            other => panic!("expected Map kind, got {other:?}"),
        }
    }

    // ---- well-known types --------------------------------------------------

    #[test]
    fn extracts_well_known_type_field() {
        let pool = make_pool(
            r#"syntax = "proto3";
               import "google/protobuf/timestamp.proto";
               message Event { google.protobuf.Timestamp created_at = 1; }"#,
            "wkt.proto",
        );
        let schema = extract_schema(&pool);
        let field = find_field(find_message(&schema, "Event"), "created_at");

        match &field.kind {
            FieldKind::WellKnown { wkt } => assert_eq!(wkt, "Timestamp"),
            other => panic!("expected WellKnown kind, got {other:?}"),
        }
    }

    #[test]
    fn excludes_well_known_messages_from_schema() {
        let pool = make_pool(
            r#"syntax = "proto3";
               import "google/protobuf/timestamp.proto";
               message Event { google.protobuf.Timestamp created_at = 1; }"#,
            "wkt_exclude.proto",
        );
        let schema = extract_schema(&pool);

        assert!(
            schema.messages.iter().all(|m| !m.full_name.starts_with("google.protobuf.")),
            "google.protobuf.* messages must be filtered out"
        );
        assert!(schema.messages.iter().any(|m| m.name == "Event"));
    }
}
