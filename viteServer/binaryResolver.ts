import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const execFileAsync = promisify(execFile);

export const APP_IDENTIFIER = "com.antigravity.singboxguiv0";

export function resolveAppConfigDir(): string {
  const home = os.homedir();
  let dir: string;
  if (process.platform === "darwin") {
    dir = path.join(home, "Library", "Application Support", APP_IDENTIFIER);
  } else if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    dir = path.join(appData, APP_IDENTIFIER);
  } else {
    const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
    dir = path.join(xdgConfig, APP_IDENTIFIER);
  }
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getManagedBinaryPath(): string {
  const binName = process.platform === "win32" ? "sing-box.exe" : "sing-box";
  return path.join(resolveAppConfigDir(), binName);
}

export function getSingboxConfigPath(): string {
  return path.join(resolveAppConfigDir(), "config.json");
}

export function getStableSingboxConfigPath(): string {
  return path.join(resolveAppConfigDir(), "config.stable.json");
}

export function getWorkingSingboxConfigPath(): string {
  return path.join(resolveAppConfigDir(), "config.working.json");
}

export function getSurgeConfigPath(): string {
  return path.join(resolveAppConfigDir(), "aSingbox127.conf");
}

export function getStableSurgeConfigPath(): string {
  return path.join(resolveAppConfigDir(), "aSingbox127.stable.conf");
}

export function getWorkingSurgeConfigPath(): string {
  return path.join(resolveAppConfigDir(), "aSingbox127.working.conf");
}

export function getUiConfigPath(): string {
  return path.join(resolveAppConfigDir(), "ui-config.json");
}

export function getManagedPidsLedgerPath(): string {
  return path.join(resolveAppConfigDir(), "managed-pids.json");
}

export interface PersistedUiConfig {
  listen_ip: string;
  listen_port: number;
  working_listen_port: number;
  auto_detect_interface: boolean;
  advanced_mode: boolean;
  topbar_icon_style: "monochrome" | "real";
  color_mode: "light" | "dark";
  include_surge_proxy_groups: boolean;
}

export function loadUiConfigDisk(): PersistedUiConfig {
  const defaultCfg: PersistedUiConfig = {
    listen_ip: "127.0.0.1",
    listen_port: 11400,
    working_listen_port: 11401,
    auto_detect_interface: true,
    advanced_mode: false,
    topbar_icon_style: "monochrome",
    color_mode: "light",
    include_surge_proxy_groups: true,
  };
  const cfgPath = getUiConfigPath();
  try {
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        listen_ip: String(parsed.listen_ip || defaultCfg.listen_ip),
        listen_port: Number(parsed.listen_port) || defaultCfg.listen_port,
        working_listen_port:
          Number(parsed.working_listen_port) || defaultCfg.working_listen_port,
        auto_detect_interface:
          typeof parsed.auto_detect_interface === "boolean"
            ? parsed.auto_detect_interface
            : defaultCfg.auto_detect_interface,
        advanced_mode: Boolean(parsed.advanced_mode),
        topbar_icon_style:
          parsed.topbar_icon_style === "real" ? "real" : "monochrome",
        color_mode: parsed.color_mode === "dark" ? "dark" : "light",
        include_surge_proxy_groups:
          typeof parsed.include_surge_proxy_groups === "boolean"
            ? parsed.include_surge_proxy_groups
            : true,
      };
    } else {
      fs.writeFileSync(cfgPath, JSON.stringify(defaultCfg, null, 2), "utf-8");
    }
  } catch {}
  return defaultCfg;
}

export function saveUiConfigDisk(
  partial: Partial<PersistedUiConfig>
): PersistedUiConfig {
  const current = loadUiConfigDisk();
  const merged: PersistedUiConfig = {
    ...current,
    ...partial,
  };
  try {
    fs.writeFileSync(getUiConfigPath(), JSON.stringify(merged, null, 2), "utf-8");
  } catch {}
  return merged;
}

export function ensureExecutablePermissions(filePath: string): void {
  if (process.platform !== "win32") {
    try {
      fs.chmodSync(filePath, 0o755);
    } catch {}
  }
}

export interface ConfigInspectSummary {
  config_dir: string;
  singbox_config_path: string;
  surge_config_path: string;
  total_outbounds: number;
  proxy_outbound_count: number;
  urltest_pool_count: number;
  socks_user_count: number;
  dns_server_count: number;
  listen_address: string;
  file_size_bytes: number;
  empty_workspace: boolean;
}

export function inspectSingboxConfigContent(
  configContent: string
): ConfigInspectSummary {
  const configDir = resolveAppConfigDir();
  const singboxCfgPath = getSingboxConfigPath();
  const surgeCfgPath = getSurgeConfigPath();
  let parsed: any = {};
  try {
    parsed = JSON.parse(configContent || "{}");
  } catch {}

  const outbounds = Array.isArray(parsed?.outbounds) ? parsed.outbounds : [];
  const totalOutbounds = outbounds.length;
  let proxyOutboundCount = 0;
  let urltestPoolCount = 0;
  for (const ob of outbounds) {
    const t = String(ob?.type || "");
    if (t === "direct" || t === "block" || t === "dns") {
      continue;
    } else if (t === "urltest" || t === "selector") {
      urltestPoolCount++;
    } else if (t) {
      proxyOutboundCount++;
    }
  }

  const firstInbound = Array.isArray(parsed?.inbounds)
    ? parsed.inbounds[0]
    : null;
  const socksUserCount = Array.isArray(firstInbound?.users)
    ? firstInbound.users.length
    : 0;
  const listenIp = String(firstInbound?.listen || "127.0.0.1");
  const listenPort = Number(firstInbound?.listen_port) || 11400;
  const dnsServerCount = Array.isArray(parsed?.dns?.servers)
    ? parsed.dns.servers.length
    : 0;

  let fileSize = Buffer.byteLength(configContent || "", "utf-8");
  try {
    if (fs.existsSync(singboxCfgPath)) {
      fileSize = fs.statSync(singboxCfgPath).size;
    }
  } catch {}

  return {
    config_dir: configDir,
    singbox_config_path: singboxCfgPath,
    surge_config_path: surgeCfgPath,
    total_outbounds: totalOutbounds,
    proxy_outbound_count: proxyOutboundCount,
    urltest_pool_count: urltestPoolCount,
    socks_user_count: socksUserCount,
    dns_server_count: dnsServerCount,
    listen_address: `${listenIp}:${listenPort}`,
    file_size_bytes: fileSize,
    empty_workspace: proxyOutboundCount === 0,
  };
}

export function getCandidateBinaryPaths(projectRoot: string): string[] {
  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";
  const appConfigDir = resolveAppConfigDir();

  const names = isWin
    ? [
        "sing-box.exe",
        "sing-box-x86_64-pc-windows-msvc.exe",
        "sing-box-aarch64-pc-windows-msvc.exe",
      ]
    : isMac
    ? [
        "sing-box",
        "sing-box-aarch64-apple-darwin",
        "sing-box-x86_64-apple-darwin",
      ]
    : [
        "sing-box",
        "sing-box-x86_64-unknown-linux-gnu",
        "sing-box-aarch64-unknown-linux-gnu",
      ];

  const candidates: string[] = [];
  // 1. Primary Canonical Location: Application Support Dir
  for (const name of names) {
    candidates.push(path.join(appConfigDir, name));
  }

  // 2. Project Local & Sidecar Directories
  for (const name of names) {
    candidates.push(path.join(projectRoot, "bin", name));
    candidates.push(path.join(projectRoot, "src-tauri", "binaries", name));
    candidates.push(path.join(projectRoot, name));
    candidates.push(path.join(projectRoot, "src-tauri", name));
  }

  // 3. System-wide Paths
  candidates.push("/opt/homebrew/bin/sing-box");
  candidates.push("/usr/local/bin/sing-box");
  candidates.push("/usr/bin/sing-box");
  return candidates;
}

export async function resolveSingboxBinaryPath(projectRoot: string): Promise<{
  found: boolean;
  binaryPath: string;
  managedBinaryPath: string;
  configDir: string;
  singboxConfigPath: string;
  surgeConfigPath: string;
  searchedPaths: string[];
}> {
  const configDir = resolveAppConfigDir();
  const managedBinaryPath = getManagedBinaryPath();
  const singboxConfigPath = getSingboxConfigPath();
  const surgeConfigPath = getSurgeConfigPath();
  const searchedPaths = getCandidateBinaryPaths(projectRoot);

  if (
    fs.existsSync(managedBinaryPath) &&
    fs.statSync(managedBinaryPath).isFile()
  ) {
    ensureExecutablePermissions(managedBinaryPath);
    return {
      found: true,
      binaryPath: managedBinaryPath,
      managedBinaryPath,
      configDir,
      singboxConfigPath,
      surgeConfigPath,
      searchedPaths,
    };
  }

  for (const candidate of searchedPaths) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        if (candidate !== managedBinaryPath) {
          try {
            fs.copyFileSync(candidate, managedBinaryPath);
            ensureExecutablePermissions(managedBinaryPath);
            return {
              found: true,
              binaryPath: managedBinaryPath,
              managedBinaryPath,
              configDir,
              singboxConfigPath,
              surgeConfigPath,
              searchedPaths,
            };
          } catch {}
        }
        ensureExecutablePermissions(candidate);
        return {
          found: true,
          binaryPath: candidate,
          managedBinaryPath,
          configDir,
          singboxConfigPath,
          surgeConfigPath,
          searchedPaths,
        };
      }
    } catch {}
  }

  try {
    const { stdout } = await execFileAsync("which", ["sing-box"]);
    const resolved = stdout.trim().split(/\r?\n/)[0];
    if (resolved && fs.existsSync(resolved)) {
      try {
        fs.copyFileSync(resolved, managedBinaryPath);
        ensureExecutablePermissions(managedBinaryPath);
        return {
          found: true,
          binaryPath: managedBinaryPath,
          managedBinaryPath,
          configDir,
          singboxConfigPath,
          surgeConfigPath,
          searchedPaths,
        };
      } catch {}
      return {
        found: true,
        binaryPath: resolved,
        managedBinaryPath,
        configDir,
        singboxConfigPath,
        surgeConfigPath,
        searchedPaths,
      };
    }
  } catch {}

  return {
    found: false,
    binaryPath: managedBinaryPath,
    managedBinaryPath,
    configDir,
    singboxConfigPath,
    surgeConfigPath,
    searchedPaths,
  };
}
