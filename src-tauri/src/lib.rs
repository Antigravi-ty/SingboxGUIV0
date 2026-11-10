pub mod commands;
pub mod paths;

use tauri::{
    menu::{MenuBuilder, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle();
            let show_item =
                MenuItem::with_id(handle, "show_main", "Show SingboxGUI V0", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(handle)?;
            let quit_item =
                MenuItem::with_id(handle, "quit_app", "Quit SingboxGUI V0", true, None::<&str>)?;
            let tray_menu = MenuBuilder::new(handle)
                .items(&[&show_item, &sep, &quit_item])
                .build()?;

            let mut tray_builder = TrayIconBuilder::with_id("singbox_tray")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .tooltip("SingboxGUI V0 — Sing-box 1.14.4")
                .on_menu_event(|app_handle, event| match event.id.as_ref() {
                    "show_main" => {
                        if let Some(win) = app_handle.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                    }
                    "quit_app" => {
                        commands::singbox::stop_managed_singbox_process();
                        app_handle.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(win) = tray.app_handle().get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                    }
                });

            if let Some(default_icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(default_icon.clone());
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.set_icon(default_icon.clone());
                }
            }

            let _ = tray_builder.build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::subscription::fetch_subscription_url,
            commands::singbox::check_binary_status,
            commands::singbox::import_singbox_binary_cmd,
            commands::singbox::open_config_folder_cmd,
            commands::singbox::validate_singbox_config_cmd,
            commands::singbox::start_singbox_service_cmd,
            commands::singbox::stop_singbox_service_cmd,
            commands::singbox::get_singbox_service_status_cmd,
            commands::mitm::sniff_mitm_port,
            commands::mitm::toggle_mitm_listener,
            commands::mitm::check_port_availability,
            commands::mitm::run_connectivity_test_cmd,
            commands::cert::import_ca_cert,
            commands::cert::generate_self_signed_ca,
        ])
        .run(tauri::generate_context!())
        .expect("error while running SingboxGUIV0 tauri application");
}
