use std::sync::Mutex;
use tauri::Emitter;

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
        .manage(Mutex::new(Option::<commands::subscribe::SubscribeState>::None))
        .manage(Mutex::new(Option::<commands::plan_runner::PlanRunState>::None))
        .setup(|#[allow(unused_variables)] app| {
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};
                let check_updates = MenuItem::with_id(
                    app,
                    "check-for-updates",
                    "Check for Updates...",
                    true,
                    None::<&str>,
                )?;
                let app_menu = SubmenuBuilder::new(app, "Tap")
                    .item(&PredefinedMenuItem::about(app, None::<&str>, None)?)
                    .separator()
                    .item(&check_updates)
                    .separator()
                    .item(&PredefinedMenuItem::quit(app, None::<&str>)?)
                    .build()?;
                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;
                let menu = MenuBuilder::new(app)
                    .item(&app_menu)
                    .item(&edit_menu)
                    .build()?;
                app.set_menu(menu)?;
            }
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id() == "check-for-updates" {
                let _ = app.emit("check-for-updates", ());
            }
        })
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            commands::proto::parse_proto,
            commands::encode::encode_message,
            commands::connection::save_profile,
            commands::connection::list_profiles,
            commands::connection::delete_profile,
            commands::connection::test_connection,
            commands::connection::activate_profile,
            commands::connection::fetch_queues,
            commands::connection::fetch_queue_depth,
            commands::connection::fetch_exchanges,
            commands::connection::fetch_bindings,
            commands::publish::publish_message,
            commands::consume::consume_message,
            commands::consume::drain_messages,
            commands::subscribe::start_subscribe,
            commands::subscribe::stop_subscribe,
            commands::plan_runner::execute_step,
            commands::plan_runner::cancel_plan_run,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
