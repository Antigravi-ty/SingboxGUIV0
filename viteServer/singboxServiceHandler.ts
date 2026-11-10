import { ChildProcess, execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import {
  ensureExecutablePermissions,
  getManagedBinaryPath,
  getSingboxConfigPath,
  getSurgeConfigPath,
  inspectSingboxConfigContent,
  loadUiConfigDisk,
  resolveAppConfigDir,
  resolveSingboxBinaryPath,
  saveUiConfigDisk,
} from "./binaryResolver";

const execFileAsync = promisify(execFile);

interface ManagedViteSingboxProcess {
  child: ChildProcess;
  pid: number;
  binaryPath: string;
  configPath: string;
  listenAddress: string;
  logs: string[];
}

let activeSingboxProcess: ManagedViteSingboxProcess | null = null;

export function stopActiveSingboxProcess(): {
  stoppedPid: number | null;
  lastAddr: string;
} {
  if (!activeSingboxProcess) {
    return { stoppedPid: null, lastAddr: "127.0.0.1:11400" };
  }
  const pid = activeSingboxProcess.pid;
  const addr = activeSingboxProcess.listenAddress;
  try {
    activeSingboxProcess.child.kill("SIGTERM");
  } catch {}
  activeSingboxProcess = null;
  return { stoppedPid: pid, lastAddr: addr };
}

export async function spawnSingboxProcessNode(
  binaryPath: string,
  configDir: string,
  singboxCfgPath: string,
  listenAddress: string
): Promise<{ pid: number; logs: string[] }> {
  stopActiveSingboxProcess();
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
      logs.push(line);
    }
  };

  child.stdout?.on("data", appendLines);
  child.stderr?.on("data", appendLines);

  let exitedCode: number | null = null;
  let spawnErr: Error | null = null;
  child.once("exit", (code) => {
    exitedCode = code ?? 1;
    if (activeSingboxProcess?.child === child) {
      activeSingboxProcess = null;
    }
  });
  child.once("error", (err) => {
    spawnErr = err;
  });

  await new Promise((r) => setTimeout(r, 220));

  if (spawnErr) {
    throw new Error(`Failed to spawn sing-box: ${(spawnErr as Error).message}`);
  }
  if (exitedCode !== null) {
    throw new Error(
      `sing-box exited immediately (code ${exitedCode}): ${
        logs.join("\n") || "Check port conflict or outbound parameters"
      }`
    );
  }

  const pid = child.pid || 0;
  activeSingboxProcess = {
    child,
    pid,
    binaryPath,
    configPath: singboxCfgPath,
    listenAddress,
    logs,
  };
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
    const { configContent, surgeContent } = body || {};
    const configDir = resolveAppConfigDir();
    const singboxCfgPath = getSingboxConfigPath();
    const surgeCfgPath = getSurgeConfigPath();

    fs.writeFileSync(singboxCfgPath, String(configContent || ""), "utf-8");
    if (typeof surgeContent === "string") {
      fs.writeFileSync(surgeCfgPath, surgeContent, "utf-8");
    }

    const summary = inspectSingboxConfigContent(String(configContent || ""));
    const resolved = await resolveSingboxBinaryPath(projectRoot);
    if (!resolved.found) {
      return {
        status: 200,
        payload: {
          valid: false,
          binary_found: false,
          binary_path: resolved.binaryPath,
          config_dir: configDir,
          singbox_config_path: singboxCfgPath,
          surge_config_path: surgeCfgPath,
          summary,
          service_reloaded: false,
          searched_paths: resolved.searchedPaths.slice(0, 6),
          version: "sing-box 1.14.4",
          output: `BINARY_NOT_FOUND: Synced config.json (${summary.proxy_outbound_count} proxy outbounds, ${summary.socks_user_count} SOCKS5 users) to ${singboxCfgPath}, but sing-box binary is not imported yet.`,
        },
      };
    }

    try {
      const { stdout, stderr } = await execFileAsync(resolved.binaryPath, [
        "check",
        "-c",
        singboxCfgPath,
      ]);
      const verOut = await execFileAsync(resolved.binaryPath, ["version"]).catch(
        () => ({ stdout: "sing-box 1.14.4" })
      );
      const firstLine =
        verOut.stdout.split(/\r?\n/).find((l) => l.trim().length > 0) ||
        "sing-box 1.14.4";

      let serviceReloaded = false;
      if (activeSingboxProcess && !summary.empty_workspace) {
        try {
          await spawnSingboxProcessNode(
            resolved.binaryPath,
            configDir,
            singboxCfgPath,
            summary.listen_address
          );
          serviceReloaded = true;
        } catch {}
      }

      const combined = (stdout + "\n" + stderr).trim();
      const formattedOutput = summary.empty_workspace
        ? `EMPTY_WORKSPACE: ${singboxCfgPath} syntax check passed (0 errors), but it currently contains 0 proxy nodes (only 'direct' outbound, 0 SOCKS5 users). Import or enable a subscription to populate nodes.`
        : combined ||
          `sing-box check -c ${singboxCfgPath} passed (0 errors) — Active contents: ${summary.proxy_outbound_count} proxy outbounds (${summary.socks_user_count} SOCKS5 users on ${summary.listen_address}, ${summary.urltest_pool_count} dynamic pools, ${summary.dns_server_count} DNS servers, ${summary.file_size_bytes} bytes)${
            serviceReloaded ? " [Hot-reloaded running sing-box service]" : ""
          }.`;

      return {
        status: 200,
        payload: {
          valid: true,
          binary_found: true,
          binary_path: resolved.binaryPath,
          config_dir: configDir,
          singbox_config_path: singboxCfgPath,
          surge_config_path: surgeCfgPath,
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
          singbox_config_path: singboxCfgPath,
          surge_config_path: surgeCfgPath,
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
    const { configContent, surgeContent } = body || {};
    const configDir = resolveAppConfigDir();
    const singboxCfgPath = getSingboxConfigPath();
    const surgeCfgPath = getSurgeConfigPath();

    fs.writeFileSync(singboxCfgPath, String(configContent || ""), "utf-8");
    if (typeof surgeContent === "string") {
      fs.writeFileSync(surgeCfgPath, surgeContent, "utf-8");
    }

    const summary = inspectSingboxConfigContent(String(configContent || ""));
    const resolved = await resolveSingboxBinaryPath(projectRoot);
    if (!resolved.found) {
      return {
        status: 400,
        payload: {
          error: `sing-box binary not found at ${resolved.binaryPath}. Import the sing-box binary first.`,
        },
      };
    }

    await execFileAsync(resolved.binaryPath, ["check", "-c", singboxCfgPath]);
    const { pid, logs } = await spawnSingboxProcessNode(
      resolved.binaryPath,
      configDir,
      singboxCfgPath,
      summary.listen_address
    );
    return {
      status: 200,
      payload: {
        running: true,
        pid,
        binary_path: resolved.binaryPath,
        config_path: singboxCfgPath,
        surge_config_path: surgeCfgPath,
        config_dir: configDir,
        listen_address: summary.listen_address,
        message: `Started sing-box (PID ${pid}) with -c ${singboxCfgPath} on ${summary.listen_address} (${summary.proxy_outbound_count} proxy outbounds, ${summary.socks_user_count} SOCKS5 users).`,
        recent_logs: logs,
      },
    };
  }

  if (route === "/__singbox_api/service-stop" && method === "POST") {
    const configDir = resolveAppConfigDir();
    const singboxCfgPath = getSingboxConfigPath();
    const surgeCfgPath = getSurgeConfigPath();
    const resolved = await resolveSingboxBinaryPath(projectRoot);
    const { stoppedPid, lastAddr } = stopActiveSingboxProcess();
    return {
      status: 200,
      payload: {
        running: false,
        pid: null,
        binary_path: resolved.binaryPath,
        config_path: singboxCfgPath,
        surge_config_path: surgeCfgPath,
        config_dir: configDir,
        listen_address: lastAddr,
        message: stoppedPid
          ? `Stopped sing-box service (PID ${stoppedPid}) on ${lastAddr}.`
          : "Sing-box service is already stopped.",
        recent_logs: [],
      },
    };
  }

  if (route === "/__singbox_api/service-status" && method === "GET") {
    const configDir = resolveAppConfigDir();
    const singboxCfgPath = getSingboxConfigPath();
    const surgeCfgPath = getSurgeConfigPath();
    const resolved = await resolveSingboxBinaryPath(projectRoot);
    if (activeSingboxProcess && activeSingboxProcess.child.exitCode === null) {
      return {
        status: 200,
        payload: {
          running: true,
          pid: activeSingboxProcess.pid,
          binary_path: activeSingboxProcess.binaryPath,
          config_path: activeSingboxProcess.configPath,
          surge_config_path: surgeCfgPath,
          config_dir: configDir,
          listen_address: activeSingboxProcess.listenAddress,
          message: `sing-box (PID ${activeSingboxProcess.pid}) running on ${activeSingboxProcess.listenAddress} (-c ${activeSingboxProcess.configPath})`,
          recent_logs: [...activeSingboxProcess.logs],
        },
      };
    }
    activeSingboxProcess = null;
    return {
      status: 200,
      payload: {
        running: false,
        pid: null,
        binary_path: resolved.binaryPath,
        config_path: singboxCfgPath,
        surge_config_path: surgeCfgPath,
        config_dir: configDir,
        listen_address: "127.0.0.1:11400",
        message: "sing-box service is stopped.",
        recent_logs: [],
      },
    };
  }

  return null;
}
