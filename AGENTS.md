# AGENTS.md — SingboxGUIV0 Architecture & Engineering Guidelines

## 1. Package Manager & Build Artifacts
- **Force PNPM**: Always use `pnpm` (`pnpm install`, `pnpm build`, `pnpm dev`).
- **Ephemeral Build Directories**: In cloud container environments, link `node_modules`, `dist`, `.vite`, and `src-tauri/target` to `/tmp` (`tmpfs`) so build artifacts never pollute the overlay filesystem or git tree.

## 2. Sing-box 1.14.4 Schema Invariants
When modifying `src/utils/mihomoToSingboxConverter.ts`, `src/utils/chainProxyEngine.ts`, or `src/utils/configDesensitizer.ts`:
1. Always validate generated JSON with `/usr/local/bin/sing-box check -c <config.json>`.
2. Hysteria2 port hopping (`ports` / `mport` in Mihomo) must be emitted as `server_ports: ["start:end"]` (colon separator, never dash).
3. VLESS with `reality` must include `tls.utls: { enabled: true, fingerprint: ... }` and a valid 43-char base64url `public_key`.
4. `anytls` outbounds must NOT include `client_metadata` (rejected by Sing-box 1.14.4).
5. Shadowsocks `2022-blake3-*` outbounds require valid Base64 keys of 16 or 32 bytes even when desensitized.
