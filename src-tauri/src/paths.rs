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

pub fn default_managed_binary_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "sing-box.exe"
    } else {
        "sing-box"
    }
}

pub fn default_managed_binary_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(resolve_app_config_dir(app)?.join(default_managed_binary_name()))
}

pub fn default_singbox_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(resolve_app_config_dir(app)?.join("config.json"))
}

pub fn stable_singbox_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(resolve_app_config_dir(app)?.join("config.stable.json"))
}

pub fn working_singbox_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(resolve_app_config_dir(app)?.join("config.working.json"))
}

pub fn default_surge_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(resolve_app_config_dir(app)?.join("aSingbox127.conf"))
}

pub fn stable_surge_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(resolve_app_config_dir(app)?.join("aSingbox127.stable.conf"))
}

pub fn working_surge_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(resolve_app_config_dir(app)?.join("aSingbox127.working.conf"))
}

pub fn default_ui_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(resolve_app_config_dir(app)?.join("ui-config.json"))
}

pub fn managed_pids_ledger_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(resolve_app_config_dir(app)?.join("managed-pids.json"))
}

fn target_sidecar_filenames() -> Vec<&'static str> {
    if cfg!(target_os = "windows") {
        vec![
            "sing-box.exe",
            "sing-box-x86_64-pc-windows-msvc.exe",
            "sing-box-aarch64-pc-windows-msvc.exe",
        ]
    } else if cfg!(target_os = "macos") {
        vec![
            "sing-box",
            "sing-box-aarch64-apple-darwin",
            "sing-box-x86_64-apple-darwin",
        ]
    } else {
        vec![
            "sing-box",
            "sing-box-x86_64-unknown-linux-gnu",
            "sing-box-aarch64-unknown-linux-gnu",
        ]
    }
}

pub fn ensure_executable_permissions(path: &PathBuf) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = std::fs::metadata(path) {
            let mut perms = meta.permissions();
            perms.set_mode(0o755);
            let _ = std::fs::set_permissions(path, perms);
        }
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("xattr")
            .args(["-d", "com.apple.quarantine"])
            .arg(path)
            .output();
    }
}

pub fn candidate_singbox_paths(app: &AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let names = target_sidecar_filenames();

    // 1. Primary Canonical Location: Tauri Application Support / Config Dir
    if let Ok(dir) = resolve_app_config_dir(app) {
        for name in &names {
            candidates.push(dir.join(name));
        }
    }

    // 2. Bundled Tauri Resource Dir
    if let Ok(res_dir) = app.path().resource_dir() {
        for name in &names {
            candidates.push(res_dir.join(name));
            candidates.push(res_dir.join("binaries").join(name));
        }
    }

    // 3. Development Project Root & Sidecar Directories
    if let Ok(cwd) = std::env::current_dir() {
        let mut bases = vec![cwd.clone()];
        if let Some(parent) = cwd.parent() {
            bases.push(parent.to_path_buf());
        }
        for base in bases {
            for name in &names {
                candidates.push(base.join("bin").join(name));
                candidates.push(base.join("src-tauri").join("binaries").join(name));
                candidates.push(base.join("binaries").join(name));
                candidates.push(base.join(name));
            }
        }
    }

    // 4. System-wide Installations (Homebrew / usr/local)
    candidates.push(PathBuf::from("/opt/homebrew/bin/sing-box"));
    candidates.push(PathBuf::from("/usr/local/bin/sing-box"));
    candidates.push(PathBuf::from("/usr/bin/sing-box"));
    candidates
}

pub fn resolve_singbox_binary(app: &AppHandle) -> PathBuf {
    let managed_target = default_managed_binary_path(app).ok();
    if let Some(ref target) = managed_target {
        if target.is_file() {
            ensure_executable_permissions(target);
            return target.clone();
        }
    }

    for candidate in candidate_singbox_paths(app) {
        if candidate.is_file() {
            // Auto-stage into Application Support directory so binary + config.json live together
            if let Some(ref target) = managed_target {
                if &candidate != target {
                    if std::fs::copy(&candidate, target).is_ok() {
                        ensure_executable_permissions(target);
                        return target.clone();
                    }
                }
            }
            ensure_executable_permissions(&candidate);
            return candidate;
        }
    }

    if let Some(target) = managed_target {
        return target;
    }
    PathBuf::from("/usr/local/bin/sing-box")
}
