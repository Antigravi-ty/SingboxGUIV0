use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

fn main() {
    let default_path = Path::new("../src/config/defaultProfile.json");
    let resolved_path = Path::new("../src/config/resolvedProfile.json");

    println!("cargo:rerun-if-changed=../src/config/defaultProfile.json");
    println!("cargo:rerun-if-env-changed=AGY_CLEAN_EMBED");
    println!("cargo:rerun-if-env-changed=AGY_EMBED_PRIVATE_PROFILE");

    let profile = env::var("PROFILE").unwrap_or_default();
    let clean_embed_env = env::var("AGY_CLEAN_EMBED").unwrap_or_default();
    let embed_private_env = env::var("AGY_EMBED_PRIVATE_PROFILE").unwrap_or_default();
    let should_clean_embed =
        embed_private_env.trim() != "1" && (profile == "release" || clean_embed_env.trim() == "1");

    if should_clean_embed {
        let _ = Command::new("node")
            .arg("../scripts/syncPrivateProfile.mjs")
            .arg("--clean-embed")
            .status();
    } else if !resolved_path.exists() {
        let _ = Command::new("node")
            .arg("../scripts/syncPrivateProfile.mjs")
            .status();
    }

    if !resolved_path.exists() && default_path.exists() {
        let _ = fs::copy(default_path, resolved_path);
    }

    if let Ok(out_dir) = env::var("OUT_DIR") {
        let embedded_target = PathBuf::from(out_dir).join("embedded_profile.json");
        let source_path = if should_clean_embed || !resolved_path.exists() {
            default_path
        } else {
            resolved_path
        };
        if source_path.exists() {
            let _ = fs::copy(source_path, &embedded_target);
        } else {
            let _ = fs::write(&embedded_target, "{}\n");
        }
    }

    tauri_build::build()
}
