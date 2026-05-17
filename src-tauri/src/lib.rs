use std::sync::Mutex;

mod commands;
mod error;
mod profiles;
mod schema;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Platform-specific keyring store initialization — must run before any Entry operations.
    // keyring-core 1.x requires explicit store registration; see keyring-core README.
    // SECURITY: do not log password or AMQP URI
    #[cfg(target_os = "linux")]
    {
        use dbus_secret_service_keyring_store::Store as DbusStore;
        let store = DbusStore::new().expect("Failed to create DBus secret service store");
        keyring_core::set_default_store(store);
    }
    #[cfg(target_os = "macos")]
    {
        use apple_native_keyring_store::keychain::Store as AppleStore;
        let store = AppleStore::new().expect("Failed to create macOS keychain store");
        keyring_core::set_default_store(store);
    }
    #[cfg(target_os = "windows")]
    {
        use windows_native_keyring_store::Store as WindowsStore;
        let store = WindowsStore::new().expect("Failed to create Windows credential store");
        keyring_core::set_default_store(store);
    }

    tauri::Builder::default()
        .manage(Mutex::new(Option::<prost_reflect::DescriptorPool>::None))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::proto::parse_proto,
            commands::encode::encode_message,
            commands::connection::save_profile,
            commands::connection::list_profiles,
            commands::connection::delete_profile,
            commands::connection::test_connection,
            commands::connection::activate_profile,
            commands::connection::fetch_queues,
            commands::connection::fetch_exchanges,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
