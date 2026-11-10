pub mod commands;
pub mod paths;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::subscription::fetch_subscription_url,
            commands::singbox::check_binary_status,
            commands::singbox::validate_singbox_config_cmd,
            commands::mitm::sniff_mitm_port,
            commands::mitm::toggle_mitm_listener,
            commands::cert::import_ca_cert,
        ])
        .run(tauri::generate_context!())
        .expect("error while running SingboxGUIV0 tauri application");
}
