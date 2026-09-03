use std::sync::Mutex;
use tauri::{Emitter, Manager};

use commands::connection::KeychainStatus;

/// Keeps the non-blocking log writer alive for the life of the app.
struct LogGuard(#[allow(dead_code)] tracing_appender::non_blocking::WorkerGuard);

/// Open the platform keychain. When that fails (no Secret Service on Linux, for example),
/// fall back to an in-memory store so the app still starts; the frontend shows the status.
fn init_keychain_store() -> KeychainStatus {
    let opened: Result<(), String> = {
        #[cfg(target_os = "linux")]
        {
            dbus_secret_service_keyring_store::Store::new()
                .map(|store| keyring_core::set_default_store(store))
                .map_err(|e| e.to_string())
        }
        #[cfg(target_os = "macos")]
        {
            apple_native_keyring_store::keychain::Store::new()
                .map(|store| keyring_core::set_default_store(store))
                .map_err(|e| e.to_string())
        }
        #[cfg(target_os = "windows")]
        {
            windows_native_keyring_store::Store::new()
                .map(|store| keyring_core::set_default_store(store))
                .map_err(|e| e.to_string())
        }
        #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
        {
            Err("no keychain backend for this platform".to_string())
        }
    };
    match opened {
        Ok(()) => KeychainStatus { available: true, error: None },
        Err(error) => {
            tracing::error!("keychain unavailable, using an in-memory store for this session: {}", error);
            if let Ok(store) = keyring_core::mock::Store::new() {
                keyring_core::set_default_store(store);
            }
            KeychainStatus { available: false, error: Some(error) }
        }
    }
}

/// Write tracing output to a daily rolling file in the app log directory.
/// SECURITY: log lines carry profile and queue names only; URIs and passwords never reach
/// tracing (see the connect helpers in profiles.rs).
fn init_logging(app: &tauri::App) {
    let Ok(dir) = app.path().app_log_dir() else { return };
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }
    let appender = tracing_appender::rolling::daily(&dir, "tap.log");
    let (writer, guard) = tracing_appender::non_blocking(appender);
    let filter = tracing_subscriber::EnvFilter::try_from_env("TAP_LOG")
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    let _ = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_writer(writer)
        .with_ansi(false)
        .try_init();
    app.manage(LogGuard(guard));
}

mod commands;
mod error;
mod profiles;
mod schema;
#[cfg(test)]
mod test_support;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Select the rustls crypto backend before any TLS handshake (AMQP, Management API, updater).
    profiles::ensure_crypto_provider();

    // Platform-specific keyring store initialization — must run before any Entry operations.
    // keyring-core 1.x requires explicit store registration; see keyring-core README.
    // SECURITY: do not log password or AMQP URI
    let keychain_status = init_keychain_store();

    tauri::Builder::default()
        .manage(keychain_status)
        .manage(Mutex::new(Option::<prost_reflect::DescriptorPool>::None))
        .manage(Mutex::new(Option::<commands::subscribe::SubscribeState>::None))
        .manage(Mutex::new(Option::<commands::plan_runner::PlanRunState>::None))
        .setup(|app| {
            init_logging(app);
            // Dev builds (tauri.dev.conf.json) use their own keychain namespace.
            profiles::set_keyring_service(profiles::keyring_service_for_identifier(
                &app.config().identifier,
            ));
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
            commands::proto::reload_proto,
            commands::proto::check_paths_exist,
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
            commands::connection::keychain_status,
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
