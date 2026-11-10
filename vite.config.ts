import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { ChildProcess, execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import * as net from "node:net";
import {
  ensureExecutablePermissions,
  getManagedBinaryPath,
  getSingboxConfigPath,
  getSurgeConfigPath,
  inspectSingboxConfigContent,
  resolveAppConfigDir,
  resolveSingboxBinaryPath,
} from "./viteServer/binaryResolver";
import {
  checkTcpPortAvailability,
  runConnectivityProbe,
} from "./viteServer/connectivityHandler";

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

function stopActiveSingboxProcess(): { stoppedPid: number | null; lastAddr: string } {
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

async function spawnSingboxProcessNode(
  binaryPath: string,
  configDir: string,
  singboxCfgPath: string,
  listenAddress: string
): Promise<{ pid: number; logs: string[] }> {
  stopActiveSingboxProcess();
  await new Promise((r) => setTimeout(r, 120));

  const logs: string[] = [];
  const child = spawn(binaryPath, ["run", "-c", singboxCfgPath], {
    cwd: configDir,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const appendLines = (chunk: Buffer) => {
    const lines = chunk.toString("utf-8").split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      if (logs.length >= 250) logs.shift();
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

  await new Promise((r) => setTimeout(r, 320));

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

function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: any, status: number, payload: any) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function singboxDevApiPlugin(): Plugin {
  const projectRoot = process.cwd();
  return {
    name: "singbox-dev-api-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/__singbox_api/")) {
          return next();
        }
        const route = req.url.split("?")[0];
        try {
          if (route === "/__singbox_api/fetch-subscription" && req.method === "POST") {
            const { url, userAgent } = await readJsonBody(req);
            const trimmedUrl = String(url || "").trim();
            if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
              return sendJson(res, 400, {
                error: "Subscription URL must start with http:// or https://",
              });
            }
            const ua = String(userAgent || "").trim() || "clash-verge/v2.4.7";
            const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const hdrFile = path.join(os.tmpdir(), `sb_hdr_${id}.txt`);
            const bodyFile = path.join(os.tmpdir(), `sb_body_${id}.txt`);
            try {
              await execFileAsync("curl", [
                "-sSL",
                "--max-time",
                "20",
                "-A",
                ua,
                "-D",
                hdrFile,
                "-o",
                bodyFile,
                trimmedUrl,
              ]);
              const rawHeaders = fs.existsSync(hdrFile)
                ? fs.readFileSync(hdrFile, "utf-8")
                : "";
              const body = fs.existsSync(bodyFile)
                ? fs.readFileSync(bodyFile, "utf-8")
                : "";
              const headers: Record<string, string> = {};
              let status = 200;
              let userInfoHeader: string | null = null;
              for (const line of rawHeaders.split(/\r?\n/)) {
                const t = line.trim();
                if (t.startsWith("HTTP/")) {
                  const parts = t.split(/\s+/);
                  if (parts.length >= 2 && !Number.isNaN(Number(parts[1]))) {
                    status = Number(parts[1]);
                  }
                } else if (t.includes(":")) {
                  const idx = t.indexOf(":");
                  const k = t.slice(0, idx).trim();
                  const v = t.slice(idx + 1).trim();
                  if (k.toLowerCase() === "subscription-userinfo") {
                    userInfoHeader = v;
                  }
                  headers[k] = v;
                }
              }
              return sendJson(res, 200, {
                status,
                headers,
                body,
                userInfoHeader,
              });
            } finally {
              try {
                if (fs.existsSync(hdrFile)) fs.unlinkSync(hdrFile);
                if (fs.existsSync(bodyFile)) fs.unlinkSync(bodyFile);
              } catch {}
            }
          }

          if (route === "/__singbox_api/singbox-check" && req.method === "POST") {
            const { configContent, surgeContent } = await readJsonBody(req);
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
              return sendJson(res, 200, {
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
              });
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

              return sendJson(res, 200, {
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
              });
            } catch (err: any) {
              const errMsg = [err?.stdout, err?.stderr, err?.message]
                .filter(Boolean)
                .join("\n")
                .trim();
              return sendJson(res, 200, {
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
              });
            }
          }

          if (route === "/__singbox_api/binary-status" && req.method === "GET") {
            const resolved = await resolveSingboxBinaryPath(projectRoot);
            if (!resolved.found) {
              return sendJson(res, 200, {
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
              });
            }
            try {
              const { stdout } = await execFileAsync(resolved.binaryPath, ["version"]);
              const firstLine =
                stdout.split(/\r?\n/).find((l) => l.trim().length > 0) ||
                "sing-box version 1.14.4";
              const stat = fs.existsSync(resolved.binaryPath)
                ? fs.statSync(resolved.binaryPath)
                : null;
              return sendJson(res, 200, {
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
              });
            } catch {
              return sendJson(res, 200, {
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
              });
            }
          }

          if (route === "/__singbox_api/import-binary" && req.method === "POST") {
            const { sourcePath, base64Data } = await readJsonBody(req);
            const managedBin = getManagedBinaryPath();
            if (sourcePath && String(sourcePath).trim()) {
              const src = String(sourcePath).trim();
              if (!fs.existsSync(src) || !fs.statSync(src).isFile()) {
                return sendJson(res, 400, {
                  error: `Selected file does not exist: ${src}`,
                });
              }
              if (src !== managedBin) {
                fs.copyFileSync(src, managedBin);
              }
            } else if (base64Data && String(base64Data).trim()) {
              const buf = Buffer.from(String(base64Data).trim(), "base64");
              if (buf.length < 1024) {
                return sendJson(res, 400, {
                  error: "Uploaded file is too small to be a valid sing-box binary.",
                });
              }
              fs.writeFileSync(managedBin, buf);
            } else {
              return sendJson(res, 400, {
                error: "Provide either sourcePath or base64Data.",
              });
            }

            ensureExecutablePermissions(managedBin);
            const { stdout } = await execFileAsync(managedBin, ["version"]);
            const firstLine =
              stdout.split(/\r?\n/).find((l) => l.trim().length > 0) ||
              "sing-box version 1.14.4";
            const stat = fs.statSync(managedBin);
            const resolved = await resolveSingboxBinaryPath(projectRoot);
            return sendJson(res, 200, {
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
            });
          }

          if (route === "/__singbox_api/open-config-folder" && req.method === "POST") {
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
            return sendJson(res, 200, inspectSingboxConfigContent(content));
          }

          if (route === "/__singbox_api/service-start" && req.method === "POST") {
            const { configContent, surgeContent } = await readJsonBody(req);
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
              return sendJson(res, 400, {
                error: `sing-box binary not found at ${resolved.binaryPath}. Import the sing-box binary first.`,
              });
            }

            await execFileAsync(resolved.binaryPath, ["check", "-c", singboxCfgPath]);
            const { pid, logs } = await spawnSingboxProcessNode(
              resolved.binaryPath,
              configDir,
              singboxCfgPath,
              summary.listen_address
            );
            return sendJson(res, 200, {
              running: true,
              pid,
              binary_path: resolved.binaryPath,
              config_path: singboxCfgPath,
              surge_config_path: surgeCfgPath,
              config_dir: configDir,
              listen_address: summary.listen_address,
              message: `Started sing-box (PID ${pid}) with -c ${singboxCfgPath} on ${summary.listen_address} (${summary.proxy_outbound_count} proxy outbounds, ${summary.socks_user_count} SOCKS5 users).`,
              recent_logs: logs,
            });
          }

          if (route === "/__singbox_api/service-stop" && req.method === "POST") {
            const configDir = resolveAppConfigDir();
            const singboxCfgPath = getSingboxConfigPath();
            const surgeCfgPath = getSurgeConfigPath();
            const resolved = await resolveSingboxBinaryPath(projectRoot);
            const { stoppedPid, lastAddr } = stopActiveSingboxProcess();
            return sendJson(res, 200, {
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
            });
          }

          if (route === "/__singbox_api/service-status" && req.method === "GET") {
            const configDir = resolveAppConfigDir();
            const singboxCfgPath = getSingboxConfigPath();
            const surgeCfgPath = getSurgeConfigPath();
            const resolved = await resolveSingboxBinaryPath(projectRoot);
            if (activeSingboxProcess && activeSingboxProcess.child.exitCode === null) {
              return sendJson(res, 200, {
                running: true,
                pid: activeSingboxProcess.pid,
                binary_path: activeSingboxProcess.binaryPath,
                config_path: activeSingboxProcess.configPath,
                surge_config_path: surgeCfgPath,
                config_dir: configDir,
                listen_address: activeSingboxProcess.listenAddress,
                message: `sing-box (PID ${activeSingboxProcess.pid}) running on ${activeSingboxProcess.listenAddress} (-c ${activeSingboxProcess.configPath})`,
                recent_logs: [...activeSingboxProcess.logs],
              });
            }
            activeSingboxProcess = null;
            return sendJson(res, 200, {
              running: false,
              pid: null,
              binary_path: resolved.binaryPath,
              config_path: singboxCfgPath,
              surge_config_path: surgeCfgPath,
              config_dir: configDir,
              listen_address: "127.0.0.1:11400",
              message: "sing-box service is stopped.",
              recent_logs: [],
            });
          }

          if (route === "/__singbox_api/check-port" && req.method === "POST") {
            const { host, port } = await readJsonBody(req);
            const targetPort = Math.max(1, Math.min(65535, Number(port) || 11400));
            const status = await checkTcpPortAvailability(
              String(host || "127.0.0.1"),
              targetPort
            );
            return sendJson(res, 200, status);
          }

          if (route === "/__singbox_api/connectivity-test" && req.method === "POST") {
            const body = await readJsonBody(req);
            const result = await runConnectivityProbe(body || {});
            return sendJson(res, 200, result);
          }

          if (route === "/__singbox_api/generate-ca" && req.method === "POST") {
            const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const certFile = path.join(os.tmpdir(), `sb_ca_${id}.crt`);
            const keyFile = path.join(os.tmpdir(), `sb_ca_${id}.key`);
            try {
              await execFileAsync("openssl", [
                "req",
                "-x509",
                "-newkey",
                "ec",
                "-pkeyopt",
                "ec_paramgen_curve:prime256v1",
                "-days",
                "3650",
                "-nodes",
                "-subj",
                "/C=US/O=SingboxGUIV0/CN=SingboxGUIV0 Local MITM Root CA",
                "-addext",
                "basicConstraints=critical,CA:TRUE",
                "-addext",
                "keyUsage=critical,keyCertSign,cRLSign",
                "-keyout",
                keyFile,
                "-out",
                certFile,
              ]);
              const cert_pem = fs.readFileSync(certFile, "utf-8");
              const key_pem = fs.readFileSync(keyFile, "utf-8");
              return sendJson(res, 200, { cert_pem, key_pem });
            } finally {
              try {
                if (fs.existsSync(certFile)) fs.unlinkSync(certFile);
                if (fs.existsSync(keyFile)) fs.unlinkSync(keyFile);
              } catch {}
            }
          }

          if (route === "/__singbox_api/validate-cert" && req.method === "POST") {
            const { cert_pem, key_pem, store_in_keychain } = await readJsonBody(req);
            const x509 = new crypto.X509Certificate(String(cert_pem || "").trim());
            const privKey = crypto.createPrivateKey(String(key_pem || "").trim());
            const keyMatched = x509.checkPrivateKey(privKey);
            const now = Date.now();
            const validFromMs = Date.parse(x509.validFrom);
            const validToMs = Date.parse(x509.validTo);
            const isExpired = now < validFromMs || now > validToMs;
            const isCa = Boolean(x509.ca);
            const keyType = privKey.asymmetricKeyType || "ec";
            return sendJson(res, 200, {
              success: !isExpired && isCa && keyMatched,
              subject: x509.subject.replace(/\n/g, ", "),
              issuer: x509.issuer.replace(/\n/g, ", "),
              not_before: x509.validFrom,
              not_after: x509.validTo,
              is_expired: isExpired,
              is_ca: isCa,
              key_pair_matched: keyMatched,
              key_algorithm: keyType.toUpperCase(),
              key_storage: store_in_keychain ? "System Keychain" : "App Config Dir",
              cert_path: "/tmp/singbox_ca.crt",
              key_path: store_in_keychain ? null : "/tmp/singbox_ca.key",
              steps: [
                {
                  step_number: 1,
                  name: "PEM Syntax Parse",
                  passed: true,
                  message: "Valid X.509 Certificate & Private Key PEM blocks",
                },
                {
                  step_number: 2,
                  name: "Validity Window",
                  passed: !isExpired,
                  message: `${x509.validFrom} -> ${x509.validTo}`,
                },
                {
                  step_number: 3,
                  name: "CA BasicConstraints",
                  passed: isCa,
                  message: isCa
                    ? "Verified BasicConstraints cA=TRUE"
                    : "Certificate is NOT a Root CA (cA=FALSE)",
                },
                {
                  step_number: 4,
                  name: "Public/Private Key Pair Match",
                  passed: keyMatched,
                  message: keyMatched
                    ? "Cryptographic public/private key pair verified"
                    : "Private key does NOT match certificate public key",
                },
              ],
            });
          }

          if (route === "/__singbox_api/sniff-port" && req.method === "POST") {
            const { basePort } = await readJsonBody(req);
            const start = Math.max(1024, Math.min(65500, Number(basePort) || 9090));
            const checkPort = (p: number): Promise<boolean> =>
              new Promise((resolve) => {
                const srv = net.createServer();
                srv.once("error", () => resolve(false));
                srv.once("listening", () => {
                  srv.close(() => resolve(true));
                });
                srv.listen(p, "127.0.0.1");
              });
            for (let offset = 1; offset <= 50; offset++) {
              const candidate = start + offset;
              if (await checkPort(candidate)) {
                return sendJson(res, 200, { port: candidate });
              }
            }
            return sendJson(res, 200, { port: start + 1 });
          }

          return sendJson(res, 404, { error: "Unknown endpoint" });
        } catch (err: any) {
          return sendJson(res, 500, {
            error: err?.message || String(err),
          });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), singboxDevApiPlugin()],
  clearScreen: false,
  build: {
    outDir: "/tmp/singboxguiv0-dist",
    emptyOutDir: true,
  },
  cacheDir: "/tmp/singboxguiv0-vite",
  server: {
    host: "127.0.0.1",
    port: 1422,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
