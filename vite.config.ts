import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto";
import * as net from "node:net";
import {
  checkTcpPortAvailability,
  runConnectivityProbe,
} from "./viteServer/connectivityHandler";
import { handleSingboxServiceRoute } from "./viteServer/singboxServiceHandler";

const execFileAsync = promisify(execFile);

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
        const method = req.method || "GET";
        try {
          const body =
            method === "POST" ? await readJsonBody(req).catch(() => ({})) : {};

          const handled = await handleSingboxServiceRoute(
            route,
            method,
            body,
            projectRoot
          );
          if (handled) {
            return sendJson(res, handled.status, handled.payload);
          }

          if (
            route === "/__singbox_api/fetch-subscription" &&
            method === "POST"
          ) {
            const { url, userAgent } = body;
            const trimmedUrl = String(url || "").trim();
            if (
              !trimmedUrl.startsWith("http://") &&
              !trimmedUrl.startsWith("https://")
            ) {
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
              const respBody = fs.existsSync(bodyFile)
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
                body: respBody,
                userInfoHeader,
              });
            } finally {
              try {
                if (fs.existsSync(hdrFile)) fs.unlinkSync(hdrFile);
                if (fs.existsSync(bodyFile)) fs.unlinkSync(bodyFile);
              } catch {}
            }
          }

          if (route === "/__singbox_api/check-port" && method === "POST") {
            const { host, port } = body;
            const targetPort = Math.max(
              1,
              Math.min(65535, Number(port) || 11400)
            );
            const status = await checkTcpPortAvailability(
              String(host || "127.0.0.1"),
              targetPort
            );
            return sendJson(res, 200, status);
          }

          if (
            route === "/__singbox_api/connectivity-test" &&
            method === "POST"
          ) {
            const result = await runConnectivityProbe(body || {});
            return sendJson(res, 200, result);
          }

          if (route === "/__singbox_api/generate-ca" && method === "POST") {
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

          if (route === "/__singbox_api/validate-cert" && method === "POST") {
            const { cert_pem, key_pem, store_in_keychain } = body;
            const x509 = new crypto.X509Certificate(
              String(cert_pem || "").trim()
            );
            const privKey = crypto.createPrivateKey(
              String(key_pem || "").trim()
            );
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
              key_storage: store_in_keychain
                ? "System Keychain"
                : "App Config Dir",
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

          if (route === "/__singbox_api/sniff-port" && method === "POST") {
            const { basePort } = body;
            const start = Math.max(
              1024,
              Math.min(65500, Number(basePort) || 9090)
            );
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
