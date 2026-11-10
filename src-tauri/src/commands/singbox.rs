use crate::paths::{
    candidate_singbox_paths, default_managed_binary_path, default_singbox_config_path,
    default_surge_config_path, ensure_executable_permissions, resolve_app_config_dir,
    resolve_singbox_binary,
};
use serde::Serialize;
use serde_json::Value;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tauri::AppHandle;

#[derive(Serialize, Clone)]
pub struct ConfigInspectSummary {
    pub config_dir: String,
    pub singbox_config_path: String,
    pub surge_config_path: String,
    pub total_outbounds: usize,
    pub proxy_outbound_count: usize,
    pub urltest_pool_count: usize,
    pub socks_user_count: usize,
    pub dns_server_count: usize,
    pub listen_address: String,
    pub file_size_bytes: u64,
    pub empty_workspace: bool,
}

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

#[derive(Serialize)]
pub struct SingboxValidationResponse {
    pub valid: bool,
    pub version: String,
    pub output: String,
    pub binary_found: bool,
    pub binary_path: String,
    pub config_dir: String,
    pub singbox_config_path: String,
    pub surge_config_path: String,
    pub summary: ConfigInspectSummary,
    pub service_reloaded: bool,
}

#[derive(Serialize)]
pub struct SingboxServiceStatusResponse {
    pub running: bool,
    pub pid: Option<u32>,
    pub binary_path: String,
    pub config_path: String,
    pub surge_config_path: String,
    pub config_dir: String,
    pub listen_address: String,
    pub message: String,
    pub recent_logs: Vec<String>,
}

struct ManagedSingboxProcess {
    child: Child,
    pid: u32,
    binary_path: String,
    config_path: String,
    listen_address: String,
    logs: Arc<Mutex<Vec<String>>>,
}

static MANAGED_SINGBOX: OnceLock<Mutex<Option<ManagedSingboxProcess>>> = OnceLock::new();

fn service_slot() -> &'static Mutex<Option<ManagedSingboxProcess>> {
    MANAGED_SINGBOX.get_or_init(|| Mutex::new(None))
}

pub fn stop_managed_singbox_process() {
    if let Ok(mut guard) = service_slot().lock() {
        if let Some(mut proc) = guard.take() {
            let _ = proc.child.kill();
            let _ = proc.child.wait();
        }
    }
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

#[tauri::command]
pub fn check_binary_status(app: AppHandle) -> Result<BinaryStatusInfo, String> {
    let config_dir = resolve_app_config_dir(&app)?;
    let singbox_cfg = default_singbox_config_path(&app)?;
    let surge_cfg = default_surge_config_path(&app)?;
    let managed_bin = default_managed_binary_path(&app)?;
    let bin_path = resolve_singbox_binary(&app);

    let searched_paths: Vec<String> = candidate_singbox_paths(&app)
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
pub fn import_singbox_binary_cmd(
    app: AppHandle,
    source_path: Option<String>,
    base64_data: Option<String>,
) -> Result<BinaryStatusInfo, String> {
    let managed_bin = default_managed_binary_path(&app)?;

    if let Some(src) = source_path.filter(|s| !s.trim().is_empty()) {
        let src_path = PathBuf::from(src.trim());
        if !src_path.is_file() {
            return Err(format!("Selected file does not exist: {}", src_path.to_string_lossy()));
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
            return Err("Uploaded file is too small to be a valid sing-box binary.".to_string());
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
        .map_err(|e| format!("Imported file at {} is not executable on this OS/arch: {}", managed_bin.to_string_lossy(), e))?;

    if !ver_check.status.success() {
        let stderr = String::from_utf8_lossy(&ver_check.stderr);
        return Err(format!(
            "sing-box version check failed on imported binary: {}",
            stderr.trim()
        ));
    }

    check_binary_status(app)
}

#[tauri::command]
pub fn open_config_folder_cmd(app: AppHandle) -> Result<ConfigInspectSummary, String> {
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
}

fn spawn_singbox_process_internal(
    bin_path: &PathBuf,
    config_dir: &PathBuf,
    singbox_cfg: &PathBuf,
    listen_address: &str,
) -> Result<(u32, Vec<String>), String> {
    stop_managed_singbox_process();
    std::thread::sleep(Duration::from_millis(120));

    let mut child = Command::new(bin_path)
        .arg("run")
        .arg("-c")
        .arg(singbox_cfg)
        .current_dir(config_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn sing-box run -c {}: {}", singbox_cfg.to_string_lossy(), e))?;

    let pid = child.id();
    let logs: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));

    if let Some(stdout) = child.stdout.take() {
        let logs_clone = Arc::clone(&logs);
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().map_while(Result::ok) {
                if let Ok(mut buf) = logs_clone.lock() {
                    if buf.len() >= 250 {
                        buf.remove(0);
                    }
                    buf.push(line);
                }
            }
        });
    }

    if let Some(stderr) = child.stderr.take() {
        let logs_clone = Arc::clone(&logs);
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                if let Ok(mut buf) = logs_clone.lock() {
                    if buf.len() >= 250 {
                        buf.remove(0);
                    }
                    buf.push(line);
                }
            }
        });
    }

    std::thread::sleep(Duration::from_millis(320));

    if let Ok(Some(exit_status)) = child.try_wait() {
        let captured = logs
            .lock()
            .map(|b| b.join("\n"))
            .unwrap_or_else(|_| "Process exited immediately".to_string());
        return Err(format!(
            "sing-box exited immediately ({}): {}",
            exit_status,
            if captured.trim().is_empty() {
                "Check port conflict or outbound parameters"
            } else {
                captured.trim()
            }
        ));
    }

    let initial_logs = logs.lock().map(|b| b.clone()).unwrap_or_default();

    if let Ok(mut guard) = service_slot().lock() {
        *guard = Some(ManagedSingboxProcess {
            child,
            pid,
            binary_path: bin_path.to_string_lossy().to_string(),
            config_path: singbox_cfg.to_string_lossy().to_string(),
            listen_address: listen_address.to_string(),
            logs,
        });
    }

    Ok((pid, initial_logs))
}

#[tauri::command]
pub fn validate_singbox_config_cmd(
    app: AppHandle,
    config_content: String,
    surge_content: Option<String>,
) -> Result<SingboxValidationResponse, String> {
    let dir = resolve_app_config_dir(&app)?;
    let singbox_cfg = default_singbox_config_path(&app)?;
    let surge_cfg = default_surge_config_path(&app)?;

    // Always persist config.json and aSingbox127.conf to Application Support directory
    std::fs::write(&singbox_cfg, &config_content)
        .map_err(|e| format!("Failed to write {}: {}", singbox_cfg.to_string_lossy(), e))?;

    if let Some(ref surge_txt) = surge_content {
        let _ = std::fs::write(&surge_cfg, surge_txt);
    }

    let summary = inspect_singbox_config_content(&dir, &singbox_cfg, &surge_cfg, &config_content);
    let bin_path = resolve_singbox_binary(&app);

    if !bin_path.is_file() {
        return Err(format!(
            "BINARY_NOT_FOUND: Synced config.json ({} proxy outbounds, {} SOCKS5 users) to {}, but sing-box binary is not imported yet.",
            summary.proxy_outbound_count,
            summary.socks_user_count,
            singbox_cfg.to_string_lossy()
        ));
    }

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
        .arg(&singbox_cfg)
        .output()
        .map_err(|e| format!("BINARY_NOT_FOUND: Failed to invoke sing-box check: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{}{}", stdout, stderr).trim().to_string();
    let check_ok = output.status.success();

    // If service is already running and config has proxy nodes, hot-reload the running process
    let mut service_reloaded = false;
    let was_running = service_slot()
        .lock()
        .ok()
        .and_then(|mut g| {
            if let Some(ref mut proc) = *g {
                if let Ok(None) = proc.child.try_wait() {
                    return Some(true);
                }
            }
            None
        })
        .unwrap_or(false);

    if was_running && check_ok && !summary.empty_workspace {
        if spawn_singbox_process_internal(&bin_path, &dir, &singbox_cfg, &summary.listen_address)
            .is_ok()
        {
            service_reloaded = true;
        }
    }

    let formatted_output = if !check_ok {
        combined
    } else if summary.empty_workspace {
        format!(
            "EMPTY_WORKSPACE: {} syntax check passed (0 errors), but it currently contains 0 proxy nodes (only 'direct' outbound, 0 SOCKS5 users). Import or enable a subscription to populate nodes.",
            singbox_cfg.to_string_lossy()
        )
    } else {
        format!(
            "sing-box check -c {} passed (0 errors) — Active contents: {} proxy outbounds ({} SOCKS5 users on {}, {} dynamic pools, {} DNS servers, {} bytes){}.",
            singbox_cfg.to_string_lossy(),
            summary.proxy_outbound_count,
            summary.socks_user_count,
            summary.listen_address,
            summary.urltest_pool_count,
            summary.dns_server_count,
            summary.file_size_bytes,
            if service_reloaded {
                " [Hot-reloaded running sing-box service]"
            } else {
                ""
            }
        )
    };

    Ok(SingboxValidationResponse {
        valid: check_ok,
        version: version_str,
        output: formatted_output,
        binary_found: true,
        binary_path: bin_path.to_string_lossy().to_string(),
        config_dir: summary.config_dir.clone(),
        singbox_config_path: summary.singbox_config_path.clone(),
        surge_config_path: summary.surge_config_path.clone(),
        summary,
        service_reloaded,
    })
}

#[tauri::command]
pub fn start_singbox_service_cmd(
    app: AppHandle,
    config_content: String,
    surge_content: Option<String>,
) -> Result<SingboxServiceStatusResponse, String> {
    let dir = resolve_app_config_dir(&app)?;
    let singbox_cfg = default_singbox_config_path(&app)?;
    let surge_cfg = default_surge_config_path(&app)?;

    std::fs::write(&singbox_cfg, &config_content)
        .map_err(|e| format!("Failed to write {}: {}", singbox_cfg.to_string_lossy(), e))?;
    if let Some(ref surge_txt) = surge_content {
        let _ = std::fs::write(&surge_cfg, surge_txt);
    }

    let summary = inspect_singbox_config_content(&dir, &singbox_cfg, &surge_cfg, &config_content);
    let bin_path = resolve_singbox_binary(&app);
    if !bin_path.is_file() {
        return Err(format!(
            "sing-box binary not found at {}. Import the sing-box binary first.",
            bin_path.to_string_lossy()
        ));
    }

    let check_out = Command::new(&bin_path)
        .arg("check")
        .arg("-c")
        .arg(&singbox_cfg)
        .output()
        .map_err(|e| format!("Failed to execute sing-box check: {}", e))?;

    if !check_out.status.success() {
        let err_msg = format!(
            "{}{}",
            String::from_utf8_lossy(&check_out.stdout),
            String::from_utf8_lossy(&check_out.stderr)
        );
        return Err(format!(
            "sing-box check -c {} failed: {}",
            singbox_cfg.to_string_lossy(),
            err_msg.trim()
        ));
    }

    let (pid, initial_logs) =
        spawn_singbox_process_internal(&bin_path, &dir, &singbox_cfg, &summary.listen_address)?;

    Ok(SingboxServiceStatusResponse {
        running: true,
        pid: Some(pid),
        binary_path: bin_path.to_string_lossy().to_string(),
        config_path: singbox_cfg.to_string_lossy().to_string(),
        surge_config_path: surge_cfg.to_string_lossy().to_string(),
        config_dir: dir.to_string_lossy().to_string(),
        listen_address: summary.listen_address.clone(),
        message: format!(
            "Started sing-box (PID {}) with -c {} on {} ({} proxy outbounds, {} SOCKS5 users).",
            pid,
            singbox_cfg.to_string_lossy(),
            summary.listen_address,
            summary.proxy_outbound_count,
            summary.socks_user_count
        ),
        recent_logs: initial_logs,
    })
}

#[tauri::command]
pub fn stop_singbox_service_cmd(app: AppHandle) -> Result<SingboxServiceStatusResponse, String> {
    let dir = resolve_app_config_dir(&app)?;
    let singbox_cfg = default_singbox_config_path(&app)?;
    let surge_cfg = default_surge_config_path(&app)?;
    let bin_path = resolve_singbox_binary(&app);

    let mut stopped_pid = None;
    let mut last_addr = "127.0.0.1:11400".to_string();
    if let Ok(mut guard) = service_slot().lock() {
        if let Some(mut proc) = guard.take() {
            stopped_pid = Some(proc.pid);
            last_addr = proc.listen_address.clone();
            let _ = proc.child.kill();
            let _ = proc.child.wait();
        }
    }

    Ok(SingboxServiceStatusResponse {
        running: false,
        pid: None,
        binary_path: bin_path.to_string_lossy().to_string(),
        config_path: singbox_cfg.to_string_lossy().to_string(),
        surge_config_path: surge_cfg.to_string_lossy().to_string(),
        config_dir: dir.to_string_lossy().to_string(),
        listen_address: last_addr.clone(),
        message: match stopped_pid {
            Some(pid) => format!(
                "Stopped sing-box service (PID {}) on {}.",
                pid, last_addr
            ),
            None => "Sing-box service is already stopped.".to_string(),
        },
        recent_logs: Vec::new(),
    })
}

#[tauri::command]
pub fn get_singbox_service_status_cmd(
    app: AppHandle,
) -> Result<SingboxServiceStatusResponse, String> {
    let dir = resolve_app_config_dir(&app)?;
    let singbox_cfg = default_singbox_config_path(&app)?;
    let surge_cfg = default_surge_config_path(&app)?;
    let bin_path = resolve_singbox_binary(&app);

    if let Ok(mut guard) = service_slot().lock() {
        if let Some(ref mut proc) = *guard {
            match proc.child.try_wait() {
                Ok(None) => {
                    let logs = proc.logs.lock().map(|b| b.clone()).unwrap_or_default();
                    return Ok(SingboxServiceStatusResponse {
                        running: true,
                        pid: Some(proc.pid),
                        binary_path: proc.binary_path.clone(),
                        config_path: proc.config_path.clone(),
                        surge_config_path: surge_cfg.to_string_lossy().to_string(),
                        config_dir: dir.to_string_lossy().to_string(),
                        listen_address: proc.listen_address.clone(),
                        message: format!(
                            "sing-box (PID {}) running on {} (-c {})",
                            proc.pid, proc.listen_address, proc.config_path
                        ),
                        recent_logs: logs,
                    });
                }
                _ => {
                    *guard = None;
                }
            }
        }
    }

    Ok(SingboxServiceStatusResponse {
        running: false,
        pid: None,
        binary_path: bin_path.to_string_lossy().to_string(),
        config_path: singbox_cfg.to_string_lossy().to_string(),
        surge_config_path: surge_cfg.to_string_lossy().to_string(),
        config_dir: dir.to_string_lossy().to_string(),
        listen_address: "127.0.0.1:11400".to_string(),
        message: "sing-box service is stopped.".to_string(),
        recent_logs: Vec::new(),
    })
}
