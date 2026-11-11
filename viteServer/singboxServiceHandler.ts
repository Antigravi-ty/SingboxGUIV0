import { ChildProcess, execFile, execFileSync, spawn } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import {
  ensureExecutablePermissions,
  getManagedBinaryPath,
  getManagedPidsLedgerPath,
  getSingboxConfigPath,
  getStableSingboxConfigPath,
  getStableSurgeConfigPath,
  getSurgeConfigPath,
  getWorkingSingboxConfigPath,
  getWorkingSurgeConfigPath,
  inspectSingboxConfigContent,
  loadUiConfigDisk,
  resolveAppConfigDir,
  resolveSingboxBinaryPath,
  saveUiConfigDisk,
} from "./binaryResolver";

const execFileAsync = promisify(execFile);

export type CoreProfileSlot = "stable" | "working";

interface ManagedPidRecord {
  pid: number;
  profile: CoreProfileSlot;
  configPath: string;
}

interface ManagedViteSingboxProcess {
  child: ChildProcess;
  pid: number;
  profile: CoreProfileSlot;
  binaryPath: string;
  configPath: string;
  listenAddress: string;
  logs: string[];
}

const activeSingboxSlots: {
  stable: ManagedViteSingboxProcess | null;
  working: ManagedViteSingboxProcess | null;
} = {
  stable: null,
  working: null,
};

export function normalizeProfileSlot(raw?: string): CoreProfileSlot {
  const s = String(raw || "").trim().toLowerCase();
  return s === "working" || s === "dynamic" || s === "test"
    ? "working"
    : "stable";
}

export function rewriteConfigInboundPortNode(
  content: string,
  listenIp: string,
  port: number
): string {
  try {
    const parsed = JSON.parse(content || "{}");
    if (Array.isArray(parsed.inbounds) && parsed.inbounds.length > 0) {
      if (listenIp && listenIp.trim()) {
        parsed.inbounds[0].listen = listenIp.trim();
      }
      parsed.inbounds[0].listen_port = port;
      return JSON.stringify(parsed, null, 2);
    }
  } catch {}
  return content;
}

function syncPidLedgerDiskNode(): void {
  const records: ManagedPidRecord[] = [];
  for (const key of ["stable", "working"] as const) {
    const proc = activeSingboxSlots[key];
    if (proc && proc.child.exitCode === null) {
      records.push({
        pid: proc.pid,
        profile: proc.profile,
        configPath: proc.configPath,
      });
    } else if (proc) {
      activeSingboxSlots[key] = null;
    }
  }
  try {
    fs.writeFileSync(
      getManagedPidsLedgerPath(),
      JSON.stringify(records, null, 2),
      "utf-8"
    );
  } catch {}
}

function verifyAndKillOwnedPidSync(pid: number, expectedConfigPath: string): void {
  if (!pid || pid <= 0) return;
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(pid), "/F"], { stdio: "ignore" });
      return;
    }
    const cmdline = execFileSync("ps", ["-p", String(pid), "-o", "args="], {
      encoding: "utf-8",
    }).trim();
    if (
      cmdline.includes("sing-box") &&
      (!expectedConfigPath || cmdline.includes(expectedConfigPath))
    ) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {}
    }
  } catch {}
}

export function cleanupOrphanedManagedPidsNode(): void {
  const ledgerPath = getManagedPidsLedgerPath();
  try {
    if (fs.existsSync(ledgerPath)) {
      const raw = fs.readFileSync(ledgerPath, "utf-8");
      const records = JSON.parse(raw);
      if (Array.isArray(records)) {
        for (const rec of records) {
          verifyAndKillOwnedPidSync(
            Number(rec?.pid),
            String(rec?.configPath || rec?.config_path || "")
          );
        }
      }
      fs.writeFileSync(ledgerPath, "[]", "utf-8");
    }
  } catch {}
}

export function stopActiveSingboxSlot(
  profile?: CoreProfileSlot | "all"
): Array<{ profile: CoreProfileSlot; pid: number; addr: string }> {
  const stopped: Array<{ profile: CoreProfileSlot; pid: number; addr: string }> =
    [];
  const targets: CoreProfileSlot[] =
    profile === "stable"
      ? ["stable"]
      : profile === "working"
      ? ["working"]
      : ["stable", "working"];

  for (const key of targets) {
    const proc = activeSingboxSlots[key];
    if (proc) {
      stopped.push({
        profile: key,
        pid: proc.pid,
        addr: proc.listenAddress,
      });
      try {
        proc.child.kill("SIGTERM");
      } catch {}
      activeSingboxSlots[key] = null;
    }
  }
  syncPidLedgerDiskNode();
  return stopped;
}

export function stopActiveSingboxProcess(): {
  stoppedPid: number | null;
  lastAddr: string;
} {
  const stopped = stopActiveSingboxSlot("all");
  if (stopped.length === 0) {
    return { stoppedPid: null, lastAddr: "127.0.0.1:11400" };
  }
  return {
    stoppedPid: stopped[0].pid,
    lastAddr: stopped[0].addr,
  };
}

let exitHooksRegistered = false;
function ensureProcessExitCleanupHooks(): void {
  if (exitHooksRegistered) return;
  exitHooksRegistered = true;
  cleanupOrphanedManagedPidsNode();

  const cleanupAllOwnedCores = () => {
    stopActiveSingboxSlot("all");
  };
  process.once("exit", cleanupAllOwnedCores);
  process.once("SIGINT", () => {
    cleanupAllOwnedCores();
    process.exit(0);
  });
  process.once("SIGTERM", () => {
    cleanupAllOwnedCores();
    process.exit(0);
  });
}

ensureProcessExitCleanupHooks();

export function getDualSlotStatusSnapshotNode() {
  const uiCfg = loadUiConfigDisk();
  const stableCfg = getStableSingboxConfigPath();
  const workingCfg = getWorkingSingboxConfigPath();
  const stableSurge = getStableSurgeConfigPath();
  const workingSurge = getWorkingSurgeConfigPath();

  if (
    activeSingboxSlots.stable &&
    activeSingboxSlots.stable.child.exitCode !== null
  ) {
    activeSingboxSlots.stable = null;
  }
  if (
    activeSingboxSlots.working &&
    activeSingboxSlots.working.child.exitCode !== null
  ) {
    activeSingboxSlots.working = null;
  }

  const stableProc = activeSingboxSlots.stable;
  const workingProc = activeSingboxSlots.working;

  return {
    stable_slot: {
      profile: "stable" as const,
      running: Boolean(stableProc),
      pid: stableProc ? stableProc.pid : null,
      config_path: stableProc ? stableProc.configPath : stableCfg,
      surge_config_path: stableSurge,
      listen_address: stableProc
        ? stableProc.listenAddress
        : `${uiCfg.listen_ip}:${uiCfg.listen_port}`,
    },
    working_slot: {
      profile: "working" as const,
      running: Boolean(workingProc),
      pid: workingProc ? workingProc.pid : null,
      config_path: workingProc ? workingProc.configPath : workingCfg,
      surge_config_path: workingSurge,
      listen_address: workingProc
        ? workingProc.listenAddress
        : `${uiCfg.listen_ip}:${uiCfg.working_listen_port}`,
    },
  };
}

export async function spawnSingboxProcessNode(
  profile: CoreProfileSlot,
  binaryPath: string,
  configDir: string,
  singboxCfgPath: string,
  listenAddress: string
): Promise<{ pid: number; logs: string[] }> {
  stopActiveSingboxSlot(profile);
  await new Promise((r) => setTimeout(r, 80));

  const logs: string[] = [];
  const child = spawn(binaryPath, ["run", "-c", singboxCfgPath], {
    cwd: configDir,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const appendLines = (chunk: Buffer) => {
    const lines = chunk.toString("utf-8").split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      if (logs.length >= 300) logs.shift();
      logs.push(`[${profile}] ${line}`);
    }
  };

  child.stdout?.on("data", appendLines);
  child.stderr?.on("data", appendLines);

  let exitedCode: number | null = null;
  let spawnErr: Error | null = null;
  child.once("exit", (code) => {
    exitedCode = code ?? 1;
    if (activeSingboxSlots[profile]?.child === child) {
      activeSingboxSlots[profile] = null;
      syncPidLedgerDiskNode();
    }
  });
  child.once("error", (err) => {
    spawnErr = err;
  });

  await new Promise((r) => setTimeout(r, 220));

  if (spawnErr) {
    throw new Error(
      `Failed to spawn sing-box (${profile}): ${(spawnErr as Error).message}`
    );
  }
  if (exitedCode !== null) {
    throw new Error(
      `sing-box (${profile}) exited immediately (code ${exitedCode}): ${
        logs.join("\n") || "Check port conflict or outbound parameters"
      }`
    );
  }

  const pid = child.pid || 0;
  activeSingboxSlots[profile] = {
    child,
    pid,
    profile,
    binaryPath,
    configPath: singboxCfgPath,
    listenAddress,
    logs,
  };
  syncPidLedgerDiskNode();
  return { pid, logs: [...logs] };
}

export async function handleSingboxServiceRoute(
  route: string,
  method: string,
  body: any,
  projectRoot: string
): Promise<{ status: number; payload: any } | null> {
  if (route === "/__singbox_api/ui-config" && method === "GET") {
    return { status: 200, payload: loadUiConfigDisk() };
  }

  if (route === "/__singbox_api/ui-config" && method === "POST") {
    const saved = saveUiConfigDisk(body || {});
    return { status: 200, payload: saved };
  }

  if (route === "/__singbox_api/tray-icon-style" && method === "POST") {
    const style = body?.style === "real" ? "real" : "monochrome";
    saveUiConfigDisk({ topbar_icon_style: style });
    return { status: 200, payload: { style } };
  }

  if (route === "/__singbox_api/singbox-check" && method === "POST") {
    const { configContent, surgeContent, promoteToStable } = body || {};
    const configDir = resolveAppConfigDir();
    const defaultCfgPath = getSingboxConfigPath();
    const stableCfgPath = getStableSingboxConfigPath();
    const workingCfgPath = getWorkingSingboxConfigPath();
    const defaultSurgePath = getSurgeConfigPath();
    const stableSurgePath = getStableSurgeConfigPath();
    const workingSurgePath = getWorkingSurgeConfigPath();
    const uiCfg = loadUiConfigDisk();

    const rawConfigStr = String(configContent || "");
    const workingJson = rewriteConfigInboundPortNode(
      rawConfigStr,
      uiCfg.listen_ip,
      uiCfg.working_listen_port
    );
    fs.writeFileSync(workingCfgPath, workingJson, "utf-8");

    const shouldPromoteStable =
      Boolean(promoteToStable) || !fs.existsSync(stableCfgPath);
    if (shouldPromoteStable) {
      const stableJson = rewriteConfigInboundPortNode(
        rawConfigStr,
        uiCfg.listen_ip,
        uiCfg.listen_port
      );
      fs.writeFileSync(stableCfgPath, stableJson, "utf-8");
      fs.writeFileSync(defaultCfgPath, stableJson, "utf-8");
      if (typeof surgeContent === "string") {
        fs.writeFileSync(stableSurgePath, surgeContent, "utf-8");
        fs.writeFileSync(defaultSurgePath, surgeContent, "utf-8");
      }
    }

    if (typeof surgeContent === "string") {
      const workingSurge = surgeContent.replaceAll(
        `${uiCfg.listen_ip}, ${uiCfg.listen_port}`,
        `${uiCfg.listen_ip}, ${uiCfg.working_listen_port}`
      );
      fs.writeFileSync(workingSurgePath, workingSurge, "utf-8");
      if (!fs.existsSync(defaultSurgePath)) {
        fs.writeFileSync(defaultSurgePath, surgeContent, "utf-8");
      }
    }

    const summary = inspectSingboxConfigContent(workingJson);
    summary.singbox_config_path = workingCfgPath;
    summary.surge_config_path = workingSurgePath;

    const resolved = await resolveSingboxBinaryPath(projectRoot);
    if (!resolved.found) {
      return {
        status: 200,
        payload: {
          valid: false,
          binary_found: false,
          binary_path: resolved.binaryPath,
          config_dir: configDir,
          singbox_config_path: workingCfgPath,
          stable_config_path: stableCfgPath,
          working_config_path: workingCfgPath,
          surge_config_path: workingSurgePath,
          summary,
          service_reloaded: false,
          searched_paths: resolved.searchedPaths.slice(0, 6),
          version: "sing-box 1.14.4",
          output: `BINARY_NOT_FOUND: Synced working config (${summary.proxy_outbound_count} proxy outbounds, ${summary.socks_user_count} SOCKS5 users) to ${workingCfgPath}, but sing-box binary is not imported yet.`,
        },
      };
    }

    try {
      const { stdout, stderr } = await execFileAsync(resolved.binaryPath, [
        "check",
        "-c",
        workingCfgPath,
      ]);
      const verOut = await execFileAsync(resolved.binaryPath, ["version"]).catch(
        () => ({ stdout: "sing-box 1.14.4" })
      );
      const firstLine =
        verOut.stdout.split(/\r?\n/).find((l) => l.trim().length > 0) ||
        "sing-box 1.14.4";

      // Hot-reload ONLY the working slot if it is running; never disturb the stable slot!
      let serviceReloaded = false;
      if (activeSingboxSlots.working && !summary.empty_workspace) {
        try {
          await spawnSingboxProcessNode(
            "working",
            resolved.binaryPath,
            configDir,
            workingCfgPath,
            summary.listen_address
          );
          serviceReloaded = true;
        } catch {}
      }

      const combined = (stdout + "\n" + stderr).trim();
      const formattedOutput = summary.empty_workspace
        ? `EMPTY_WORKSPACE: ${workingCfgPath} syntax check passed (0 errors), but it currently contains 0 proxy nodes (only 'direct' outbound, 0 SOCKS5 users). Import or enable a subscription to populate nodes.`
        : combined ||
          `sing-box check -c ${workingCfgPath} passed (0 errors) — Working config: ${summary.proxy_outbound_count} proxy outbounds (${summary.socks_user_count} SOCKS5 users on ${summary.listen_address}, ${summary.urltest_pool_count} dynamic pools, ${summary.dns_server_count} DNS servers, ${summary.file_size_bytes} bytes)${
            serviceReloaded
              ? " [Hot-reloaded Working core; Stable core untouched]"
              : ""
          }.`;

      return {
        status: 200,
        payload: {
          valid: true,
          binary_found: true,
          binary_path: resolved.binaryPath,
          config_dir: configDir,
          singbox_config_path: workingCfgPath,
          stable_config_path: stableCfgPath,
          working_config_path: workingCfgPath,
          surge_config_path: workingSurgePath,
          summary,
          service_reloaded: serviceReloaded,
          version: firstLine,
          output: formattedOutput,
        },
      };
    } catch (err: any) {
      const errMsg = [err?.stdout, err?.stderr, err?.message]
        .filter(Boolean)
        .join("\n")
        .trim();
      return {
        status: 200,
        payload: {
          valid: false,
          binary_found: true,
          binary_path: resolved.binaryPath,
          config_dir: configDir,
          singbox_config_path: workingCfgPath,
          stable_config_path: stableCfgPath,
          working_config_path: workingCfgPath,
          surge_config_path: workingSurgePath,
          summary,
          service_reloaded: false,
          version: "sing-box 1.14.4",
          output: errMsg || "sing-box check failed",
        },
      };
    }
  }

  if (route === "/__singbox_api/binary-status" && method === "GET") {
    const resolved = await resolveSingboxBinaryPath(projectRoot);
    if (!resolved.found) {
      return {
        status: 200,
        payload: {
          imported: false,
          binary_name: "sing-box",
          binary_path: resolved.binaryPath,
          managed_binary_path: resolved.managedBinaryPath,
          config_dir: resolved.configDir,
          singbox_config_path: resolved.singboxConfigPath,
          surge_config_path: resolved.surgeConfigPath,
          file_size: 0,
          version: null,
          searched_paths: resolved.searchedPaths.slice(0, 6),
        },
      };
    }
    try {
      const { stdout } = await execFileAsync(resolved.binaryPath, ["version"]);
      const firstLine =
        stdout.split(/\r?\n/).find((l) => l.trim().length > 0) ||
        "sing-box version 1.14.4";
      const stat = fs.existsSync(resolved.binaryPath)
        ? fs.statSync(resolved.binaryPath)
        : null;
      return {
        status: 200,
        payload: {
          imported: true,
          binary_name: "sing-box",
          binary_path: resolved.binaryPath,
          managed_binary_path: resolved.managedBinaryPath,
          config_dir: resolved.configDir,
          singbox_config_path: resolved.singboxConfigPath,
          surge_config_path: resolved.surgeConfigPath,
          file_size: stat ? stat.size : 0,
          version: firstLine.replace("sing-box version ", "").trim(),
          searched_paths: resolved.searchedPaths.slice(0, 6),
        },
      };
    } catch {
      return {
        status: 200,
        payload: {
          imported: false,
          binary_name: "sing-box",
          binary_path: resolved.binaryPath,
          managed_binary_path: resolved.managedBinaryPath,
          config_dir: resolved.configDir,
          singbox_config_path: resolved.singboxConfigPath,
          surge_config_path: resolved.surgeConfigPath,
          file_size: 0,
          version: null,
          searched_paths: resolved.searchedPaths.slice(0, 6),
        },
      };
    }
  }

  if (route === "/__singbox_api/import-binary" && method === "POST") {
    const { sourcePath, base64Data } = body || {};
    const managedBin = getManagedBinaryPath();
    if (sourcePath && String(sourcePath).trim()) {
      const src = String(sourcePath).trim();
      if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
        return {
          status: 400,
          payload: { error: `Selected file does not exist: ${src}` },
        };
      }
      if (src !== managedBin) {
        fs.copyFileSync(src, managedBin);
      }
    } else if (base64Data && String(base64Data).trim()) {
      const buf = Buffer.from(String(base64Data).trim(), "base64");
      if (buf.length < 1024) {
        return {
          status: 400,
          payload: {
            error: "Uploaded file is too small to be a valid sing-box binary.",
          },
        };
      }
      fs.writeFileSync(managedBin, buf);
    } else {
      return {
        status: 400,
        payload: { error: "Provide either sourcePath or base64Data." },
      };
    }

    ensureExecutablePermissions(managedBin);
    const { stdout } = await execFileAsync(managedBin, ["version"]);
    const firstLine =
      stdout.split(/\r?\n/).find((l) => l.trim().length > 0) ||
      "sing-box version 1.14.4";
    const stat = fs.statSync(managedBin);
    const resolved = await resolveSingboxBinaryPath(projectRoot);
    return {
      status: 200,
      payload: {
        imported: true,
        binary_name: "sing-box",
        binary_path: managedBin,
        managed_binary_path: managedBin,
        config_dir: resolved.configDir,
        singbox_config_path: resolved.singboxConfigPath,
        surge_config_path: resolved.surgeConfigPath,
        file_size: stat.size,
        version: firstLine.replace("sing-box version ", "").trim(),
        searched_paths: resolved.searchedPaths.slice(0, 6),
      },
    };
  }

  if (route === "/__singbox_api/open-config-folder" && method === "POST") {
    const configDir = resolveAppConfigDir();
    const singboxCfgPath = getSingboxConfigPath();
    const content = fs.existsSync(singboxCfgPath)
      ? fs.readFileSync(singboxCfgPath, "utf-8")
      : "";
    const opener =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
        ? "explorer"
        : "xdg-open";
    try {
      const child = spawn(opener, [configDir], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } catch {}
    return { status: 200, payload: inspectSingboxConfigContent(content) };
  }

  if (route === "/__singbox_api/service-start" && method === "POST") {
    const { configContent, surgeContent, profile } = body || {};
    const targetProfile = normalizeProfileSlot(profile);
    const configDir = resolveAppConfigDir();
    const defaultCfgPath = getSingboxConfigPath();
    const stableCfgPath = getStableSingboxConfigPath();
    const workingCfgPath = getWorkingSingboxConfigPath();
    const defaultSurgePath = getSurgeConfigPath();
    const stableSurgePath = getStableSurgeConfigPath();
    const workingSurgePath = getWorkingSurgeConfigPath();
    const uiCfg = loadUiConfigDisk();

    const activeCfgPath =
      targetProfile === "working" ? workingCfgPath : stableCfgPath;
    const activeSurgePath =
      targetProfile === "working" ? workingSurgePath : stableSurgePath;
    const targetPort =
      targetProfile === "working"
        ? uiCfg.working_listen_port
        : uiCfg.listen_port;

    const rewrittenJson = rewriteConfigInboundPortNode(
      String(configContent || ""),
      uiCfg.listen_ip,
      targetPort
    );
    fs.writeFileSync(activeCfgPath, rewrittenJson, "utf-8");
    if (targetProfile === "stable") {
      fs.writeFileSync(defaultCfgPath, rewrittenJson, "utf-8");
    }

    if (typeof surgeContent === "string") {
      if (targetProfile === "working") {
        const workingSurge = surgeContent.replaceAll(
          `${uiCfg.listen_ip}, ${uiCfg.listen_port}`,
          `${uiCfg.listen_ip}, ${uiCfg.working_listen_port}`
        );
        fs.writeFileSync(activeSurgePath, workingSurge, "utf-8");
      } else {
        fs.writeFileSync(activeSurgePath, surgeContent, "utf-8");
        fs.writeFileSync(defaultSurgePath, surgeContent, "utf-8");
      }
    }

    const summary = inspectSingboxConfigContent(rewrittenJson);
    const resolved = await resolveSingboxBinaryPath(projectRoot);
    if (!resolved.found) {
      return {
        status: 400,
        payload: {
          error: `sing-box binary not found at ${resolved.binaryPath}. Import the sing-box binary first.`,
        },
      };
    }

    await execFileAsync(resolved.binaryPath, ["check", "-c", activeCfgPath]);
    const { pid, logs } = await spawnSingboxProcessNode(
      targetProfile,
      resolved.binaryPath,
      configDir,
      activeCfgPath,
      summary.listen_address
    );
    const { stable_slot, working_slot } = getDualSlotStatusSnapshotNode();
    return {
      status: 200,
      payload: {
        running: true,
        pid,
        active_profile: targetProfile,
        binary_path: resolved.binaryPath,
        config_path: activeCfgPath,
        stable_config_path: stableCfgPath,
        working_config_path: workingCfgPath,
        surge_config_path: activeSurgePath,
        config_dir: configDir,
        listen_address: summary.listen_address,
        message: `Started sing-box [${targetProfile.toUpperCase()}] (PID ${pid}) with -c ${activeCfgPath} on ${summary.listen_address} (${summary.proxy_outbound_count} proxy outbounds, ${summary.socks_user_count} SOCKS5 users).`,
        recent_logs: logs,
        stable_slot,
        working_slot,
      },
    };
  }

  if (route === "/__singbox_api/service-stop" && method === "POST") {
    const { profile } = body || {};
    const targetSlot =
      profile === "stable" || profile === "working" ? profile : "all";
    const configDir = resolveAppConfigDir();
    const stableCfgPath = getStableSingboxConfigPath();
    const workingCfgPath = getWorkingSingboxConfigPath();
    const surgeCfgPath = getSurgeConfigPath();
    const resolved = await resolveSingboxBinaryPath(projectRoot);
    const stoppedList = stopActiveSingboxSlot(targetSlot);
    const { stable_slot, working_slot } = getDualSlotStatusSnapshotNode();
    const anyRunning = stable_slot.running || working_slot.running;
    const activePid = stable_slot.pid ?? working_slot.pid;

    const msg =
      stoppedList.length > 0
        ? `Stopped sing-box service: ${stoppedList
            .map((s) => `[${s.profile.toUpperCase()}] PID ${s.pid} on ${s.addr}`)
            .join(", ")}.`
        : "Sing-box service is already stopped.";

    return {
      status: 200,
      payload: {
        running: anyRunning,
        pid: activePid,
        active_profile: stable_slot.running
          ? "stable"
          : working_slot.running
          ? "working"
          : "stable",
        binary_path: resolved.binaryPath,
        config_path: stableCfgPath,
        stable_config_path: stableCfgPath,
        working_config_path: workingCfgPath,
        surge_config_path: surgeCfgPath,
        config_dir: configDir,
        listen_address: stable_slot.listen_address,
        message: msg,
        recent_logs: [],
        stable_slot,
        working_slot,
      },
    };
  }

  if (route === "/__singbox_api/service-status" && method === "GET") {
    const configDir = resolveAppConfigDir();
    const stableCfgPath = getStableSingboxConfigPath();
    const workingCfgPath = getWorkingSingboxConfigPath();
    const surgeCfgPath = getSurgeConfigPath();
    const resolved = await resolveSingboxBinaryPath(projectRoot);
    const { stable_slot, working_slot } = getDualSlotStatusSnapshotNode();
    const anyRunning = stable_slot.running || working_slot.running;

    const combinedLogs: string[] = [];
    if (activeSingboxSlots.stable) {
      combinedLogs.push(...activeSingboxSlots.stable.logs);
    }
    if (activeSingboxSlots.working) {
      combinedLogs.push(...activeSingboxSlots.working.logs);
    }

    const activeProfile =
      stable_slot.running && working_slot.running
        ? "dual (stable + working)"
        : working_slot.running
        ? "working"
        : "stable";

    const primaryCfg =
      working_slot.running && !stable_slot.running
        ? working_slot.config_path
        : stable_slot.config_path;
    const primaryAddr =
      working_slot.running && !stable_slot.running
        ? working_slot.listen_address
        : stable_slot.listen_address;

    let message = "sing-box service is stopped.";
    if (stable_slot.running && working_slot.running) {
      message = `Dual cores active: Stable (PID ${stable_slot.pid} on ${stable_slot.listen_address}) & Working (PID ${working_slot.pid} on ${working_slot.listen_address})`;
    } else if (stable_slot.running) {
      message = `sing-box [STABLE] (PID ${stable_slot.pid}) running on ${stable_slot.listen_address} (-c ${stable_slot.config_path})`;
    } else if (working_slot.running) {
      message = `sing-box [WORKING] (PID ${working_slot.pid}) running on ${working_slot.listen_address} (-c ${working_slot.config_path})`;
    }

    return {
      status: 200,
      payload: {
        running: anyRunning,
        pid: stable_slot.pid ?? working_slot.pid,
        active_profile: activeProfile,
        binary_path: resolved.binaryPath,
        config_path: primaryCfg,
        stable_config_path: stableCfgPath,
        working_config_path: workingCfgPath,
        surge_config_path: surgeCfgPath,
        config_dir: configDir,
        listen_address: primaryAddr,
        message,
        recent_logs: combinedLogs,
        stable_slot,
        working_slot,
      },
    };
  }

  return null;
}
