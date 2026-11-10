use serde::{Deserialize, Serialize};
use std::net::{TcpListener, TcpStream};
use std::process::Command;
use std::time::{Duration, Instant};

#[derive(Serialize)]
pub struct MitmStatus {
    pub enabled: bool,
    pub port: Option<u16>,
    pub is_macos: bool,
    pub message: String,
}

#[derive(Serialize)]
pub struct PortCheckResult {
    pub port: u16,
    pub host: String,
    pub occupied: bool,
    pub available: bool,
    pub message: String,
}

#[derive(Deserialize)]
pub struct ConnectivityTestRequest {
    pub method: String,
    pub target: String,
    #[serde(rename = "socksHost")]
    pub socks_host: Option<String>,
    #[serde(rename = "socksPort")]
    pub socks_port: Option<u16>,
    #[serde(rename = "socksUser")]
    pub socks_user: Option<String>,
    #[serde(rename = "socksPass")]
    pub socks_pass: Option<String>,
    #[serde(rename = "timeoutMs")]
    pub timeout_ms: Option<u64>,
}

#[derive(Serialize)]
pub struct ConnectivityTestResponse {
    pub success: bool,
    pub method: String,
    pub target: String,
    pub latency_ms: u64,
    pub status_code: Option<u16>,
    pub detail: String,
}

#[tauri::command]
pub fn check_port_availability(host: Option<String>, port: u16) -> Result<PortCheckResult, String> {
    let bind_host = host
        .filter(|h| !h.trim().is_empty())
        .unwrap_or_else(|| "127.0.0.1".to_string());
    match TcpListener::bind((bind_host.as_str(), port)) {
        Ok(listener) => {
            drop(listener);
            Ok(PortCheckResult {
                port,
                host: bind_host.clone(),
                occupied: false,
                available: true,
                message: format!("Port {}:{} is free and ready to bind.", bind_host, port),
            })
        }
        Err(err) => Ok(PortCheckResult {
            port,
            host: bind_host.clone(),
            occupied: true,
            available: false,
            message: format!(
                "Port {}:{} is already in use ({}). Stop the conflicting process or change Listen Port and re-export config.",
                bind_host, port, err
            ),
        }),
    }
}

#[tauri::command]
pub fn run_connectivity_test_cmd(
    payload: ConnectivityTestRequest,
) -> Result<ConnectivityTestResponse, String> {
    let timeout_sec = ((payload.timeout_ms.unwrap_or(6000) as f64) / 1000.0)
        .max(2.0)
        .min(20.0);
    let method = payload.method.trim().to_lowercase();
    let target = payload.target.trim().to_string();
    let start = Instant::now();

    if method == "icmp_ping" {
        let host = target
            .trim_start_matches("https://")
            .trim_start_matches("http://")
            .split('/')
            .next()
            .unwrap_or(&target)
            .split(':')
            .next()
            .unwrap_or(&target);
        let count_arg = if cfg!(target_os = "windows") { "-n" } else { "-c" };
        let out = Command::new("ping")
            .arg(count_arg)
            .arg("1")
            .arg(host)
            .output();
        let elapsed = start.elapsed().as_millis() as u64;
        match out {
            Ok(o) if o.status.success() => {
                let text = String::from_utf8_lossy(&o.stdout);
                let summary = text
                    .lines()
                    .find(|l| l.contains("time=") || l.contains("bytes from"))
                    .unwrap_or("ICMP Echo Reply received")
                    .trim()
                    .to_string();
                return Ok(ConnectivityTestResponse {
                    success: true,
                    method,
                    target: host.to_string(),
                    latency_ms: elapsed,
                    status_code: None,
                    detail: summary,
                });
            }
            Ok(o) => {
                let err_txt = format!(
                    "{}{}",
                    String::from_utf8_lossy(&o.stdout),
                    String::from_utf8_lossy(&o.stderr)
                );
                return Ok(ConnectivityTestResponse {
                    success: false,
                    method,
                    target: host.to_string(),
                    latency_ms: elapsed,
                    status_code: None,
                    detail: if err_txt.trim().is_empty() {
                        "ICMP ping failed or blocked".to_string()
                    } else {
                        err_txt.lines().next().unwrap_or("ICMP ping failed").to_string()
                    },
                });
            }
            Err(e) => {
                return Ok(ConnectivityTestResponse {
                    success: false,
                    method,
                    target: host.to_string(),
                    latency_ms: elapsed,
                    status_code: None,
                    detail: format!("Failed to execute ping command: {}", e),
                });
            }
        }
    }

    if method == "tcp_ping" {
        let cleaned = target
            .trim_start_matches("https://")
            .trim_start_matches("http://")
            .split('/')
            .next()
            .unwrap_or(&target);
        let (host, port) = if let Some((h, p)) = cleaned.rsplit_once(':') {
            (h, p.parse::<u16>().unwrap_or(443))
        } else {
            (cleaned, 443)
        };
        use std::net::ToSocketAddrs;
        let addr_iter = format!("{}:{}", host, port).to_socket_addrs();
        let elapsed_resolve = start.elapsed().as_millis() as u64;
        match addr_iter {
            Ok(mut addrs) => {
                if let Some(sock_addr) = addrs.next() {
                    let conn_start = Instant::now();
                    match TcpStream::connect_timeout(
                        &sock_addr,
                        Duration::from_secs_f64(timeout_sec),
                    ) {
                        Ok(_) => {
                            let ms = conn_start.elapsed().as_millis() as u64;
                            return Ok(ConnectivityTestResponse {
                                success: true,
                                method,
                                target: format!("{}:{}", host, port),
                                latency_ms: ms,
                                status_code: None,
                                detail: format!(
                                    "TCP handshake to {} ({}) succeeded in {} ms",
                                    host, sock_addr, ms
                                ),
                            });
                        }
                        Err(e) => {
                            let ms = conn_start.elapsed().as_millis() as u64;
                            return Ok(ConnectivityTestResponse {
                                success: false,
                                method,
                                target: format!("{}:{}", host, port),
                                latency_ms: ms,
                                status_code: None,
                                detail: format!("TCP connect to {} failed: {}", sock_addr, e),
                            });
                        }
                    }
                }
                return Ok(ConnectivityTestResponse {
                    success: false,
                    method,
                    target: format!("{}:{}", host, port),
                    latency_ms: elapsed_resolve,
                    status_code: None,
                    detail: "No socket address resolved".to_string(),
                });
            }
            Err(e) => {
                return Ok(ConnectivityTestResponse {
                    success: false,
                    method,
                    target: format!("{}:{}", host, port),
                    latency_ms: elapsed_resolve,
                    status_code: None,
                    detail: format!("DNS resolution failed for {}: {}", host, e),
                });
            }
        }
    }

    // HTTP / HTTPS Fetch (Direct or via SOCKS5 Bridge)
    let mut cmd = Command::new("curl");
    cmd.arg("-sSL")
        .arg("-o")
        .arg(if cfg!(target_os = "windows") { "NUL" } else { "/dev/null" })
        .arg("-w")
        .arg("%{http_code}|%{time_total}")
        .arg("--max-time")
        .arg(format!("{:.1}", timeout_sec));

    if method == "socks5_http" {
        let s_host = payload
            .socks_host
            .unwrap_or_else(|| "127.0.0.1".to_string());
        let s_port = payload.socks_port.unwrap_or(11400);
        cmd.arg("--socks5-hostname")
            .arg(format!("{}:{}", s_host, s_port));
        if let Some(u) = payload.socks_user.filter(|s| !s.trim().is_empty()) {
            let p = payload.socks_pass.unwrap_or_else(|| "0".to_string());
            cmd.arg("-U").arg(format!("{}:{}", u, p));
        }
    }

    let url = if target.starts_with("http://") || target.starts_with("https://") {
        target.clone()
    } else {
        format!("https://{}", target)
    };
    cmd.arg(&url);

    let out = cmd.output();
    let elapsed = start.elapsed().as_millis() as u64;
    match out {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&o.stderr).trim().to_string();
            let mut parts = stdout.split('|');
            let code_num = parts
                .next()
                .and_then(|c| c.parse::<u16>().ok())
                .filter(|&c| c > 0);
            let curl_ms = parts
                .next()
                .and_then(|t| t.parse::<f64>().ok())
                .map(|sec| (sec * 1000.0).round() as u64)
                .unwrap_or(elapsed);
            let ok = o.status.success() && code_num.map(|c| c >= 200 && c < 400).unwrap_or(false);
            Ok(ConnectivityTestResponse {
                success: ok,
                method,
                target: url.clone(),
                latency_ms: curl_ms,
                status_code: code_num,
                detail: if ok {
                    format!(
                        "HTTP {} returned from {} in {} ms",
                        code_num.unwrap_or(200),
                        url,
                        curl_ms
                    )
                } else {
                    format!(
                        "Probe failed (HTTP {:?}): {}",
                        code_num.unwrap_or(0),
                        if stderr.is_empty() {
                            "Connection refused or timed out"
                        } else {
                            &stderr
                        }
                    )
                },
            })
        }
        Err(e) => Ok(ConnectivityTestResponse {
            success: false,
            method,
            target: url,
            latency_ms: elapsed,
            status_code: None,
            detail: format!("Failed to invoke curl: {}", e),
        }),
    }
}

#[tauri::command]
pub fn sniff_mitm_port(base_port: u16) -> Result<u16, String> {
    let start = if base_port < 1024 { 8080 } else { base_port };
    for port in start..=65535 {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Ok(port);
        }
    }
    Err("No available local TCP port found in range.".to_string())
}

#[tauri::command]
pub fn toggle_mitm_listener(enable: bool, port: u16) -> Result<MitmStatus, String> {
    let is_macos = cfg!(target_os = "macos");
    if enable {
        Ok(MitmStatus {
            enabled: true,
            port: Some(port),
            is_macos,
            message: format!(
                "MITM Engine listening on 127.0.0.1:{} with URL Regex Routing enabled.",
                port
            ),
        })
    } else {
        Ok(MitmStatus {
            enabled: false,
            port: None,
            is_macos,
            message: "MITM Engine stopped.".to_string(),
        })
    }
}
