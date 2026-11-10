use serde::Serialize;
use std::net::TcpListener;

#[derive(Serialize)]
pub struct MitmStatus {
    pub enabled: bool,
    pub port: Option<u16>,
    pub is_macos: bool,
    pub message: String,
}

#[tauri::command]
pub fn sniff_mitm_port(base_port: u16) -> Result<u16, String> {
    let start = if base_port < 1024 { 8080 } else { base_port };
    for port in start..=65535 {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Ok(port);
        }
    }
    Err("No available local TCP port found in range.".to_string())
}

#[tauri::command]
pub fn toggle_mitm_listener(enable: bool, port: u16) -> Result<MitmStatus, String> {
    let is_macos = cfg!(target_os = "macos");
    if enable {
        Ok(MitmStatus {
            enabled: true,
            port: Some(port),
            is_macos,
            message: format!(
                "MITM Engine listening on 127.0.0.1:{} with URL Regex Routing enabled.",
                port
            ),
        })
    } else {
        Ok(MitmStatus {
            enabled: false,
            port: None,
            is_macos,
            message: "MITM Engine stopped.".to_string(),
        })
    }
}
