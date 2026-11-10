use crate::paths::{resolve_app_config_dir, resolve_singbox_binary};
use serde::Serialize;
use std::process::Command;
use tauri::AppHandle;

#[derive(Serialize)]
pub struct BinaryStatusInfo {
    pub imported: bool,
    pub binary_name: String,
    pub binary_path: String,
    pub file_size: u64,
    pub version: Option<String>,
}

#[derive(Serialize)]
pub struct SingboxValidationResponse {
    pub valid: bool,
    pub version: String,
    pub output: String,
}

#[tauri::command]
pub fn check_binary_status(app: AppHandle) -> Result<BinaryStatusInfo, String> {
    let bin_path = resolve_singbox_binary(&app);
    if !bin_path.exists() {
        return Ok(BinaryStatusInfo {
            imported: false,
            binary_name: "sing-box".to_string(),
            binary_path: bin_path.to_string_lossy().to_string(),
            file_size: 0,
            version: None,
        });
    }

    let file_size = std::fs::metadata(&bin_path).map(|m| m.len()).unwrap_or(0);
    let version = Command::new(&bin_path)
        .arg("version")
        .output()
        .ok()
        .and_then(|out| String::from_utf8(out.stdout).ok())
        .and_then(|s| s.lines().next().map(|l| l.trim().to_string()));

    Ok(BinaryStatusInfo {
        imported: true,
        binary_name: "sing-box".to_string(),
        binary_path: bin_path.to_string_lossy().to_string(),
        file_size,
        version,
    })
}

#[tauri::command]
pub fn validate_singbox_config_cmd(
    app: AppHandle,
    config_content: String,
) -> Result<SingboxValidationResponse, String> {
    let bin_path = resolve_singbox_binary(&app);
    let dir = resolve_app_config_dir(&app)?;
    let temp_cfg = dir.join("check_config.json");
    std::fs::write(&temp_cfg, &config_content)
        .map_err(|e| format!("Failed to write temporary config.json: {}", e))?;

    let version_str = Command::new(&bin_path)
        .arg("version")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.lines().next().map(|l| l.trim().to_string()))
        .unwrap_or_else(|| "sing-box 1.14.4".to_string());

    let output = Command::new(&bin_path)
        .arg("check")
        .arg("-c")
        .arg(&temp_cfg)
        .output()
        .map_err(|e| format!("Failed to invoke sing-box check: {}", e))?;

    let _ = std::fs::remove_file(&temp_cfg);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}{}", stdout, stderr).trim().to_string();

    Ok(SingboxValidationResponse {
        valid: output.status.success(),
        version: version_str,
        output: if combined.is_empty() {
            "sing-box check -c config.json passed with 0 errors.".to_string()
        } else {
            combined
        },
    })
}
