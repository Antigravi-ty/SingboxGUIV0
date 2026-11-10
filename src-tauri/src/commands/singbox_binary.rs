use crate::commands::singbox::ConfigInspectSummary;
use crate::paths::{
    candidate_singbox_paths, default_managed_binary_path, default_singbox_config_path,
    default_surge_config_path, ensure_executable_permissions, resolve_app_config_dir,
    resolve_singbox_binary,
};
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use std::process::Command;
use tauri::AppHandle;

#[derive(Serialize)]
pub struct BinaryStatusInfo {
    pub imported: bool,
    pub binary_name: String,
    pub binary_path: String,
    pub managed_binary_path: String,
    pub config_dir: String,
    pub singbox_config_path: String,
    pub surge_config_path: String,
    pub file_size: u64,
    pub version: Option<String>,
    pub searched_paths: Vec<String>,
}

pub fn inspect_singbox_config_content(
    config_dir: &PathBuf,
    singbox_cfg_path: &PathBuf,
    surge_cfg_path: &PathBuf,
    content: &str,
) -> ConfigInspectSummary {
    let parsed: Value = serde_json::from_str(content).unwrap_or(Value::Null);
    let outbounds = parsed
        .get("outbounds")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let total_outbounds = outbounds.len();
    let mut proxy_outbound_count = 0usize;
    let mut urltest_pool_count = 0usize;

    for ob in &outbounds {
        let ob_type = ob.get("type").and_then(|t| t.as_str()).unwrap_or("");
        match ob_type {
            "direct" | "block" | "dns" => {}
            "urltest" | "selector" => {
                urltest_pool_count += 1;
            }
            _ => {
                proxy_outbound_count += 1;
            }
        }
    }

    let first_inbound = parsed
        .get("inbounds")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first());

    let socks_user_count = first_inbound
        .and_then(|ib| ib.get("users"))
        .and_then(|u| u.as_array())
        .map(|a| a.len())
        .unwrap_or(0);

    let listen_ip = first_inbound
        .and_then(|ib| ib.get("listen"))
        .and_then(|v| v.as_str())
        .unwrap_or("127.0.0.1");
    let listen_port = first_inbound
        .and_then(|ib| ib.get("listen_port"))
        .and_then(|v| v.as_u64())
        .unwrap_or(11400);

    let dns_server_count = parsed
        .get("dns")
        .and_then(|d| d.get("servers"))
        .and_then(|s| s.as_array())
        .map(|a| a.len())
        .unwrap_or(0);

    let file_size_bytes = std::fs::metadata(singbox_cfg_path)
        .map(|m| m.len())
        .unwrap_or(content.len() as u64);

    ConfigInspectSummary {
        config_dir: config_dir.to_string_lossy().to_string(),
        singbox_config_path: singbox_cfg_path.to_string_lossy().to_string(),
        surge_config_path: surge_cfg_path.to_string_lossy().to_string(),
        total_outbounds,
        proxy_outbound_count,
        urltest_pool_count,
        socks_user_count,
        dns_server_count,
        listen_address: format!("{}:{}", listen_ip, listen_port),
        file_size_bytes,
        empty_workspace: proxy_outbound_count == 0,
    }
}

fn decode_base64_clean(input: &str) -> Result<Vec<u8>, String> {
    const TABLE: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut lut = [255u8; 256];
    for (i, &b) in TABLE.iter().enumerate() {
        lut[b as usize] = i as u8;
    }

    let cleaned: Vec<u8> = input
        .bytes()
        .filter(|&b| !b.is_ascii_whitespace() && b != b'=')
        .collect();

    let mut out = Vec::with_capacity(cleaned.len() * 3 / 4);
    let mut buf = 0u32;
    let mut bits = 0u8;
    for b in cleaned {
        let val = lut[b as usize];
        if val == 255 {
            return Err("Invalid base64 character in binary payload".to_string());
        }
        buf = (buf << 6) | (val as u32);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push(((buf >> bits) & 0xFF) as u8);
        }
    }
    Ok(out)
}

pub fn check_binary_status_sync(app: &AppHandle) -> Result<BinaryStatusInfo, String> {
    let config_dir = resolve_app_config_dir(app)?;
    let singbox_cfg = default_singbox_config_path(app)?;
    let surge_cfg = default_surge_config_path(app)?;
    let managed_bin = default_managed_binary_path(app)?;
    let bin_path = resolve_singbox_binary(app);

    let searched_paths: Vec<String> = candidate_singbox_paths(app)
        .into_iter()
        .take(8)
        .map(|p| p.to_string_lossy().to_string())
        .collect();

    if !bin_path.is_file() {
        return Ok(BinaryStatusInfo {
            imported: false,
            binary_name: "sing-box".to_string(),
            binary_path: bin_path.to_string_lossy().to_string(),
            managed_binary_path: managed_bin.to_string_lossy().to_string(),
            config_dir: config_dir.to_string_lossy().to_string(),
            singbox_config_path: singbox_cfg.to_string_lossy().to_string(),
            surge_config_path: surge_cfg.to_string_lossy().to_string(),
            file_size: 0,
            version: None,
            searched_paths,
        });
    }

    let file_size = std::fs::metadata(&bin_path).map(|m| m.len()).unwrap_or(0);
    let version = Command::new(&bin_path)
        .arg("version")
        .output()
        .ok()
        .and_then(|out| String::from_utf8(out.stdout).ok())
        .and_then(|s| {
            s.lines()
                .next()
                .map(|l| l.replace("sing-box version ", "").trim().to_string())
        });

    Ok(BinaryStatusInfo {
        imported: version.is_some() || file_size > 0,
        binary_name: "sing-box".to_string(),
        binary_path: bin_path.to_string_lossy().to_string(),
        managed_binary_path: managed_bin.to_string_lossy().to_string(),
        config_dir: config_dir.to_string_lossy().to_string(),
        singbox_config_path: singbox_cfg.to_string_lossy().to_string(),
        surge_config_path: surge_cfg.to_string_lossy().to_string(),
        file_size,
        version,
        searched_paths,
    })
}

#[tauri::command]
pub async fn check_binary_status(app: AppHandle) -> Result<BinaryStatusInfo, String> {
    tokio::task::spawn_blocking(move || check_binary_status_sync(&app))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn import_singbox_binary_cmd(
    app: AppHandle,
    source_path: Option<String>,
    base64_data: Option<String>,
) -> Result<BinaryStatusInfo, String> {
    tokio::task::spawn_blocking(move || {
        let managed_bin = default_managed_binary_path(&app)?;

        if let Some(src) = source_path.filter(|s| !s.trim().is_empty()) {
            let src_path = PathBuf::from(src.trim());
            if !src_path.is_file() {
                return Err(format!(
                    "Selected file does not exist: {}",
                    src_path.to_string_lossy()
                ));
            }
            if src_path != managed_bin {
                std::fs::copy(&src_path, &managed_bin).map_err(|e| {
                    format!(
                        "Failed to copy binary to Application Support ({}): {}",
                        managed_bin.to_string_lossy(),
                        e
                    )
                })?;
            }
        } else if let Some(b64) = base64_data.filter(|s| !s.trim().is_empty()) {
            let bytes = decode_base64_clean(&b64)?;
            if bytes.len() < 1024 {
                return Err(
                    "Uploaded file is too small to be a valid sing-box binary.".to_string()
                );
            }
            std::fs::write(&managed_bin, &bytes).map_err(|e| {
                format!(
                    "Failed to write binary to Application Support ({}): {}",
                    managed_bin.to_string_lossy(),
                    e
                )
            })?;
        } else {
            return Err("Provide either a local file path or uploaded binary file.".to_string());
        }

        ensure_executable_permissions(&managed_bin);

        let ver_check = Command::new(&managed_bin)
            .arg("version")
            .output()
            .map_err(|e| {
                format!(
                    "Imported file at {} is not executable on this OS/arch: {}",
                    managed_bin.to_string_lossy(),
                    e
                )
            })?;

        if !ver_check.status.success() {
            let stderr = String::from_utf8_lossy(&ver_check.stderr);
            return Err(format!(
                "sing-box version check failed on imported binary: {}",
                stderr.trim()
            ));
        }

        check_binary_status_sync(&app)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn open_config_folder_cmd(app: AppHandle) -> Result<ConfigInspectSummary, String> {
    tokio::task::spawn_blocking(move || {
        let dir = resolve_app_config_dir(&app)?;
        let singbox_cfg = default_singbox_config_path(&app)?;
        let surge_cfg = default_surge_config_path(&app)?;

        let content = if singbox_cfg.is_file() {
            std::fs::read_to_string(&singbox_cfg).unwrap_or_default()
        } else {
            String::new()
        };

        #[cfg(target_os = "macos")]
        {
            let _ = Command::new("open").arg(&dir).spawn();
        }
        #[cfg(target_os = "windows")]
        {
            let _ = Command::new("explorer").arg(&dir).spawn();
        }
        #[cfg(all(unix, not(target_os = "macos")))]
        {
            let _ = Command::new("xdg-open").arg(&dir).spawn();
        }

        Ok(inspect_singbox_config_content(
            &dir,
            &singbox_cfg,
            &surge_cfg,
            &content,
        ))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
