use prost_reflect::{DescriptorPool, FieldDescriptor, Kind, MessageDescriptor};
use std::collections::HashMap;

use super::types::{EnumValue, FieldKind, FieldSchema, MessageSchema, ProtoSchema, ScalarKind};

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

    ProtoSchema {
        messages,
        message_map,
    }
}

fn extract_message(msg: &MessageDescriptor) -> MessageSchema {
    // Collect oneof groups first so we can mark fields
    let oneof_names: Vec<String> = msg
        .oneofs()
        .map(|o| o.name().to_string())
        .collect();

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

    // Suppress unused warning — oneof_names was used for doc purposes
    let _ = oneof_names;

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
            _ => unreachable!("map field always has Message kind"),
        };
        let key_field = map_entry_msg.map_entry_key_field();
        let val_field = map_entry_msg.map_entry_value_field();
        let value_kind = extract_field_kind(&val_field);
        let key_type = match extract_field_kind(&key_field) {
            FieldKind::Scalar { scalar } => scalar,
            _ => unreachable!("proto3 spec: map key must be scalar"),
        };
        return FieldSchema {
            name: field.name().to_string(),
            label: to_label(field.name()),
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
