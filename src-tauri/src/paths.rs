use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub fn resolve_app_config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve app_config_dir: {}", e))?;
    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create app_config_dir: {}", e))?;
    }
    Ok(dir)
}

pub fn resolve_singbox_binary(app: &AppHandle) -> PathBuf {
    if let Ok(dir) = resolve_app_config_dir(app) {
        let local_bin = if cfg!(target_os = "windows") {
            dir.join("sing-box.exe")
        } else {
            dir.join("sing-box")
        };
        if local_bin.exists() {
            return local_bin;
        }
    }
    PathBuf::from("/usr/local/bin/sing-box")
}
