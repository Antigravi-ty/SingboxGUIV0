use crate::commands::singbox_binary::inspect_singbox_config_content;
use crate::paths::{
    default_singbox_config_path, default_surge_config_path, resolve_app_config_dir,
    resolve_singbox_binary,
};
use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

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

fn spawn_batched_log_reader<R: std::io::Read + Send + 'static>(
    stream: R,
    logs_buf: Arc<Mutex<Vec<String>>>,
    app_handle: AppHandle,
) {
    let pending: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
    let pending_reader = Arc::clone(&pending);
    let app_for_flusher = app_handle.clone();

    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(100));
        let batch = if let Ok(mut p) = pending.lock() {
            std::mem::take(&mut *p)
        } else {
            break;
        };
        if !batch.is_empty() {
            let _ = app_for_flusher.emit("singbox-log-batch", &batch);
        }
    });

    std::thread::spawn(move || {
        let reader = BufReader::new(stream);
        let mut last_emit = Instant::now();
        for line in reader.lines().map_while(Result::ok) {
            if let Ok(mut buf) = logs_buf.lock() {
                if buf.len() >= 300 {
                    buf.remove(0);
                }
                buf.push(line.clone());
            }
            if let Ok(mut p) = pending_reader.lock() {
                p.push(line);
                if p.len() >= 40 || last_emit.elapsed() >= Duration::from_millis(100) {
                    let batch = std::mem::take(&mut *p);
                    let _ = app_handle.emit("singbox-log-batch", &batch);
                    last_emit = Instant::now();
                }
            }
        }
        if let Ok(mut p) = pending_reader.lock() {
            if !p.is_empty() {
                let batch = std::mem::take(&mut *p);
                let _ = app_handle.emit("singbox-log-batch", &batch);
            }
        }
    });
}

fn spawn_singbox_process_internal(
    app: &AppHandle,
    bin_path: &PathBuf,
    config_dir: &PathBuf,
    singbox_cfg: &PathBuf,
    listen_address: &str,
) -> Result<(u32, Vec<String>), String> {
    stop_managed_singbox_process();
    std::thread::sleep(Duration::from_millis(80));

    let mut child = Command::new(bin_path)
        .args(["run", "-c"])
        .arg(singbox_cfg)
        .current_dir(config_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn sing-box run -c {}: {}", singbox_cfg.display(), e))?;

    let pid = child.id();
    let logs: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
    if let Some(stdout) = child.stdout.take() {
        spawn_batched_log_reader(stdout, Arc::clone(&logs), app.clone());
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_batched_log_reader(stderr, Arc::clone(&logs), app.clone());
    }

    std::thread::sleep(Duration::from_millis(220));
    if let Ok(Some(exit_status)) = child.try_wait() {
        let captured = logs.lock().map(|b| b.join("\n")).unwrap_or_default();
        let detail = if captured.trim().is_empty() {
            "Check port conflict or outbound parameters"
        } else {
            captured.trim()
        };
        return Err(format!("sing-box exited immediately ({}): {}", exit_status, detail));
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
pub async fn validate_singbox_config_cmd(
    app: AppHandle,
    config_content: String,
    surge_content: Option<String>,
) -> Result<SingboxValidationResponse, String> {
    tokio::task::spawn_blocking(move || {
        let dir = resolve_app_config_dir(&app)?;
        let singbox_cfg = default_singbox_config_path(&app)?;
        let surge_cfg = default_surge_config_path(&app)?;

        std::fs::write(&singbox_cfg, &config_content)
            .map_err(|e| format!("Failed to write {}: {}", singbox_cfg.display(), e))?;
        if let Some(ref surge_txt) = surge_content {
            let _ = std::fs::write(&surge_cfg, surge_txt);
        }

        let summary = inspect_singbox_config_content(&dir, &singbox_cfg, &surge_cfg, &config_content);
        let bin_path = resolve_singbox_binary(&app);
        if !bin_path.is_file() {
            return Err(format!(
                "BINARY_NOT_FOUND: Synced config.json ({} proxy outbounds, {} SOCKS5 users) to {}, but sing-box binary is not imported yet.",
                summary.proxy_outbound_count, summary.socks_user_count, singbox_cfg.display()
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
            .args(["check", "-c"])
            .arg(&singbox_cfg)
            .output()
            .map_err(|e| format!("BINARY_NOT_FOUND: Failed to invoke sing-box check: {}", e))?;

        let combined = format!(
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        )
        .trim()
        .to_string();
        let check_ok = output.status.success();

        let was_running = service_slot()
            .lock()
            .ok()
            .and_then(|mut g| g.as_mut().and_then(|p| p.child.try_wait().ok()).flatten().is_none().then_some(true))
            .unwrap_or(false)
            && service_slot().lock().map(|g| g.is_some()).unwrap_or(false);

        let mut service_reloaded = false;
        if was_running && check_ok && !summary.empty_workspace {
            if spawn_singbox_process_internal(&app, &bin_path, &dir, &singbox_cfg, &summary.listen_address).is_ok() {
                service_reloaded = true;
            }
        }

        let formatted_output = if !check_ok {
            combined
        } else if summary.empty_workspace {
            format!(
                "EMPTY_WORKSPACE: {} syntax check passed (0 errors), but it currently contains 0 proxy nodes (only 'direct' outbound, 0 SOCKS5 users).",
                singbox_cfg.display()
            )
        } else {
            format!(
                "sing-box check -c {} passed (0 errors) — Active contents: {} proxy outbounds ({} SOCKS5 users on {}, {} dynamic pools, {} DNS servers, {} bytes){}.",
                singbox_cfg.display(),
                summary.proxy_outbound_count,
                summary.socks_user_count,
                summary.listen_address,
                summary.urltest_pool_count,
                summary.dns_server_count,
                summary.file_size_bytes,
                if service_reloaded { " [Hot-reloaded running sing-box service]" } else { "" }
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
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn start_singbox_service_cmd(
    app: AppHandle,
    config_content: String,
    surge_content: Option<String>,
) -> Result<SingboxServiceStatusResponse, String> {
    tokio::task::spawn_blocking(move || {
        let dir = resolve_app_config_dir(&app)?;
        let singbox_cfg = default_singbox_config_path(&app)?;
        let surge_cfg = default_surge_config_path(&app)?;

        std::fs::write(&singbox_cfg, &config_content)
            .map_err(|e| format!("Failed to write {}: {}", singbox_cfg.display(), e))?;
        if let Some(ref surge_txt) = surge_content {
            let _ = std::fs::write(&surge_cfg, surge_txt);
        }

        let summary = inspect_singbox_config_content(&dir, &singbox_cfg, &surge_cfg, &config_content);
        let bin_path = resolve_singbox_binary(&app);
        if !bin_path.is_file() {
            return Err(format!("sing-box binary not found at {}. Import binary first.", bin_path.display()));
        }

        let check_out = Command::new(&bin_path)
            .args(["check", "-c"])
            .arg(&singbox_cfg)
            .output()
            .map_err(|e| format!("Failed to execute sing-box check: {}", e))?;

        if !check_out.status.success() {
            let err_msg = format!(
                "{}{}",
                String::from_utf8_lossy(&check_out.stdout),
                String::from_utf8_lossy(&check_out.stderr)
            );
            return Err(format!("sing-box check -c {} failed: {}", singbox_cfg.display(), err_msg.trim()));
        }

        let (pid, initial_logs) =
            spawn_singbox_process_internal(&app, &bin_path, &dir, &singbox_cfg, &summary.listen_address)?;

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
                pid, singbox_cfg.display(), summary.listen_address, summary.proxy_outbound_count, summary.socks_user_count
            ),
            recent_logs: initial_logs,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn stop_singbox_service_cmd(app: AppHandle) -> Result<SingboxServiceStatusResponse, String> {
    tokio::task::spawn_blocking(move || {
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
                Some(pid) => format!("Stopped sing-box service (PID {}) on {}.", pid, last_addr),
                None => "Sing-box service is already stopped.".to_string(),
            },
            recent_logs: Vec::new(),
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn get_singbox_service_status_cmd(
    app: AppHandle,
) -> Result<SingboxServiceStatusResponse, String> {
    tokio::task::spawn_blocking(move || {
        let dir = resolve_app_config_dir(&app)?;
        let singbox_cfg = default_singbox_config_path(&app)?;
        let surge_cfg = default_surge_config_path(&app)?;
        let bin_path = resolve_singbox_binary(&app);

        if let Ok(mut guard) = service_slot().lock() {
            if let Some(ref mut proc) = *guard {
                if let Ok(None) = proc.child.try_wait() {
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
                *guard = None;
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
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
