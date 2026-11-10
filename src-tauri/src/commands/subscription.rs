use serde::Serialize;
use std::collections::HashMap;
use std::time::Duration;

#[derive(Serialize)]
pub struct SubscriptionFetchResponse {
    pub body: String,
    pub headers: HashMap<String, String>,
    pub status: u16,
    #[serde(rename = "userInfoHeader")]
    pub user_info_header: Option<String>,
}

#[tauri::command]
pub async fn fetch_subscription_url(
    url: String,
    user_agent: Option<String>,
) -> Result<SubscriptionFetchResponse, String> {
    let ua = user_agent
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "clash-verge/v2.4.7".to_string());

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent(&ua)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch subscription URL: {}", e))?;

    let status = resp.status().as_u16();
    let mut headers_map = HashMap::new();
    let mut user_info_header = None;

    for (k, v) in resp.headers().iter() {
        if let Ok(val_str) = v.to_str() {
            let key_lower = k.as_str().to_lowercase();
            if key_lower == "subscription-userinfo" {
                user_info_header = Some(val_str.to_string());
            }
            headers_map.insert(k.as_str().to_string(), val_str.to_string());
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
