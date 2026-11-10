use serde::Serialize;
use std::collections::HashMap;
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Serialize)]
pub struct SubscriptionFetchResponse {
    pub body: String,
    pub headers: HashMap<String, String>,
    pub status: u16,
    #[serde(rename = "userInfoHeader")]
    pub user_info_header: Option<String>,
}

fn fetch_via_curl(url: &str, ua: &str) -> Result<SubscriptionFetchResponse, String> {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp_dir = std::env::temp_dir();
    let hdr_file = tmp_dir.join(format!("singbox_sub_hdr_{}.txt", nonce));
    let body_file = tmp_dir.join(format!("singbox_sub_body_{}.txt", nonce));

    let output = Command::new("curl")
        .arg("-sSL")
        .arg("--max-time")
        .arg("20")
        .arg("-A")
        .arg(ua)
        .arg("-D")
        .arg(&hdr_file)
        .arg("-o")
        .arg(&body_file)
        .arg(url)
        .output()
        .map_err(|e| format!("Failed to invoke curl: {}", e))?;

    let raw_headers = std::fs::read_to_string(&hdr_file).unwrap_or_default();
    let body = std::fs::read_to_string(&body_file).unwrap_or_default();
    let _ = std::fs::remove_file(&hdr_file);
    let _ = std::fs::remove_file(&body_file);

    if !output.status.success() && body.trim().is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("curl request failed: {}", stderr.trim()));
    }

    let mut headers_map = HashMap::new();
    let mut user_info_header = None;
    let mut status: u16 = 200;

    for line in raw_headers.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("HTTP/") {
            if let Some(code_str) = trimmed.split_whitespace().nth(1) {
                if let Ok(code) = code_str.parse::<u16>() {
                    status = code;
                }
            }
        } else if let Some(colon_idx) = trimmed.find(':') {
            let key = trimmed[..colon_idx].trim().to_lowercase();
            let val = trimmed[colon_idx + 1..].trim().to_string();
            if key == "subscription-userinfo" {
                user_info_header = Some(val.clone());
            }
            headers_map.insert(key, val);
        }
    }

    if status >= 400 {
        return Err(format!("Subscription server returned HTTP {}", status));
    }
    if body.trim().is_empty() {
        return Err("Subscription response body is empty.".to_string());
    }

    Ok(SubscriptionFetchResponse {
        body,
        headers: headers_map,
        status,
        user_info_header,
    })
}

#[tauri::command]
pub async fn fetch_subscription_url(
    url: String,
    user_agent: Option<String>,
) -> Result<SubscriptionFetchResponse, String> {
    let trimmed_url = url.trim().to_string();
    if !trimmed_url.starts_with("http://") && !trimmed_url.starts_with("https://") {
        return Err("Invalid subscription URL: must start with http:// or https://".to_string());
    }

    let ua = user_agent
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "clash-verge/v2.4.7".to_string());

    if let Ok(curl_res) = fetch_via_curl(&trimmed_url, &ua) {
        return Ok(curl_res);
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent(&ua)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let resp = client
        .get(&trimmed_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch subscription URL: {}", e))?;

    let status = resp.status().as_u16();
    if status >= 400 {
        return Err(format!("Subscription server returned HTTP {}", status));
    }

    let mut headers_map = HashMap::new();
    let mut user_info_header = None;

    for (k, v) in resp.headers().iter() {
        if let Ok(val_str) = v.to_str() {
            let key_lower = k.as_str().to_lowercase();
            if key_lower == "subscription-userinfo" {
                user_info_header = Some(val_str.to_string());
            }
            headers_map.insert(key_lower, val_str.to_string());
        }
    }

    let body = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    Ok(SubscriptionFetchResponse {
        body,
        headers: headers_map,
        status,
        user_info_header,
    })
}
