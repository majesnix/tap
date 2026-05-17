use std::sync::Mutex;

mod commands;
mod error;
mod schema;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(Option::<prost_reflect::DescriptorPool>::None))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::proto::parse_proto,
            commands::encode::encode_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
