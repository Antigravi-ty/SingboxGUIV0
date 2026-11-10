# SingboxGUI V0

A lightweight, modular desktop & web workspace for **Sing-box 1.14.4 (Latest Stable)** combining:
1. **Clean, Zero-Bloat Frontend Architecture** from `Antigravi-ty/agyPreviewInstant` (React 19 + Zustand 5 + GitHub Primer Design System + PNPM workspace).
2. **Sing-box Core Lifecycle, Subscription Fetching (`clash-verge/v2.4.7` default UA), & 4-Step MITM Root CA Engine** from `MaBoCoMark/sbagrepo`.
3. **Interactive SVG Bezier Connection Graph** inspired by `Antigravi-ty/QuickGitV0` for visualizing and editing dynamic **Chain Proxy (`detour`)** topologies across providers (`LC -> YY`, `LC -> LT -> YY`, and self-relay `LC -> LC`).

---

## Core Capabilities

### 1. Universal Mihomo YAML -> Sing-box 1.14.4 Converter
- **Target Core**: Verified against official **Sing-box 1.14.4** (`sing-box check -c config.json`).
- **Default User-Agent**: Uses `clash-verge/v2.4.7` by default (`mihomo/1.19.0`, `ClashMetaForAndroid/2.11.5`, and `SFA/1.14.4` selectable) so subscription backends emit modern VLESS Reality, Hysteria2, AnyTLS, and ECH parameters.
- **Manual Update by Default**: All imported Mihomo subscriptions default to `autoUpdateIntervalMinutes = 0` (no background auto-update polling).
- **Sing-box 1.14.4 Breaking-Change Adaptations**:
  - Converts Mihomo Hysteria2 port-hopping ranges (`ports: 61000-62000` / `mport`) into Sing-box 1.14.4 colon array format (`"server_ports": ["61000:62000"]`).
  - Automatically injects `route.default_domain_resolver` and per-outbound `domain_resolver`.
  - Auto-extracts subscription-level private authenticated DoH (`dns.proxy-server-nameserver`, e.g. `https://cn.ali-oss.cn:44443/dns-query/<token>`) into dedicated Sing-box `dns.servers` + `domain_resolver` bindings.
  - Enforces `tls.utls.enabled = true` on VLESS Reality outbounds and omits deprecated/invalid fields (`client_metadata` on `anytls`).

### 2. Dynamic Chain Proxy Engine & Regex-Friendly Naming Schemes
- Supports **1-Hop Cross-Provider (`LC -> YY`)**, **2-Hop Multi-Provider (`LC -> LT -> YY`)**, and **1-Hop Self-Relay (`LC -> LC`, e.g. LC Japan -> LC US)** using Sing-box `detour` chains.
- Solves the **Regex Filter Collision Problem**:
  - **Scheme A (`Recommended` — Tilde & Chevron Delimiter)**:
    - Direct: `YY-HongKong-01`
    - 1-Hop Chain: `CP1~LC>YY~[LC-JP-01]->YY-HK-01`
    - 2-Hop Chain: `CP2~LC>LT>YY~[LC-JP]->[LT-SG]->YY-US`
    - Self-Relay: `CP1~LC>LC~[LC-JP-01]->LC-US-01`
    - Why it works: Because chain proxies use `~` and `>` instead of `-` after the provider code, a simple regex `^YY-` or `YY-` matches **only Direct YY nodes**, while `^CP1~LC>YY~` matches 1-hop LC-to-YY chains and `(?:^YY-|~[^>]*>YY~)` matches all paths exiting at YY.
  - Also includes **Scheme B (`DIR-YY-` / `CP1-LC-YY-`)** and **Scheme C (`YY@DIR-` / `YY@CP1-LC-`)** with a live Regex Filter Tester.

### 3. Surge 5.10 Smart Transition Bridge (`aSingbox127.conf`)
- Exports **100% of nodes (Direct + Chain Proxies)** as local authenticated SOCKS5 endpoints (`127.0.0.1`, port `11400`, `username=000..999`, `password=0`) mapped via Sing-box `inbounds[0].users` and `route.rules[auth_user]`.
- Surge 5.10 handles Smart policy groups and rule routing while delegating all proxy protocols to Sing-box.

### 4. `skip-cert-verify: true` (`insecure: true`) Security Policy & Audit
- Provides an interactive 3-mode policy switch (`Follow Subscription Source with Warning`, `Allow Self-Signed on QUIC / Pinned Only`, `Enforce Strict CA Verification`) and per-subscription cryptographic audit table.

### 5. Format-Preserving Desensitized Config Exporter
- Redacts server IPs/domains, UUIDs, passwords, Reality public keys, and private DoH paths while preserving Sing-box 1.14.4 schema validity (`sing-box check` passes on the sanitized output) for safe troubleshooting.

---

## Development (Force PNPM)

```bash
pnpm install
pnpm dev
pnpm build
```
