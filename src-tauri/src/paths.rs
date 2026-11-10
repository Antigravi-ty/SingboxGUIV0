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

pub fn candidate_singbox_paths(app: &AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let names = target_sidecar_filenames();

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

    if let Ok(dir) = resolve_app_config_dir(app) {
        for name in &names {
            candidates.push(dir.join(name));
        }
    }

    if let Ok(res_dir) = app.path().resource_dir() {
        for name in &names {
            candidates.push(res_dir.join(name));
            candidates.push(res_dir.join("binaries").join(name));
        }
    }

    candidates.push(PathBuf::from("/opt/homebrew/bin/sing-box"));
    candidates.push(PathBuf::from("/usr/local/bin/sing-box"));
    candidates.push(PathBuf::from("/usr/bin/sing-box"));
    candidates
}

pub fn resolve_singbox_binary(app: &AppHandle) -> PathBuf {
    for candidate in candidate_singbox_paths(app) {
        if candidate.is_file() {
            return candidate;
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        return cwd.join("bin").join("sing-box");
    }
    PathBuf::from("/usr/local/bin/sing-box")
}
