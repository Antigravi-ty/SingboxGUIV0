pub mod commands;
pub mod paths;

use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Manager, RunEvent, WindowEvent,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle();
            // 1. Clean up any orphaned sing-box processes from previous abnormal exit or hot-reload
            commands::singbox::cleanup_orphaned_managed_pids(handle);

            let ui_cfg = commands::ui_config::load_ui_config_sync(handle);
            let use_mono = !ui_cfg.topbar_icon_style.trim().eq_ignore_ascii_case("real");

            let show_item =
                MenuItem::with_id(handle, "show_main", "Show Panel", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(handle)?;
            let quit_item = MenuItem::with_id(handle, "quit_app", "Quit", true, None::<&str>)?;
            let initial_menu = MenuBuilder::new(handle)
                .items(&[&show_item, &sep, &quit_item])
                .build()?;

            let mut tray_builder = TrayIconBuilder::with_id("singbox_tray")
                .menu(&initial_menu)
                // Support both left-click and right-click on the menu bar icon to open the tray menu
                .show_menu_on_left_click(true)
                .tooltip("SingboxGUI V0 — Standby (Click to Show Panel or Launch Core)")
                .on_menu_event(|app_handle, event| match event.id.as_ref() {
                    "show_main" => {
                        if let Some(win) = app_handle.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                    }
                    "toggle_core_stable" => {
                        let handle_clone = app_handle.clone();
                        std::thread::spawn(move || {
                            commands::singbox::toggle_core_slot_from_tray(&handle_clone, "stable");
                        });
                    }
                    "toggle_core_working" => {
                        let handle_clone = app_handle.clone();
                        std::thread::spawn(move || {
                            commands::singbox::toggle_core_slot_from_tray(&handle_clone, "working");
                        });
                    }
                    "quit_app" => {
                        commands::singbox::stop_managed_singbox_slot(Some(app_handle), None);
                        app_handle.exit(0);
                    }
                    _ => {}
                });

            if let Some(default_icon) = app.default_window_icon() {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.set_icon(default_icon.clone());
                }
                if use_mono {
                    // Initial state is stopped (`is_running = false`) -> dimmed 42% alpha template icon
                    let (rgba, w, h) =
                        commands::ui_config::build_monochrome_tray_icon_rgba_with_state(false);
                    tray_builder = tray_builder
                        .icon(Image::new_owned(rgba, w, h))
                        .icon_as_template(true);
                } else {
                    tray_builder = tray_builder
                        .icon(default_icon.clone())
                        .icon_as_template(false);
                }
            }

            let _ = tray_builder.build(app)?;
            // Populate the full tray menu (Show Panel, Launch Core Stable/Working with port & config details, Quit)
            commands::singbox::refresh_tray_menu_and_icon(handle);
            Ok(())
        })
        // Decouple GUI window from Core lifecycle:
        // Clicking the top-left red close button (`CloseRequested`) hides the panel instead of quitting the app or killing sing-box.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::subscription::fetch_subscription_url,
            commands::singbox_binary::check_binary_status,
            commands::singbox_binary::import_singbox_binary_cmd,
            commands::singbox_binary::open_config_folder_cmd,
            commands::singbox::validate_singbox_config_cmd,
            commands::singbox::start_singbox_service_cmd,
            commands::singbox::stop_singbox_service_cmd,
            commands::singbox::get_singbox_service_status_cmd,
            commands::ui_config::get_ui_config_cmd,
            commands::ui_config::save_ui_config_cmd,
            commands::ui_config::set_tray_icon_style_cmd,
            commands::mitm::sniff_mitm_port,
            commands::mitm::toggle_mitm_listener,
            commands::mitm::check_port_availability,
            commands::mitm::run_connectivity_test_cmd,
            commands::cert::import_ca_cert,
            commands::cert::generate_self_signed_ca,
        ])
        .build(tauri::generate_context!())
        .expect("error while building SingboxGUIV0 tauri application");

    app.run(|app_handle, event| {
        match event {
            // Prevent Tauri from exiting when all GUI windows are hidden/closed so the Tray and Core stay alive
            RunEvent::ExitRequested { api, code, .. } => {
                if code.is_none() {
                    api.prevent_exit();
                } else {
                    commands::singbox::stop_managed_singbox_slot(Some(app_handle), None);
                }
            }
            // Safely terminate our owned sing-box cores when the app truly exits (Quit or cargo/tauri dev hot-reload)
            RunEvent::Exit => {
                commands::singbox::stop_managed_singbox_slot(Some(app_handle), None);
            }
            _ => {}
        }
    });
}
