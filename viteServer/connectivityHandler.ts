import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as net from "node:net";

const execFileAsync = promisify(execFile);

export function checkTcpPortAvailability(
  host: string,
  port: number
): Promise<{
  port: number;
  host: string;
  occupied: boolean;
  available: boolean;
  message: string;
}> {
  const bindHost = (host || "127.0.0.1").trim() || "127.0.0.1";
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", (err: any) => {
      resolve({
        port,
        host: bindHost,
        occupied: true,
        available: false,
        message: `Port ${bindHost}:${port} is already occupied (${
          err?.code || err?.message || "EADDRINUSE"
        }). Stop the conflicting process or change Listen Port and re-export config.`,
      });
    });
    srv.once("listening", () => {
      srv.close(() => {
        resolve({
          port,
          host: bindHost,
          occupied: false,
          available: true,
          message: `Port ${bindHost}:${port} is free and ready to bind.`,
        });
      });
    });
    srv.listen(port, bindHost);
  });
}

export async function runConnectivityProbe(payload: {
  method?: string;
  target?: string;
  socksHost?: string;
  socksPort?: number;
  socksUser?: string;
  socksPass?: string;
  timeoutMs?: number;
}): Promise<{
  success: boolean;
  method: string;
  target: string;
  latency_ms: number;
  status_code: number | null;
  detail: string;
}> {
  const method = String(payload.method || "http_fetch")
    .trim()
    .toLowerCase();
  const rawTarget = String(
    payload.target || "https://www.gstatic.com/generate_204"
  ).trim();
  const timeoutSec = Math.max(
    2,
    Math.min(20, (Number(payload.timeoutMs) || 6000) / 1000)
  );
  const startMs = Date.now();

  if (method === "icmp_ping") {
    const host = rawTarget
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      .split(":")[0];
    const flag = process.platform === "win32" ? "-n" : "-c";
    try {
      const { stdout } = await execFileAsync(
        "ping",
        [flag, "1", host],
        { timeout: timeoutSec * 1000 }
      );
      const elapsed = Date.now() - startMs;
      const line =
        stdout
          .split(/\r?\n/)
          .find((l) => l.includes("time=") || l.includes("bytes from")) ||
        "ICMP Echo Reply received";
      return {
        success: true,
        method,
        target: host,
        latency_ms: elapsed,
        status_code: null,
        detail: line.trim(),
      };
    } catch (err: any) {
      const elapsed = Date.now() - startMs;
      const msg = [err?.stdout, err?.stderr, err?.message]
        .filter(Boolean)
        .join(" ")
        .trim();
      return {
        success: false,
        method,
        target: host,
        latency_ms: elapsed,
        status_code: null,
        detail:
          msg.split(/\r?\n/)[0] ||
          "ICMP ping failed or blocked in current network environment",
      };
    }
  }

  if (method === "tcp_ping") {
    const cleaned = rawTarget.replace(/^https?:\/\//i, "").split("/")[0];
    const lastColon = cleaned.lastIndexOf(":");
    const host = lastColon > 0 ? cleaned.slice(0, lastColon) : cleaned;
    const port =
      lastColon > 0 ? Number(cleaned.slice(lastColon + 1)) || 443 : 443;

    return new Promise((resolve) => {
      const sock = new net.Socket();
      let settled = false;
      const finish = (ok: boolean, detail: string) => {
        if (settled) return;
        settled = true;
        sock.destroy();
        resolve({
          success: ok,
          method,
          target: `${host}:${port}`,
          latency_ms: Date.now() - startMs,
          status_code: null,
          detail,
        });
      };
      sock.setTimeout(timeoutSec * 1000);
      sock.once("connect", () =>
        finish(
          true,
          `TCP handshake to ${host}:${port} succeeded (${
            Date.now() - startMs
          } ms)`
        )
      );
      sock.once("timeout", () =>
        finish(false, `TCP connection to ${host}:${port} timed out`)
      );
      sock.once("error", (e: any) =>
        finish(
          false,
          `TCP connection to ${host}:${port} failed: ${
            e?.message || String(e)
          }`
        )
      );
      sock.connect(port, host);
    });
  }

  // HTTP / HTTPS Fetch (Direct or via SOCKS5 Bridge)
  const url =
    rawTarget.startsWith("http://") || rawTarget.startsWith("https://")
      ? rawTarget
      : `https://${rawTarget}`;
  const args: string[] = [
    "-sSL",
    "-o",
    process.platform === "win32" ? "NUL" : "/dev/null",
    "-w",
    "%{http_code}|%{time_total}",
    "--max-time",
    timeoutSec.toFixed(1),
  ];

  if (method === "socks5_http") {
    const sHost = (payload.socksHost || "127.0.0.1").trim() || "127.0.0.1";
    const sPort = Number(payload.socksPort) || 11400;
    args.push("--socks5-hostname", `${sHost}:${sPort}`);
    if (payload.socksUser && String(payload.socksUser).trim()) {
      const u = String(payload.socksUser).trim();
      const p = String(payload.socksPass ?? "0");
      args.push("-U", `${u}:${p}`);
    }
  }

  args.push(url);

  try {
    const { stdout, stderr } = await execFileAsync("curl", args, {
      timeout: (timeoutSec + 2) * 1000,
    });
    const parts = stdout.trim().split("|");
    const statusCode = Number(parts[0]) || 0;
    const totalSec = parseFloat(parts[1] || "0");
    const latencyMs =
      totalSec > 0 ? Math.round(totalSec * 1000) : Date.now() - startMs;
    const ok = statusCode >= 200 && statusCode < 400;
    return {
      success: ok,
      method,
      target: url,
      latency_ms: latencyMs,
      status_code: statusCode > 0 ? statusCode : null,
      detail: ok
        ? `HTTP ${statusCode} returned from ${url} (${latencyMs} ms)`
        : `HTTP ${statusCode || "ERR"}: ${
            stderr.trim() || "Request failed"
          }`,
    };
  } catch (err: any) {
    const elapsed = Date.now() - startMs;
    const outStr = String(err?.stdout || "").trim();
    const errStr = String(err?.stderr || err?.message || "").trim();
    const codeCandidate = Number(outStr.split("|")[0]) || null;
    return {
      success: false,
      method,
      target: url,
      latency_ms: elapsed,
      status_code: codeCandidate,
      detail:
        method === "socks5_http"
          ? `SOCKS5 Bridge probe failed (${
              errStr || "Ensure sing-box service is running on bridge port"
            })`
          : `HTTP probe failed: ${errStr || "Connection error"}`,
    };
  }
}
