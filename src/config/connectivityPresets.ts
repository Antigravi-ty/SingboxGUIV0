import {
  ConnectivityTestMethod,
  ConnectivityTestPresetTarget,
} from "../types/singbox";

export const CONNECTIVITY_TEST_METHODS: Array<{
  id: ConnectivityTestMethod;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: "http_fetch",
    label: "HTTP/HTTPS Direct (204 / Trace)",
    shortLabel: "HTTP 204 / Fetch",
    description:
      "Fetches target URL directly from host network and verifies HTTP 204/200 status & latency.",
  },
  {
    id: "socks5_http",
    label: "SOCKS5 Bridge (127.0.0.1:Port)",
    shortLabel: "SOCKS5 Bridge",
    description:
      "Routes HTTP/HTTPS probe through local Sing-box SOCKS5 bridge (supports per-node user 000..999).",
  },
  {
    id: "tcp_ping",
    label: "TCP Handshake (Host:Port)",
    shortLabel: "TCP Connect",
    description:
      "Measures TCP 3-way SYN/ACK handshake latency to DNS or proxy server IP:Port (e.g. 1.1.1.1:443).",
  },
  {
    id: "icmp_ping",
    label: "ICMP Echo (Ping)",
    shortLabel: "ICMP Ping",
    description:
      "Sends system ICMP Echo Request (ping -c 1) to target IP or hostname.",
  },
];

export const CONNECTIVITY_TEST_PRESETS: ConnectivityTestPresetTarget[] = [
  {
    id: "google_204",
    label: "Google Generate 204",
    category: "HTTP 204 / Trace",
    target: "https://www.gstatic.com/generate_204",
    recommendedMethod: "http_fetch",
    description: "Standard Android / Sing-box urltest 204 captive portal endpoint",
  },
  {
    id: "google_dl_204",
    label: "Google Client3 204",
    category: "HTTP 204 / Trace",
    target: "http://clients3.google.com/generate_204",
    recommendedMethod: "http_fetch",
    description: "Lightweight HTTP 204 check without TLS handshake overhead",
  },
  {
    id: "cloudflare_204",
    label: "Cloudflare CP 204",
    category: "HTTP 204 / Trace",
    target: "http://cp.cloudflare.com/generate_204",
    recommendedMethod: "http_fetch",
    description: "Cloudflare global anycast HTTP 204 connectivity probe",
  },
  {
    id: "cloudflare_trace",
    label: "Cloudflare CGI Trace (1.1.1.1)",
    category: "HTTP 204 / Trace",
    target: "https://1.1.1.1/cdn-cgi/trace",
    recommendedMethod: "http_fetch",
    description: "Cloudflare edge trace endpoint returning exit POP & TLS version",
  },
  {
    id: "apple_hotspot",
    label: "Apple Captive Portal",
    category: "HTTP 204 / Trace",
    target: "http://captive.apple.com/hotspot-detect.html",
    recommendedMethod: "http_fetch",
    description: "macOS / iOS standard network reachability probe",
  },
  {
    id: "cf_dns_1111",
    label: "Cloudflare DNS (1.1.1.1:443)",
    category: "DNS / IP Anycast",
    target: "1.1.1.1:443",
    recommendedMethod: "tcp_ping",
    description: "Cloudflare 1.1.1.1 Anycast DoH/TLS port 443 reachability",
  },
  {
    id: "cf_dns_1001",
    label: "Cloudflare Secondary (1.0.0.1:443)",
    category: "DNS / IP Anycast",
    target: "1.0.0.1:443",
    recommendedMethod: "tcp_ping",
    description: "Cloudflare 1.0.0.1 backup anycast IP",
  },
  {
    id: "google_dns_8888",
    label: "Google Public DNS (8.8.8.8:443)",
    category: "DNS / IP Anycast",
    target: "8.8.8.8:443",
    recommendedMethod: "tcp_ping",
    description: "Google 8.8.8.8 Anycast DoH/TLS port 443 reachability",
  },
  {
    id: "alidns_223",
    label: "AliDNS Domestic (223.5.5.5:53)",
    category: "DNS / IP Anycast",
    target: "223.5.5.5:53",
    recommendedMethod: "tcp_ping",
    description: "Sing-box default_domain_resolver bootstrap DNS server",
  },
];
