use crate::paths::{default_ui_config_path, resolve_app_config_dir};
use serde::{Deserialize, Serialize};
use tauri::{image::Image, AppHandle};

#[derive(Serialize, Deserialize, Clone)]
pub struct UiRuntimeConfig {
    #[serde(default = "default_listen_ip")]
    pub listen_ip: String,
    #[serde(default = "default_listen_port")]
    pub listen_port: u16,
    #[serde(default = "default_working_listen_port")]
    pub working_listen_port: u16,
    #[serde(default = "default_auto_detect_interface")]
    pub auto_detect_interface: bool,
    #[serde(default = "default_advanced_mode")]
    pub advanced_mode: bool,
    #[serde(default = "default_topbar_icon_style")]
    pub topbar_icon_style: String,
    #[serde(default = "default_color_mode")]
    pub color_mode: String,
    #[serde(default = "default_include_surge_groups")]
    pub include_surge_proxy_groups: bool,
}

fn default_listen_ip() -> String {
    "127.0.0.1".to_string()
}

fn default_listen_port() -> u16 {
    11400
}

fn default_working_listen_port() -> u16 {
    11401
}

fn default_auto_detect_interface() -> bool {
    true
}

fn default_advanced_mode() -> bool {
    false
}

fn default_topbar_icon_style() -> String {
    "monochrome".to_string()
}

fn default_color_mode() -> String {
    "light".to_string()
}

fn default_include_surge_groups() -> bool {
    true
}

impl Default for UiRuntimeConfig {
    fn default() -> Self {
        Self {
            listen_ip: default_listen_ip(),
            listen_port: default_listen_port(),
            working_listen_port: default_working_listen_port(),
            auto_detect_interface: default_auto_detect_interface(),
            advanced_mode: default_advanced_mode(),
            topbar_icon_style: default_topbar_icon_style(),
            color_mode: default_color_mode(),
            include_surge_proxy_groups: default_include_surge_groups(),
        }
    }
}

pub fn load_ui_config_sync(app: &AppHandle) -> UiRuntimeConfig {
    if let Ok(path) = default_ui_config_path(app) {
        if path.is_file() {
            if let Ok(raw) = std::fs::read_to_string(&path) {
                if let Ok(parsed) = serde_json::from_str::<UiRuntimeConfig>(&raw) {
                    return parsed;
                }
            }
        } else {
            let default_cfg = UiRuntimeConfig::default();
            if let Ok(serialized) = serde_json::to_string_pretty(&default_cfg) {
                let _ = std::fs::write(&path, serialized);
            }
            return default_cfg;
        }
    }
    UiRuntimeConfig::default()
}

pub fn save_ui_config_sync(app: &AppHandle, config: &UiRuntimeConfig) -> Result<String, String> {
    let _ = resolve_app_config_dir(app)?;
    let path = default_ui_config_path(app)?;
    let json_str = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize ui-config.json: {}", e))?;
    std::fs::write(&path, json_str)
        .map_err(|e| format!("Failed to write {}: {}", path.to_string_lossy(), e))?;
    Ok(path.to_string_lossy().to_string())
}

fn signed_dist_to_segment(
    px: f32,
    py: f32,
    ax: f32,
    ay: f32,
    bx: f32,
    by: f32,
) -> f32 {
    let vx = bx - ax;
    let vy = by - ay;
    let wx = px - ax;
    let wy = py - ay;
    let c1 = wx * vx + wy * vy;
    if c1 <= 0.0 {
        return ((px - ax).powi(2) + (py - ay).powi(2)).sqrt();
    }
    let c2 = vx * vx + vy * vy;
    if c2 <= c1 {
        return ((px - bx).powi(2) + (py - by).powi(2)).sqrt();
    }
    let b = c1 / c2;
    let pbx = ax + b * vx;
    let pby = ay + b * vy;
    ((px - pbx).powi(2) + (py - pby).powi(2)).sqrt()
}

/// Generates a 44x44 (@2x Retina) macOS template RGBA icon of the Sing-box isometric cube.
/// Following Apple macOS Human Interface Guidelines (Menu Bar Extras):
/// - Uses pure black RGB (0, 0, 0) with an alpha mask (`icon_as_template(true)`), so macOS
///   automatically renders it crisp white on dark menu bars and dark on light menu bars.
/// - Active/Running state (`is_running = true`): 100% opacity (`alpha_scale = 1.0`) + solid center dot.
/// - Inactive/Stopped state (`is_running = false`): dimmed 42% alpha (`alpha_scale = 0.42`) so the
///   template icon visually recedes in the menu bar without violating macOS monochrome appearance.
pub fn build_monochrome_tray_icon_rgba_with_state(is_running: bool) -> (Vec<u8>, u32, u32) {
    let width: u32 = 44;
    let height: u32 = 44;
    let mut rgba = vec![0u8; (width * height * 4) as usize];
    let alpha_scale: f32 = if is_running { 1.0 } else { 0.42 };

    // Normalized isometric hexagon vertices in 44x44 coordinate space
    let top = (22.0f32, 5.0f32);
    let right_top = (37.5f32, 14.0f32);
    let right_bot = (37.5f32, 31.0f32);
    let bottom = (22.0f32, 40.0f32);
    let left_bot = (6.5f32, 31.0f32);
    let left_top = (6.5f32, 14.0f32);
    let center = (22.0f32, 22.8f32);

    // Lid flap seam & tape lines
    let flap_a = (14.2f32, 18.4f32);
    let flap_b = (29.8f32, 9.5f32);

    let segments = [
        // Outer hexagon
        (top, right_top, 2.3f32),
        (right_top, right_bot, 2.3f32),
        (right_bot, bottom, 2.3f32),
        (bottom, left_bot, 2.3f32),
        (left_bot, left_top, 2.3f32),
        (left_top, top, 2.3f32),
        // Inner Y-seams
        (left_top, center, 2.1f32),
        (right_top, center, 2.1f32),
        (center, bottom, 2.1f32),
        // Box lid seam
        (flap_a, flap_b, 1.8f32),
    ];

    for y in 0..height {
        for x in 0..width {
            let px = x as f32 + 0.5;
            let py = y as f32 + 0.5;
            let mut min_dist = 999.0f32;

            for &(a, b, stroke_w) in &segments {
                let d = signed_dist_to_segment(px, py, a.0, a.1, b.0, b.1);
                let effective = d - (stroke_w * 0.5);
                if effective < min_dist {
                    min_dist = effective;
                }
            }

            // When running, also render a subtle status badge dot at bottom-right (36.5, 36.5)
            if is_running {
                let dot_d = ((px - 36.5).powi(2) + (py - 36.5).powi(2)).sqrt() - 3.6;
                if dot_d < min_dist {
                    min_dist = dot_d;
                }
            }

            let base_alpha = if min_dist <= -0.45 {
                255.0f32
            } else if min_dist < 0.65 {
                let t = 1.0 - ((min_dist + 0.45) / 1.1).clamp(0.0, 1.0);
                t * 255.0
            } else {
                0.0f32
            };

            let alpha = (base_alpha * alpha_scale).round().clamp(0.0, 255.0) as u8;
            let idx = ((y * width + x) * 4) as usize;
            rgba[idx] = 0;
            rgba[idx + 1] = 0;
            rgba[idx + 2] = 0;
            rgba[idx + 3] = alpha;
        }
    }

    (rgba, width, height)
}

pub fn build_monochrome_tray_icon_rgba() -> (Vec<u8>, u32, u32) {
    build_monochrome_tray_icon_rgba_with_state(true)
}

pub fn apply_system_tray_icon_style_with_state(
    app: &AppHandle,
    style: &str,
    is_running: bool,
) -> Result<String, String> {
    let normalized = if style.trim().eq_ignore_ascii_case("real") {
        "real"
    } else {
        "monochrome"
    };

    if let Some(tray) = app.tray_by_id("singbox_tray") {
        if normalized == "monochrome" {
            let (rgba, w, h) = build_monochrome_tray_icon_rgba_with_state(is_running);
            let img = Image::new_owned(rgba, w, h);
            let _ = tray.set_icon(Some(img));
            let _ = tray.set_icon_as_template(true);
        } else {
            if let Some(default_icon) = app.default_window_icon() {
                if is_running {
                    let _ = tray.set_icon(Some(default_icon.clone()));
                } else {
                    // Dim the real-color icon alpha to 45% when no core is running
                    let mut dimmed = default_icon.rgba().to_vec();
                    for chunk in dimmed.chunks_exact_mut(4) {
                        chunk[3] = ((chunk[3] as f32) * 0.45) as u8;
                    }
                    let img = Image::new_owned(dimmed, default_icon.width(), default_icon.height());
                    let _ = tray.set_icon(Some(img));
                }
            }
            let _ = tray.set_icon_as_template(false);
        }
    }

    Ok(normalized.to_string())
}

pub fn apply_system_tray_icon_style(app: &AppHandle, style: &str) -> Result<String, String> {
    let any_running = crate::commands::singbox::is_any_managed_core_running();
    apply_system_tray_icon_style_with_state(app, style, any_running)
}

#[tauri::command]
pub async fn get_ui_config_cmd(app: AppHandle) -> Result<UiRuntimeConfig, String> {
    Ok(load_ui_config_sync(&app))
}

#[tauri::command]
pub async fn save_ui_config_cmd(
    app: AppHandle,
    config: UiRuntimeConfig,
) -> Result<UiRuntimeConfig, String> {
    let _ = apply_system_tray_icon_style(&app, &config.topbar_icon_style);
    let _ = save_ui_config_sync(&app, &config)?;
    Ok(config)
}

#[tauri::command]
pub async fn set_tray_icon_style_cmd(app: AppHandle, style: String) -> Result<String, String> {
    let applied = apply_system_tray_icon_style(&app, &style)?;
    let mut cfg = load_ui_config_sync(&app);
    cfg.topbar_icon_style = applied.clone();
    let _ = save_ui_config_sync(&app, &cfg);
    Ok(applied)
}
