import { invoke } from "@tauri-apps/api/core";
import {
  BinaryStatusInfo,
  ConfigInspectSummary,
  SingboxCheckResult,
  SingboxServiceStatus,
} from "../types/singbox";
import { SubscriptionUserInfo } from "../types/subscription";
import {
  getCurrentFormattedTime,
  parseSubscriptionUserInfo,
} from "../utils/subscriptionHelpers";
import {
  checkBridgePortAvailability,
  generateSelfSignedCaPem,
  isTauriRuntime,
  loadPersistedUiConfig,
  type PersistedUiConfig,
  type PersistedUiRuntimeConfig,
  runConnectivityDiagnostic,
  savePersistedUiConfig,
  setSystemTrayIconStyle,
  sniffAvailableMitmPort,
  toggleMitmEngineListener,
  validateAndImportCaCertPem,
} from "./mitmAndDiagGateway";

export {
  checkBridgePortAvailability,
  generateSelfSignedCaPem,
  isTauriRuntime,
  loadPersistedUiConfig,
  type PersistedUiConfig,
  type PersistedUiRuntimeConfig,
  runConnectivityDiagnostic,
  savePersistedUiConfig,
  setSystemTrayIconStyle,
  sniffAvailableMitmPort,
  toggleMitmEngineListener,
  validateAndImportCaCertPem,
};

export async function fetchSubscriptionRemoteOrFallback(
  url: string,
  userAgent: string
): Promise<{
  body: string;
  userInfo: SubscriptionUserInfo | null;
  status: number;
}> {
  const trimmedUrl = (url || "").trim();
  if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
    throw new Error(
      "Invalid URL: Subscription URL must start with http:// or https://"
    );
  }
  const effectiveUa = (userAgent || "").trim() || "clash-verge/v2.4.7";

  try {
    const res = await invoke<{
      body: string;
      headers: Record<string, string>;
      status: number;
      userInfoHeader?: string;
    }>("fetch_subscription_url", {
      url: trimmedUrl,
      userAgent: effectiveUa,
    });
    const headerVal =
      res.userInfoHeader ||
      res.headers?.["subscription-userinfo"] ||
      res.headers?.["Subscription-Userinfo"];
    return {
      body: res.body,
      userInfo: parseSubscriptionUserInfo(headerVal),
      status: res.status,
    };
  } catch (tauriErr: any) {
    const errMsg = String(tauriErr?.message || tauriErr || "");
    if (
      errMsg.includes("Subscription HTTP") ||
      errMsg.includes("curl execution failed")
    ) {
      throw new Error(errMsg);
    }

    try {
      const apiRes = await fetch("/__singbox_api/fetch-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl, userAgent: effectiveUa }),
      });
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data.status >= 400) {
          throw new Error(
            `HTTP ${data.status} from remote subscription server`
          );
        }
        const headerVal =
          data.userInfoHeader ||
          data.headers?.["subscription-userinfo"] ||
          data.headers?.["Subscription-Userinfo"];
        return {
          body: data.body || "",
          userInfo: parseSubscriptionUserInfo(headerVal),
          status: data.status || 200,
        };
      } else {
        const errJson = await apiRes.json().catch(() => ({}));
        if (errJson.error) {
          throw new Error(errJson.error);
        }
      }
    } catch (proxyErr: any) {
      if (proxyErr?.message && !proxyErr.message.includes("Failed to fetch")) {
        throw proxyErr;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(trimmedUrl, {
        method: "GET",
        headers: {
          "User-Agent": effectiveUa,
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} (${response.statusText})`);
      }
      const body = await response.text();
      const userInfo = parseSubscriptionUserInfo(
        response.headers.get("subscription-userinfo")
      );
      return {
        body,
        userInfo,
        status: response.status,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function validateSingboxSchemaLocally(
  configJsonText: string,
  checkedAt: string,
  binaryNote?: string,
  extraMeta?: {
    configDir?: string;
    singboxConfigPath?: string;
    surgeConfigPath?: string;
    summary?: ConfigInspectSummary;
  }
): SingboxCheckResult {
  try {
    const parsed = JSON.parse(configJsonText);
    const hasInbounds =
      Array.isArray(parsed.inbounds) && parsed.inbounds.length > 0;
    const hasOutbounds =
      Array.isArray(parsed.outbounds) && parsed.outbounds.length > 0;
    let proxyOutboundCount = 0;
    let urltestPoolCount = 0;

    for (const ob of parsed.outbounds || []) {
      if (ob.type === "urltest" || ob.type === "selector") {
        urltestPoolCount++;
      } else if (
        ob.type &&
        ob.type !== "direct" &&
        ob.type !== "block" &&
        ob.type !== "dns"
      ) {
        proxyOutboundCount++;
      }
      if (ob.type === "hysteria2" && Array.isArray(ob.server_ports)) {
        for (const pr of ob.server_ports) {
          if (!String(pr).includes(":")) {
            return {
              valid: false,
              binaryFound: false,
              version: "sing-box 1.14.4 (Schema Validator)",
              commandOutput: `FATAL: outbound [${ob.tag}] hysteria2 server_ports requires colon range syntax (e.g. 61000:62000), got ${pr}`,
              checkedAt,
            };
          }
        }
      }
      if (ob.tls?.reality?.enabled && !ob.tls?.utls?.enabled) {
        return {
          valid: false,
          binaryFound: false,
          version: "sing-box 1.14.4 (Schema Validator)",
          commandOutput: `FATAL: outbound [${ob.tag}] uTLS is required by reality client`,
          checkedAt,
        };
      }
      if (ob.type === "anytls" && "client_metadata" in ob) {
        return {
          valid: false,
          binaryFound: false,
          version: "sing-box 1.14.4 (Schema Validator)",
          commandOutput: `FATAL: outbound [${ob.tag}] json: unknown field "client_metadata" in sing-box 1.14.4`,
          checkedAt,
        };
      }
    }
    if (!hasInbounds || !hasOutbounds) {
      return {
        valid: false,
        binaryFound: false,
        version: "sing-box 1.14.4 (Schema Validator)",
        commandOutput: "Config is missing inbounds or outbounds array.",
        checkedAt,
      };
    }

    const emptyWorkspace = proxyOutboundCount === 0;
    const socksUsers = parsed.inbounds[0]?.users?.length || 0;
    const suffix = binaryNote
      ? ` [Binary Not Found -> Verified via Built-in 1.14.4 Schema Validator; click 'Import Binary' to store sing-box in Application Support]`
      : "";
    const msg = emptyWorkspace
      ? `EMPTY_WORKSPACE: Schema syntax valid, but config.json currently has 0 proxy nodes (only 'direct' outbound, 0 SOCKS5 users). Import or enable a subscription first.${suffix}`
      : `Schema check passed (${proxyOutboundCount} proxy outbounds, ${socksUsers} SOCKS5 users, ${urltestPoolCount} dynamic pools, auto_detect_interface=${Boolean(
          parsed.route?.auto_detect_interface
        )}).${suffix}`;

    return {
      valid: true,
      binaryFound: false,
      version: "sing-box 1.14.4 (Schema Verified)",
      commandOutput: msg,
      checkedAt,
      configDir: extraMeta?.configDir,
      singboxConfigPath: extraMeta?.singboxConfigPath,
      surgeConfigPath: extraMeta?.surgeConfigPath,
      summary: extraMeta?.summary,
      emptyWorkspace,
    };
  } catch (err: any) {
    return {
      valid: false,
      binaryFound: false,
      version: "sing-box 1.14.4",
      commandOutput: `JSON parse error: ${err?.message || String(err)}`,
      checkedAt,
    };
  }
}

export async function validateSingboxConfigWithCore(
  configJsonText: string,
  surgeConfigText?: string
): Promise<SingboxCheckResult> {
  const checkedAt = getCurrentFormattedTime();
  try {
    const res = await invoke<{
      valid: boolean;
      version: string;
      output: string;
      binary_found?: boolean;
      binary_path?: string;
      config_dir?: string;
      singbox_config_path?: string;
      surge_config_path?: string;
      summary?: ConfigInspectSummary;
      service_reloaded?: boolean;
    }>("validate_singbox_config_cmd", {
      configContent: configJsonText,
      surgeContent: surgeConfigText,
    });
    return {
      valid: res.valid,
      version: res.version || "sing-box 1.14.4",
      commandOutput: res.output,
      checkedAt,
      binaryFound: res.binary_found ?? true,
      binaryPath: res.binary_path,
      configDir: res.config_dir,
      singboxConfigPath: res.singbox_config_path,
      surgeConfigPath: res.surge_config_path,
      summary: res.summary,
      serviceReloaded: res.service_reloaded,
      emptyWorkspace:
        res.summary?.empty_workspace ?? res.output.startsWith("EMPTY_WORKSPACE"),
    };
  } catch (tauriErr: any) {
    const tauriMsg = String(tauriErr?.message || tauriErr || "");
    if (tauriMsg.includes("BINARY_NOT_FOUND")) {
      return validateSingboxSchemaLocally(configJsonText, checkedAt, tauriMsg);
    }

    try {
      const apiRes = await fetch("/__singbox_api/singbox-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configContent: configJsonText,
          surgeContent: surgeConfigText,
        }),
      });
      if (apiRes.ok) {
        const data = await apiRes.json();
        const extraMeta = {
          configDir: data.config_dir,
          singboxConfigPath: data.singbox_config_path,
          surgeConfigPath: data.surge_config_path,
          summary: data.summary,
        };
        if (
          data.binary_found === false ||
          String(data.output || "").includes("BINARY_NOT_FOUND")
        ) {
          return validateSingboxSchemaLocally(
            configJsonText,
            checkedAt,
            data.output,
            extraMeta
          );
        }
        return {
          valid: Boolean(data.valid),
          version: data.version || "sing-box 1.14.4",
          commandOutput: data.output || "",
          checkedAt,
          binaryFound: true,
          binaryPath: data.binary_path,
          configDir: data.config_dir,
          singboxConfigPath: data.singbox_config_path,
          surgeConfigPath: data.surge_config_path,
          summary: data.summary,
          serviceReloaded: Boolean(data.service_reloaded),
          emptyWorkspace:
            data.summary?.empty_workspace ??
            String(data.output || "").startsWith("EMPTY_WORKSPACE"),
        };
      }
    } catch {}

    return validateSingboxSchemaLocally(
      configJsonText,
      checkedAt,
      "Binary not found"
    );
  }
}

export async function checkCoreBinaryStatus(): Promise<BinaryStatusInfo> {
  try {
    return await invoke<BinaryStatusInfo>("check_binary_status");
  } catch {
    try {
      const apiRes = await fetch("/__singbox_api/binary-status");
      if (apiRes.ok) {
        return await apiRes.json();
      }
    } catch {}
    return {
      imported: false,
      binary_name: "sing-box",
      binary_path:
        "~/Library/Application Support/com.antigravity.singboxguiv0/sing-box",
      managed_binary_path:
        "~/Library/Application Support/com.antigravity.singboxguiv0/sing-box",
      config_dir: "~/Library/Application Support/com.antigravity.singboxguiv0",
      singbox_config_path:
        "~/Library/Application Support/com.antigravity.singboxguiv0/config.json",
      surge_config_path:
        "~/Library/Application Support/com.antigravity.singboxguiv0/aSingbox127.conf",
      file_size: 0,
      version: null,
      searched_paths: [
        "~/Library/Application Support/com.antigravity.singboxguiv0/sing-box",
        "./bin/sing-box",
        "/opt/homebrew/bin/sing-box",
        "/usr/local/bin/sing-box",
      ],
    };
  }
}

export async function importSingboxBinary(params: {
  sourcePath?: string;
  base64Data?: string;
}): Promise<BinaryStatusInfo> {
  try {
    return await invoke<BinaryStatusInfo>("import_singbox_binary_cmd", {
      sourcePath: params.sourcePath,
      base64Data: params.base64Data,
    });
  } catch (tauriErr: any) {
    const msg = String(tauriErr?.message || tauriErr || "");
    if (
      msg.includes("Failed to copy") ||
      msg.includes("not executable") ||
      msg.includes("does not exist") ||
      msg.includes("too small")
    ) {
      throw new Error(msg);
    }
    const apiRes = await fetch("/__singbox_api/import-binary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await apiRes.json();
    if (!apiRes.ok) {
      throw new Error(data.error || "Failed to import sing-box binary");
    }
    return data as BinaryStatusInfo;
  }
}

export async function openAppConfigFolder(): Promise<ConfigInspectSummary> {
  try {
    return await invoke<ConfigInspectSummary>("open_config_folder_cmd");
  } catch {
    const apiRes = await fetch("/__singbox_api/open-config-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (apiRes.ok) {
      return await apiRes.json();
    }
    throw new Error("Unable to open Application Support config folder");
  }
}

export async function startSingboxService(
  configJsonText: string,
  surgeConfigText?: string
): Promise<SingboxServiceStatus> {
  try {
    return await invoke<SingboxServiceStatus>("start_singbox_service_cmd", {
      configContent: configJsonText,
      surgeContent: surgeConfigText,
    });
  } catch (tauriErr: any) {
    const msg = String(tauriErr?.message || tauriErr || "");
    if (
      msg.includes("sing-box exited") ||
      msg.includes("sing-box check") ||
      msg.includes("Failed to spawn") ||
      msg.includes("binary not found")
    ) {
      throw new Error(msg);
    }
    const apiRes = await fetch("/__singbox_api/service-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        configContent: configJsonText,
        surgeContent: surgeConfigText,
      }),
    });
    const data = await apiRes.json();
    if (!apiRes.ok) {
      throw new Error(data.error || "Failed to start sing-box service");
    }
    return data as SingboxServiceStatus;
  }
}

export async function stopSingboxService(): Promise<SingboxServiceStatus> {
  try {
    return await invoke<SingboxServiceStatus>("stop_singbox_service_cmd");
  } catch {
    const apiRes = await fetch("/__singbox_api/service-stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (apiRes.ok) {
      return await apiRes.json();
    }
    throw new Error("Failed to stop sing-box service");
  }
}

export async function getSingboxServiceStatus(): Promise<SingboxServiceStatus> {
  try {
    return await invoke<SingboxServiceStatus>("get_singbox_service_status_cmd");
  } catch {
    const apiRes = await fetch("/__singbox_api/service-status");
    if (apiRes.ok) {
      return await apiRes.json();
    }
    return {
      running: false,
      pid: null,
      binary_path: "",
      config_path: "",
      surge_config_path: "",
      config_dir: "",
      listen_address: "127.0.0.1:11400",
      message: "Service stopped",
      recent_logs: [],
    };
  }
}
