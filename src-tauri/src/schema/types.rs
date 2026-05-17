use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProtoSchema {
    pub messages: Vec<MessageSchema>,
    pub message_map: HashMap<String, MessageSchema>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MessageSchema {
    pub name: String,
    pub full_name: String,
    pub fields: Vec<FieldSchema>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FieldSchema {
    pub name: String,
    pub label: String,
    pub kind: FieldKind,
    pub repeated: bool,
    pub oneof_group: Option<String>,
    pub default_value: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum FieldKind {
    Scalar { scalar: ScalarKind },
    Message { full_name: String },
    Enum { values: Vec<EnumValue> },
    Oneof { branches: Vec<Vec<FieldSchema>> },
    WellKnown { wkt: String },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum ScalarKind {
    Bool,
    String,
    Bytes,
    Int32,
    Int64,
    Uint32,
    Uint64,
    Sint32,
    Sint64,
    Fixed32,
    Fixed64,
    Sfixed32,
    Sfixed64,
    Float,
    Double,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnumValue {
    pub name: String,
    pub number: i32,
}
