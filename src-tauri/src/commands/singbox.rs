use crate::commands::singbox_binary::inspect_singbox_config_content;
use crate::commands::ui_config::{apply_system_tray_icon_style_with_state, load_ui_config_sync};
use crate::paths::{
    default_singbox_config_path, default_surge_config_path, managed_pids_ledger_path,
    resolve_app_config_dir, resolve_singbox_binary, stable_singbox_config_path,
    stable_surge_config_path, working_singbox_config_path, working_surge_config_path,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
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
    pub stable_config_path: String,
    pub working_config_path: String,
    pub surge_config_path: String,
    pub summary: ConfigInspectSummary,
    pub service_reloaded: bool,
}

#[derive(Serialize, Clone)]
pub struct CoreSlotStatusInfo {
    pub profile: String,
    pub running: bool,
    pub pid: Option<u32>,
    pub config_path: String,
    pub surge_config_path: String,
    pub listen_address: String,
}

#[derive(Serialize)]
pub struct SingboxServiceStatusResponse {
    pub running: bool,
    pub pid: Option<u32>,
    pub active_profile: String,
    pub binary_path: String,
    pub config_path: String,
    pub stable_config_path: String,
    pub working_config_path: String,
    pub surge_config_path: String,
    pub config_dir: String,
    pub listen_address: String,
    pub message: String,
    pub recent_logs: Vec<String>,
    pub stable_slot: CoreSlotStatusInfo,
    pub working_slot: CoreSlotStatusInfo,
}

#[derive(Serialize, Deserialize, Clone)]
struct ManagedPidRecord {
    pid: u32,
    profile: String,
    config_path: String,
}

struct ManagedSingboxProcess {
    child: Child,
    pid: u32,
    profile: String,
    binary_path: String,
    config_path: String,
    listen_address: String,
    logs: Arc<Mutex<Vec<String>>>,
}

#[derive(Default)]
struct DualManagedSingboxSlots {
    stable: Option<ManagedSingboxProcess>,
    working: Option<ManagedSingboxProcess>,
}

static MANAGED_SINGBOX_SLOTS: OnceLock<Mutex<DualManagedSingboxSlots>> = OnceLock::new();

fn service_slots() -> &'static Mutex<DualManagedSingboxSlots> {
    MANAGED_SINGBOX_SLOTS.get_or_init(|| Mutex::new(DualManagedSingboxSlots::default()))
}

pub fn normalize_profile_name(profile: Option<&str>) -> &'static str {
    match profile.map(|s| s.trim().to_ascii_lowercase()) {
        Some(ref p) if p == "working" || p == "dynamic" || p == "test" => "working",
        _ => "stable",
    }
}

/// Rewrite the first inbound's `listen` and `listen_port` inside a Sing-box JSON string
/// so `config.stable.json` and `config.working.json` can bind to independent ports simultaneously.
pub fn rewrite_config_inbound_port(content: &str, listen_ip: &str, port: u16) -> String {
    if let Ok(mut parsed) = serde_json::from_str::<Value>(content) {
        if let Some(inbounds) = parsed.get_mut("inbounds").and_then(|v| v.as_array_mut()) {
            if let Some(first) = inbounds.first_mut().and_then(|v| v.as_object_mut()) {
                if !listen_ip.trim().is_empty() {
                    first.insert("listen".to_string(), Value::String(listen_ip.trim().to_string()));
                }
                first.insert("listen_port".to_string(), Value::Number(port.into()));
                if let Ok(serialized) = serde_json::to_string_pretty(&parsed) {
                    return serialized;
                }
            }
        }
    }
    content.to_string()
}

fn sync_pid_ledger_to_disk(app: &AppHandle, records: &[ManagedPidRecord]) {
    if let Ok(path) = managed_pids_ledger_path(app) {
        if let Ok(json_str) = serde_json::to_string_pretty(records) {
            let _ = std::fs::write(path, json_str);
        }
    }
}

/// Checks if a PID is an active `sing-box` process launched with one of our managed config paths
/// before sending SIGTERM/SIGKILL, preventing accidental termination of external sing-box instances.
fn verify_and_terminate_owned_pid(pid: u32, expected_config_path: &str) {
    if pid == 0 {
        return;
    }
    #[cfg(unix)]
    {
        let ps_out = Command::new("ps")
            .args(["-p", &pid.to_string(), "-o", "args="])
            .output();
        if let Ok(out) = ps_out {
            let cmdline = String::from_utf8_lossy(&out.stdout);
            let cmd_trimmed = cmdline.trim();
            if cmd_trimmed.contains("sing-box")
                && (expected_config_path.is_empty() || cmd_trimmed.contains(expected_config_path))
            {
                let _ = Command::new("kill")
                    .args(["-TERM", &pid.to_string()])
                    .output();
                std::thread::sleep(Duration::from_millis(60));
                let _ = Command::new("kill")
                    .args(["-KILL", &pid.to_string()])
                    .output();
            }
        }
    }
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output();
    }
}

/// Cleans up any orphaned sing-box processes from a previous abnormal termination or hot-reload
/// using our `managed-pids.json` ledger, verifying command-line arguments so we never kill other apps' cores.
pub fn cleanup_orphaned_managed_pids(app: &AppHandle) {
    if let Ok(path) = managed_pids_ledger_path(app) {
        if path.is_file() {
            if let Ok(raw) = std::fs::read_to_string(&path) {
                if let Ok(records) = serde_json::from_str::<Vec<ManagedPidRecord>>(&raw) {
                    for rec in records {
                        verify_and_terminate_owned_pid(rec.pid, &rec.config_path);
                    }
                }
            }
            let _ = std::fs::write(&path, "[]");
        }
    }
}

fn collect_active_pid_records(slots: &mut DualManagedSingboxSlots) -> Vec<ManagedPidRecord> {
    let mut records = Vec::new();
    if let Some(ref mut proc) = slots.stable {
        if let Ok(None) = proc.child.try_wait() {
            records.push(ManagedPidRecord {
                pid: proc.pid,
                profile: "stable".to_string(),
                config_path: proc.config_path.clone(),
            });
        } else {
            slots.stable = None;
        }
    }
    if let Some(ref mut proc) = slots.working {
        if let Ok(None) = proc.child.try_wait() {
            records.push(ManagedPidRecord {
                pid: proc.pid,
                profile: "working".to_string(),
                config_path: proc.config_path.clone(),
            });
        } else {
            slots.working = None;
        }
    }
    records
}

pub fn is_any_managed_core_running() -> bool {
    if let Ok(mut guard) = service_slots().lock() {
        let records = collect_active_pid_records(&mut guard);
        return !records.is_empty();
    }
    false
}

fn kill_slot_process(slot: &mut Option<ManagedSingboxProcess>) -> Option<(u32, String)> {
    if let Some(mut proc) = slot.take() {
        let pid = proc.pid;
        let addr = proc.listen_address.clone();
        #[cfg(unix)]
        {
            let _ = Command::new("kill")
                .args(["-TERM", &pid.to_string()])
                .output();
            std::thread::sleep(Duration::from_millis(40));
        }
        let _ = proc.child.kill();
        let _ = proc.child.wait();
        return Some((pid, addr));
    }
    None
}

pub fn stop_managed_singbox_slot(app: Option<&AppHandle>, profile: Option<&str>) -> Vec<(String, u32, String)> {
    let mut stopped = Vec::new();
    if let Ok(mut guard) = service_slots().lock() {
        match profile.map(|s| s.trim().to_ascii_lowercase()) {
            Some(ref p) if p == "stable" => {
                if let Some((pid, addr)) = kill_slot_process(&mut guard.stable) {
                    stopped.push(("stable".to_string(), pid, addr));
                }
            }
            Some(ref p) if p == "working" || p == "dynamic" => {
                if let Some((pid, addr)) = kill_slot_process(&mut guard.working) {
                    stopped.push(("working".to_string(), pid, addr));
                }
            }
            _ => {
                if let Some((pid, addr)) = kill_slot_process(&mut guard.stable) {
                    stopped.push(("stable".to_string(), pid, addr));
                }
                if let Some((pid, addr)) = kill_slot_process(&mut guard.working) {
                    stopped.push(("working".to_string(), pid, addr));
                }
            }
        }
        let remaining = collect_active_pid_records(&mut guard);
        if let Some(handle) = app {
            sync_pid_ledger_to_disk(handle, &remaining);
        }
    }
    if let Some(handle) = app {
        refresh_tray_menu_and_icon(handle);
    }
    stopped
}

pub fn stop_managed_singbox_process() {
    let _ = stop_managed_singbox_slot(None, None);
}

pub fn get_dual_slot_status_snapshot(app: &AppHandle) -> (CoreSlotStatusInfo, CoreSlotStatusInfo) {
    let ui_cfg = load_ui_config_sync(app);
    let stable_cfg = stable_singbox_config_path(app)
        .unwrap_or_else(|_| PathBuf::from("config.stable.json"));
    let working_cfg = working_singbox_config_path(app)
        .unwrap_or_else(|_| PathBuf::from("config.working.json"));
    let stable_surge = stable_surge_config_path(app)
        .unwrap_or_else(|_| PathBuf::from("aSingbox127.stable.conf"));
    let working_surge = working_surge_config_path(app)
        .unwrap_or_else(|_| PathBuf::from("aSingbox127.working.conf"));

    let mut stable_info = CoreSlotStatusInfo {
        profile: "stable".to_string(),
        running: false,
        pid: None,
        config_path: stable_cfg.to_string_lossy().to_string(),
        surge_config_path: stable_surge.to_string_lossy().to_string(),
        listen_address: format!("{}:{}", ui_cfg.listen_ip, ui_cfg.listen_port),
    };
    let mut working_info = CoreSlotStatusInfo {
        profile: "working".to_string(),
        running: false,
        pid: None,
        config_path: working_cfg.to_string_lossy().to_string(),
        surge_config_path: working_surge.to_string_lossy().to_string(),
        listen_address: format!("{}:{}", ui_cfg.listen_ip, ui_cfg.working_listen_port),
    };

    if let Ok(mut guard) = service_slots().lock() {
        let _ = collect_active_pid_records(&mut guard);
        if let Some(ref proc) = guard.stable {
            stable_info.running = true;
            stable_info.pid = Some(proc.pid);
            stable_info.config_path = proc.config_path.clone();
            stable_info.listen_address = proc.listen_address.clone();
        }
        if let Some(ref proc) = guard.working {
            working_info.running = true;
            working_info.pid = Some(proc.pid);
            working_info.config_path = proc.config_path.clone();
            working_info.listen_address = proc.listen_address.clone();
        }
    }

    (stable_info, working_info)
}

/// Rebuilds the macOS / OS Tray Menu and updates the Tray Icon state (Active White Template vs Dimmed Opacity)
pub fn refresh_tray_menu_and_icon(app: &AppHandle) {
    use tauri::menu::{CheckMenuItem, MenuBuilder, MenuItem, PredefinedMenuItem};

    let ui_cfg = load_ui_config_sync(app);
    let (stable_slot, working_slot) = get_dual_slot_status_snapshot(app);
    let any_running = stable_slot.running || working_slot.running;

    let _ = apply_system_tray_icon_style_with_state(app, &ui_cfg.topbar_icon_style, any_running);

    if let Some(tray) = app.tray_by_id("singbox_tray") {
        let show_item = match MenuItem::with_id(app, "show_main", "Show Panel", true, None::<&str>) {
            Ok(i) => i,
            Err(_) => return,
        };
        let sep1 = match PredefinedMenuItem::separator(app) {
            Ok(i) => i,
            Err(_) => return,
        };

        let stable_toggle_label = if stable_slot.running {
            "Launch Core (Stable) — Running"
        } else {
            "Launch Core (Stable)"
        };
        let launch_stable = match CheckMenuItem::with_id(
            app,
            "toggle_core_stable",
            stable_toggle_label,
            true,
            stable_slot.running,
            None::<&str>,
        ) {
            Ok(i) => i,
            Err(_) => return,
        };

        let stable_status_text = if let Some(pid) = stable_slot.pid {
            format!(
                "  Port: {} • Config: Stable (config.stable.json, PID {})",
                stable_slot.listen_address, pid
            )
        } else {
            format!(
                "  Port: {} • Config: Stable (config.stable.json — Standby)",
                stable_slot.listen_address
            )
        };
        // Disabled (`enabled = false`) so macOS renders it in secondary gray text below the checkmark item
        let stable_info_item = match MenuItem::with_id(
            app,
            "info_core_stable",
            &stable_status_text,
            false,
            None::<&str>,
        ) {
            Ok(i) => i,
            Err(_) => return,
        };

        let working_toggle_label = if working_slot.running {
            "Launch Core (Working / Dynamic) — Running"
        } else {
            "Launch Core (Working / Dynamic)"
        };
        let launch_working = match CheckMenuItem::with_id(
            app,
            "toggle_core_working",
            working_toggle_label,
            true,
            working_slot.running,
            None::<&str>,
        ) {
            Ok(i) => i,
            Err(_) => return,
        };

        let working_status_text = if let Some(pid) = working_slot.pid {
            format!(
                "  Port: {} • Config: Working (config.working.json, PID {})",
                working_slot.listen_address, pid
            )
        } else {
            format!(
                "  Port: {} • Config: Working (config.working.json — Hot-Reload)",
                working_slot.listen_address
            )
        };
        let working_info_item = match MenuItem::with_id(
            app,
            "info_core_working",
            &working_status_text,
            false,
            None::<&str>,
        ) {
            Ok(i) => i,
            Err(_) => return,
        };

        let sep2 = match PredefinedMenuItem::separator(app) {
            Ok(i) => i,
            Err(_) => return,
        };
        let quit_item = match MenuItem::with_id(app, "quit_app", "Quit", true, None::<&str>) {
            Ok(i) => i,
            Err(_) => return,
        };

        if let Ok(menu) = MenuBuilder::new(app)
            .items(&[
                &show_item,
                &sep1,
                &launch_stable,
                &stable_info_item,
                &launch_working,
                &working_info_item,
                &sep2,
                &quit_item,
            ])
            .build()
        {
            let _ = tray.set_menu(Some(menu));
        }

        let tooltip = match (stable_slot.running, working_slot.running) {
            (true, true) => format!(
                "SingboxGUI V0 — Stable ({}) & Working ({}) Cores Running",
                stable_slot.listen_address, working_slot.listen_address
            ),
            (true, false) => format!(
                "SingboxGUI V0 — Stable Core Running on {}",
                stable_slot.listen_address
            ),
            (false, true) => format!(
                "SingboxGUI V0 — Working Core Running on {}",
                working_slot.listen_address
            ),
            (false, false) => "SingboxGUI V0 — Standby (Click to Show Panel or Launch Core)".to_string(),
        };
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

/// Toggle a core slot directly from the System Tray menu using the existing disk configuration file
pub fn toggle_core_slot_from_tray(app: &AppHandle, profile: &str) {
    let target_profile = normalize_profile_name(Some(profile));
    let (stable_slot, working_slot) = get_dual_slot_status_snapshot(app);
    let is_currently_running = if target_profile == "working" {
        working_slot.running
    } else {
        stable_slot.running
    };

    if is_currently_running {
        stop_managed_singbox_slot(Some(app), Some(target_profile));
        let _ = app.emit("singbox-tray-state-changed", target_profile);
        return;
    }

    let dir = match resolve_app_config_dir(app) {
        Ok(d) => d,
        Err(_) => return,
    };
    let bin_path = resolve_singbox_binary(app);
    if !bin_path.is_file() {
        return;
    }

    let ui_cfg = load_ui_config_sync(app);
    let target_cfg_path = if target_profile == "working" {
        working_singbox_config_path(app).unwrap_or_else(|_| dir.join("config.working.json"))
    } else {
        stable_singbox_config_path(app).unwrap_or_else(|_| dir.join("config.stable.json"))
    };
    let fallback_cfg_path = default_singbox_config_path(app).unwrap_or_else(|_| dir.join("config.json"));

    if !target_cfg_path.is_file() && fallback_cfg_path.is_file() {
        if let Ok(raw) = std::fs::read_to_string(&fallback_cfg_path) {
            let port = if target_profile == "working" {
                ui_cfg.working_listen_port
            } else {
                ui_cfg.listen_port
            };
            let adapted = rewrite_config_inbound_port(&raw, &ui_cfg.listen_ip, port);
            let _ = std::fs::write(&target_cfg_path, adapted);
        }
    }

    if target_cfg_path.is_file() {
        let content = std::fs::read_to_string(&target_cfg_path).unwrap_or_default();
        let surge_cfg = default_surge_config_path(app).unwrap_or_else(|_| dir.join("aSingbox127.conf"));
        let summary = inspect_singbox_config_content(&dir, &target_cfg_path, &surge_cfg, &content);
        let _ = spawn_singbox_process_internal(
            app,
            target_profile,
            &bin_path,
            &dir,
            &target_cfg_path,
            &summary.listen_address,
        );
        refresh_tray_menu_and_icon(app);
        let _ = app.emit("singbox-tray-state-changed", target_profile);
    }
}

fn spawn_batched_log_reader<R: std::io::Read + Send + 'static>(
    stream: R,
    logs_buf: Arc<Mutex<Vec<String>>>,
    app_handle: AppHandle,
    profile_tag: String,
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
            let tagged_line = format!("[{}] {}", profile_tag, line);
            if let Ok(mut buf) = logs_buf.lock() {
                if buf.len() >= 300 {
                    buf.remove(0);
                }
                buf.push(tagged_line.clone());
            }
            if let Ok(mut p) = pending_reader.lock() {
                p.push(tagged_line);
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
    profile: &str,
    bin_path: &PathBuf,
    config_dir: &PathBuf,
    singbox_cfg: &PathBuf,
    listen_address: &str,
) -> Result<(u32, Vec<String>), String> {
    let normalized_profile = normalize_profile_name(Some(profile));
    stop_managed_singbox_slot(None, Some(normalized_profile));
    std::thread::sleep(Duration::from_millis(80));

    let mut child = Command::new(bin_path)
        .args(["run", "-c"])
        .arg(singbox_cfg)
        .current_dir(config_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            format!(
                "Failed to spawn sing-box ({}) run -c {}: {}",
                normalized_profile,
                singbox_cfg.display(),
                e
            )
        })?;

    let pid = child.id();
    let logs: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
    if let Some(stdout) = child.stdout.take() {
        spawn_batched_log_reader(
            stdout,
            Arc::clone(&logs),
            app.clone(),
            normalized_profile.to_string(),
        );
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_batched_log_reader(
            stderr,
            Arc::clone(&logs),
            app.clone(),
            normalized_profile.to_string(),
        );
    }

    std::thread::sleep(Duration::from_millis(220));
    if let Ok(Some(exit_status)) = child.try_wait() {
        let captured = logs.lock().map(|b| b.join("\n")).unwrap_or_default();
        let detail = if captured.trim().is_empty() {
            "Check port conflict or outbound parameters"
        } else {
            captured.trim()
        };
        return Err(format!(
            "sing-box ({}) exited immediately ({}): {}",
            normalized_profile, exit_status, detail
        ));
    }

    let initial_logs = logs.lock().map(|b| b.clone()).unwrap_or_default();
    if let Ok(mut guard) = service_slots().lock() {
        let proc = ManagedSingboxProcess {
            child,
            pid,
            profile: normalized_profile.to_string(),
            binary_path: bin_path.to_string_lossy().to_string(),
            config_path: singbox_cfg.to_string_lossy().to_string(),
            listen_address: listen_address.to_string(),
            logs,
        };
        if normalized_profile == "working" {
            guard.working = Some(proc);
        } else {
            guard.stable = Some(proc);
        }
        let active_records = collect_active_pid_records(&mut guard);
        sync_pid_ledger_to_disk(app, &active_records);
    }
    refresh_tray_menu_and_icon(app);
    Ok((pid, initial_logs))
}

/// Validates and writes the dynamic editor configuration ONLY to `config.working.json`
/// (and `config.json` when no stable service is running or as working mirror), NEVER overwriting
/// a running `config.stable.json` unless explicitly promoted.
/// If the `working` core slot is running, it is hot-reloaded automatically while `stable` remains untouched!
#[tauri::command]
pub async fn validate_singbox_config_cmd(
    app: AppHandle,
    config_content: String,
    surge_content: Option<String>,
    promote_to_stable: Option<bool>,
) -> Result<SingboxValidationResponse, String> {
    tokio::task::spawn_blocking(move || {
        let dir = resolve_app_config_dir(&app)?;
        let default_cfg = default_singbox_config_path(&app)?;
        let stable_cfg = stable_singbox_config_path(&app)?;
        let working_cfg = working_singbox_config_path(&app)?;
        let default_surge = default_surge_config_path(&app)?;
        let stable_surge = stable_surge_config_path(&app)?;
        let working_surge = working_surge_config_path(&app)?;
        let ui_cfg = load_ui_config_sync(&app);

        let working_json = rewrite_config_inbound_port(
            &config_content,
            &ui_cfg.listen_ip,
            ui_cfg.working_listen_port,
        );
        std::fs::write(&working_cfg, &working_json)
            .map_err(|e| format!("Failed to write {}: {}", working_cfg.display(), e))?;

        let should_promote_stable = promote_to_stable.unwrap_or(false) || !stable_cfg.is_file();
        if should_promote_stable {
            let stable_json = rewrite_config_inbound_port(
                &config_content,
                &ui_cfg.listen_ip,
                ui_cfg.listen_port,
            );
            let _ = std::fs::write(&stable_cfg, &stable_json);
            let _ = std::fs::write(&default_cfg, &stable_json);
            if let Some(ref surge_txt) = surge_content {
                let _ = std::fs::write(&stable_surge, surge_txt);
                let _ = std::fs::write(&default_surge, surge_txt);
            }
        }

        if let Some(ref surge_txt) = surge_content {
            let working_surge_txt = surge_txt.replace(
                &format!("{}, {}", ui_cfg.listen_ip, ui_cfg.listen_port),
                &format!("{}, {}", ui_cfg.listen_ip, ui_cfg.working_listen_port),
            );
            let _ = std::fs::write(&working_surge, working_surge_txt);
            if !default_surge.is_file() {
                let _ = std::fs::write(&default_surge, surge_txt);
            }
        }

        let summary = inspect_singbox_config_content(&dir, &working_cfg, &working_surge, &working_json);
        let bin_path = resolve_singbox_binary(&app);
        if !bin_path.is_file() {
            return Err(format!(
                "BINARY_NOT_FOUND: Synced working config ({} proxy outbounds, {} SOCKS5 users) to {}, but sing-box binary is not imported yet.",
                summary.proxy_outbound_count, summary.socks_user_count, working_cfg.display()
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
            .arg(&working_cfg)
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

        let (_, working_slot_status) = get_dual_slot_status_snapshot(&app);
        let mut service_reloaded = false;
        if working_slot_status.running && check_ok && !summary.empty_workspace {
            if spawn_singbox_process_internal(
                &app,
                "working",
                &bin_path,
                &dir,
                &working_cfg,
                &summary.listen_address,
            )
            .is_ok()
            {
                service_reloaded = true;
            }
        }

        let formatted_output = if !check_ok {
            combined
        } else if summary.empty_workspace {
            format!(
                "EMPTY_WORKSPACE: {} syntax check passed (0 errors), but it currently contains 0 proxy nodes (only 'direct' outbound, 0 SOCKS5 users).",
                working_cfg.display()
            )
        } else {
            format!(
                "sing-box check -c {} passed (0 errors) — Working config: {} proxy outbounds ({} SOCKS5 users on {}, {} dynamic pools, {} DNS servers, {} bytes){}.",
                working_cfg.display(),
                summary.proxy_outbound_count,
                summary.socks_user_count,
                summary.listen_address,
                summary.urltest_pool_count,
                summary.dns_server_count,
                summary.file_size_bytes,
                if service_reloaded {
                    " [Hot-reloaded Working core; Stable core untouched]"
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
            singbox_config_path: working_cfg.to_string_lossy().to_string(),
            stable_config_path: stable_cfg.to_string_lossy().to_string(),
            working_config_path: working_cfg.to_string_lossy().to_string(),
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
    profile: Option<String>,
) -> Result<SingboxServiceStatusResponse, String> {
    tokio::task::spawn_blocking(move || {
        let target_profile = normalize_profile_name(profile.as_deref());
        let dir = resolve_app_config_dir(&app)?;
        let default_cfg = default_singbox_config_path(&app)?;
        let stable_cfg = stable_singbox_config_path(&app)?;
        let working_cfg = working_singbox_config_path(&app)?;
        let default_surge = default_surge_config_path(&app)?;
        let stable_surge = stable_surge_config_path(&app)?;
        let working_surge = working_surge_config_path(&app)?;
        let ui_cfg = load_ui_config_sync(&app);

        let (active_cfg, active_surge, target_port) = if target_profile == "working" {
            (&working_cfg, &working_surge, ui_cfg.working_listen_port)
        } else {
            (&stable_cfg, &stable_surge, ui_cfg.listen_port)
        };

        let rewritten_json = rewrite_config_inbound_port(&config_content, &ui_cfg.listen_ip, target_port);
        std::fs::write(active_cfg, &rewritten_json)
            .map_err(|e| format!("Failed to write {}: {}", active_cfg.display(), e))?;
        if target_profile == "stable" {
            let _ = std::fs::write(&default_cfg, &rewritten_json);
        }

        if let Some(ref surge_txt) = surge_content {
            if target_profile == "working" {
                let working_surge_txt = surge_txt.replace(
                    &format!("{}, {}", ui_cfg.listen_ip, ui_cfg.listen_port),
                    &format!("{}, {}", ui_cfg.listen_ip, ui_cfg.working_listen_port),
                );
                let _ = std::fs::write(active_surge, working_surge_txt);
            } else {
                let _ = std::fs::write(active_surge, surge_txt);
                let _ = std::fs::write(&default_surge, surge_txt);
            }
        }

        let summary = inspect_singbox_config_content(&dir, active_cfg, active_surge, &rewritten_json);
        let bin_path = resolve_singbox_binary(&app);
        if !bin_path.is_file() {
            return Err(format!(
                "sing-box binary not found at {}. Import binary first.",
                bin_path.display()
            ));
        }

        let check_out = Command::new(&bin_path)
            .args(["check", "-c"])
            .arg(active_cfg)
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
                active_cfg.display(),
                err_msg.trim()
            ));
        }

        let (pid, initial_logs) = spawn_singbox_process_internal(
            &app,
            target_profile,
            &bin_path,
            &dir,
            active_cfg,
            &summary.listen_address,
        )?;

        let (stable_slot, working_slot) = get_dual_slot_status_snapshot(&app);
        Ok(SingboxServiceStatusResponse {
            running: true,
            pid: Some(pid),
            active_profile: target_profile.to_string(),
            binary_path: bin_path.to_string_lossy().to_string(),
            config_path: active_cfg.to_string_lossy().to_string(),
            stable_config_path: stable_cfg.to_string_lossy().to_string(),
            working_config_path: working_cfg.to_string_lossy().to_string(),
            surge_config_path: active_surge.to_string_lossy().to_string(),
            config_dir: dir.to_string_lossy().to_string(),
            listen_address: summary.listen_address.clone(),
            message: format!(
                "Started sing-box [{}] (PID {}) with -c {} on {} ({} proxy outbounds, {} SOCKS5 users).",
                target_profile.to_uppercase(),
                pid,
                active_cfg.display(),
                summary.listen_address,
                summary.proxy_outbound_count,
                summary.socks_user_count
            ),
            recent_logs: initial_logs,
            stable_slot,
            working_slot,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn stop_singbox_service_cmd(
    app: AppHandle,
    profile: Option<String>,
) -> Result<SingboxServiceStatusResponse, String> {
    tokio::task::spawn_blocking(move || {
        let dir = resolve_app_config_dir(&app)?;
        let stable_cfg = stable_singbox_config_path(&app)?;
        let working_cfg = working_singbox_config_path(&app)?;
        let surge_cfg = default_surge_config_path(&app)?;
        let bin_path = resolve_singbox_binary(&app);

        let stopped = stop_managed_singbox_slot(Some(&app), profile.as_deref());
        let (stable_slot, working_slot) = get_dual_slot_status_snapshot(&app);
        let any_running = stable_slot.running || working_slot.running;
        let active_pid = stable_slot.pid.or(working_slot.pid);
        let active_profile = if stable_slot.running {
            "stable".to_string()
        } else if working_slot.running {
            "working".to_string()
        } else {
            normalize_profile_name(profile.as_deref()).to_string()
        };

        let msg = if stopped.is_empty() {
            "Sing-box service slot is already stopped.".to_string()
        } else {
            let parts: Vec<String> = stopped
                .iter()
                .map(|(prof, pid, addr)| format!("[{}] PID {} on {}", prof.to_uppercase(), pid, addr))
                .collect();
            format!("Stopped sing-box service: {}.", parts.join(", "))
        };

        Ok(SingboxServiceStatusResponse {
            running: any_running,
            pid: active_pid,
            active_profile,
            binary_path: bin_path.to_string_lossy().to_string(),
            config_path: stable_cfg.to_string_lossy().to_string(),
            stable_config_path: stable_cfg.to_string_lossy().to_string(),
            working_config_path: working_cfg.to_string_lossy().to_string(),
            surge_config_path: surge_cfg.to_string_lossy().to_string(),
            config_dir: dir.to_string_lossy().to_string(),
            listen_address: stable_slot.listen_address.clone(),
            message: msg,
            recent_logs: Vec::new(),
            stable_slot,
            working_slot,
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
        let stable_cfg = stable_singbox_config_path(&app)?;
        let working_cfg = working_singbox_config_path(&app)?;
        let surge_cfg = default_surge_config_path(&app)?;
        let bin_path = resolve_singbox_binary(&app);

        let mut combined_logs = Vec::new();
        if let Ok(mut guard) = service_slots().lock() {
            let _ = collect_active_pid_records(&mut guard);
            if let Some(ref proc) = guard.stable {
                if let Ok(b) = proc.logs.lock() {
                    combined_logs.extend(b.clone());
                }
            }
            if let Some(ref proc) = guard.working {
                if let Ok(b) = proc.logs.lock() {
                    combined_logs.extend(b.clone());
                }
            }
        }

        let (stable_slot, working_slot) = get_dual_slot_status_snapshot(&app);
        let any_running = stable_slot.running || working_slot.running;
        let primary_pid = stable_slot.pid.or(working_slot.pid);
        let active_profile = if stable_slot.running && working_slot.running {
            "dual (stable + working)".to_string()
        } else if working_slot.running {
            "working".to_string()
        } else {
            "stable".to_string()
        };

        let primary_cfg = if working_slot.running && !stable_slot.running {
            working_slot.config_path.clone()
        } else {
            stable_slot.config_path.clone()
        };
        let primary_addr = if working_slot.running && !stable_slot.running {
            working_slot.listen_address.clone()
        } else {
            stable_slot.listen_address.clone()
        };

        let message = match (stable_slot.running, working_slot.running) {
            (true, true) => format!(
                "Dual cores active: Stable (PID {} on {}) & Working (PID {} on {})",
                stable_slot.pid.unwrap_or(0),
                stable_slot.listen_address,
                working_slot.pid.unwrap_or(0),
                working_slot.listen_address
            ),
            (true, false) => format!(
                "sing-box [STABLE] (PID {}) running on {} (-c {})",
                stable_slot.pid.unwrap_or(0),
                stable_slot.listen_address,
                stable_slot.config_path
            ),
            (false, true) => format!(
                "sing-box [WORKING] (PID {}) running on {} (-c {})",
                working_slot.pid.unwrap_or(0),
                working_slot.listen_address,
                working_slot.config_path
            ),
            (false, false) => "sing-box service is stopped.".to_string(),
        };

        Ok(SingboxServiceStatusResponse {
            running: any_running,
            pid: primary_pid,
            active_profile,
            binary_path: bin_path.to_string_lossy().to_string(),
            config_path: primary_cfg,
            stable_config_path: stable_cfg.to_string_lossy().to_string(),
            working_config_path: working_cfg.to_string_lossy().to_string(),
            surge_config_path: surge_cfg.to_string_lossy().to_string(),
            config_dir: dir.to_string_lossy().to_string(),
            listen_address: primary_addr,
            message,
            recent_logs: combined_logs,
            stable_slot,
            working_slot,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
