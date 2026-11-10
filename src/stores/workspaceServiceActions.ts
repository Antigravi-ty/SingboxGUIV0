import {
  fetchSubscriptionRemoteOrFallback,
  startSingboxService,
  stopSingboxService,
  validateSingboxConfigWithCore,
} from "../services/tauriGateway";
import {
  DEFAULT_AUTO_UPDATE_INTERVAL,
  DEFAULT_USER_AGENT_TYPE,
  USER_AGENT_PRESETS,
} from "../config/defaultSubscriptions";
import { ChainNamingSchemeId } from "../types/chainProxy";
import { TlsSecurityPolicyMode } from "../types/singbox";
import { SubscriptionItem, UserAgentType } from "../types/subscription";
import { convertSubscriptionsToSingboxNodes } from "../utils/mihomoToSingboxConverter";
import { getCurrentFormattedTime } from "../utils/subscriptionHelpers";
import { useThemeStore } from "./themeStore";
import {
  fetchAgentFriendlyUiConfig,
  persistAgentFriendlyUiConfig,
  saveNetworkParamsToStorage,
  saveSubscriptionsToStorage,
} from "./workspacePersistence";

/**
 * Yields to the browser paint loop so Primer Spinner / disabled button state
 * renders immediately before heavy JSON serialization or IPC calls run.
 */
export function yieldToNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => {
        window.setTimeout(resolve, 0);
      });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export async function syncUiConfigSnapshotToDisk(networkState: {
  listenIp: string;
  listenPort: number;
  autoDetectInterface: boolean;
  includeSurgeProxyGroups: boolean;
}): Promise<string | null> {
  const themeState = useThemeStore.getState();
  return persistAgentFriendlyUiConfig({
    listen_ip: networkState.listenIp,
    listen_port: networkState.listenPort,
    auto_detect_interface: networkState.autoDetectInterface,
    advanced_mode: themeState.advancedMode,
    topbar_icon_style: themeState.topbarIconStyle,
    color_mode: themeState.colorMode,
    include_surge_proxy_groups: networkState.includeSurgeProxyGroups,
  });
}

export async function hydrateStoresFromDiskUiConfig(
  applyNetworkPatch: (patch: {
    listenIp: string;
    listenPort: number;
    autoDetectInterface: boolean;
    includeSurgeProxyGroups: boolean;
  }) => void
): Promise<void> {
  const diskCfg = await fetchAgentFriendlyUiConfig();
  if (!diskCfg) return;

  // Hydrate network params if not already customized in current session
  const nextNet = {
    listenIp: diskCfg.listen_ip || "127.0.0.1",
    listenPort:
      typeof diskCfg.listen_port === "number" && diskCfg.listen_port >= 1024
        ? diskCfg.listen_port
        : 11400,
    autoDetectInterface:
      typeof diskCfg.auto_detect_interface === "boolean"
        ? diskCfg.auto_detect_interface
        : true,
    includeSurgeProxyGroups:
      typeof diskCfg.include_surge_proxy_groups === "boolean"
        ? diskCfg.include_surge_proxy_groups
        : true,
  };
  saveNetworkParamsToStorage(nextNet);
  applyNetworkPatch(nextNet);
}

export async function performAddOrFetchSubscription(
  params: {
    prefix: string;
    name?: string;
    url: string;
    userAgentType?: UserAgentType;
    rawContentOverride?: string;
  },
  context: {
    subscriptions: SubscriptionItem[];
    namingScheme: ChainNamingSchemeId;
    securityPolicy: TlsSecurityPolicyMode;
    setPartial: (patch: Record<string, any>) => void;
    recomputePipeline: () => void;
    appendLog: (line: string) => void;
  }
): Promise<boolean> {
  const {
    prefix,
    name,
    url,
    userAgentType = DEFAULT_USER_AGENT_TYPE,
    rawContentOverride,
  } = params;

  const cleanPrefix = prefix
    .replace(/[-~@]+$/, "")
    .trim()
    .slice(0, 8);
  if (!cleanPrefix) {
    context.setPartial({
      subFeedback: {
        type: "danger",
        message: "Subscription prefix cannot be empty (e.g. LC, XF, YY).",
      },
    });
    return false;
  }

  const trimmedUrl = (url || "").trim();
  if (
    !rawContentOverride &&
    !trimmedUrl.startsWith("http://") &&
    !trimmedUrl.startsWith("https://")
  ) {
    context.setPartial({
      subFeedback: {
        type: "danger",
        message:
          "Please enter a valid remote Subscription URL starting with https:// or http:// (or use 'Import Local File' to load a local YAML/JSON/Base64 file).",
      },
    });
    return false;
  }

  const uaPreset =
    USER_AGENT_PRESETS.find((u) => u.id === userAgentType) ||
    USER_AGENT_PRESETS[0];

  context.setPartial({
    isFetchingSub: true,
    subFeedback: null,
    lastFailedRawResponse: null,
  });
  await yieldToNextPaint();

  try {
    let rawContent = rawContentOverride ?? "";
    let userInfo = null;

    if (!rawContent) {
      const fetched = await fetchSubscriptionRemoteOrFallback(
        trimmedUrl,
        uaPreset.uaString
      );
      rawContent = fetched.body;
      userInfo = fetched.userInfo;
    }

    if (!rawContent || !rawContent.trim()) {
      throw new Error("Remote subscription returned an empty body (0 bytes).");
    }

    const format: "yaml" | "json" = rawContent.trim().startsWith("{")
      ? "json"
      : "yaml";

    const newSub: SubscriptionItem = {
      id: `sub_${Date.now()}_${cleanPrefix}`,
      prefix: cleanPrefix,
      name: name?.trim() || `${cleanPrefix} Subscription`,
      url: trimmedUrl || `local://${cleanPrefix}.${format}`,
      enabled: true,
      userAgentType,
      userAgentString: uaPreset.uaString,
      filename: `${cleanPrefix}.${format}`,
      format,
      autoUpdateIntervalMinutes: DEFAULT_AUTO_UPDATE_INTERVAL,
      lastUpdated: getCurrentFormattedTime(),
      userInfo,
      rawContent,
    };

    const probe = convertSubscriptionsToSingboxNodes({
      subscriptions: [newSub],
      namingScheme: context.namingScheme,
      securityPolicy: context.securityPolicy,
      excludedProtocols: [],
    });
    const summary = probe.summaries[0];
    if (
      !summary ||
      summary.totalRawProxies === 0 ||
      probe.directNodes.length === 0
    ) {
      const preview = rawContent.trim().slice(0, 180).replace(/\s+/g, " ");
      context.setPartial({
        isFetchingSub: false,
        lastFailedRawResponse: {
          prefix: cleanPrefix,
          url: trimmedUrl || `local://${cleanPrefix}`,
          rawBody: rawContent,
        },
        subFeedback: {
          type: "danger",
          message: `Subscription [${cleanPrefix}] returned ${rawContent.length} bytes, but 0 valid proxy nodes were found. Make sure the URL returns Mihomo/Clash YAML (proxies:), Sing-box JSON (outbounds:), or Base64 share links. Preview: "${preview}"`,
        },
      });
      context.appendLog(
        `[ERROR][Converter] Subscription ${cleanPrefix} rejected: 0 proxy nodes parsed from ${rawContent.length} bytes.`
      );
      return false;
    }

    const existingIdx = context.subscriptions.findIndex(
      (s) => s.prefix.toLowerCase() === cleanPrefix.toLowerCase()
    );
    const nextSubs = [...context.subscriptions];
    if (existingIdx >= 0) {
      nextSubs[existingIdx] = {
        ...newSub,
        id: nextSubs[existingIdx].id,
      };
    } else {
      nextSubs.push(newSub);
    }

    saveSubscriptionsToStorage(nextSubs);

    context.setPartial({
      subscriptions: nextSubs,
      isFetchingSub: false,
      lastFailedRawResponse: null,
      subFeedback: {
        type: "info",
        message: `Imported subscription [${cleanPrefix}] (${probe.directNodes.length} / ${summary.totalRawProxies} nodes converted) with User-Agent '${uaPreset.uaString}' (Auto-Update = 0).`,
      },
    });
    context.recomputePipeline();
    context.appendLog(
      `[INFO][Converter] Imported subscription ${cleanPrefix}: ${probe.directNodes.length} nodes (${rawContent.length} bytes) using UA ${uaPreset.uaString}`
    );
    return true;
  } catch (err: any) {
    context.setPartial({
      isFetchingSub: false,
      subFeedback: {
        type: "danger",
        message: `Failed to fetch subscription [${cleanPrefix}]: ${
          err?.message || String(err)
        }`,
      },
    });
    context.appendLog(
      `[ERROR][Converter] Failed to fetch subscription ${cleanPrefix}: ${
        err?.message || String(err)
      }`
    );
    return false;
  }
}

export async function performServiceStartOrStop(
  action: "start" | "stop",
  context: {
    getSingboxConfig: () => any;
    getSurgeConfigText: () => string;
    setPartial: (patch: Record<string, any>) => void;
    appendLog: (line: string) => void;
    appendLogsBatch: (lines: string[]) => void;
  }
): Promise<{ ok: boolean; message: string }> {
  context.setPartial({ isStartingService: true });
  await yieldToNextPaint();

  try {
    if (action === "stop") {
      const res = await stopSingboxService();
      context.setPartial({
        runningMode: "stopped",
        isStartingService: false,
      });
      context.appendLog(`[INFO][Service] ${res.message}`);
      return { ok: true, message: res.message };
    }

    const jsonText = JSON.stringify(context.getSingboxConfig(), null, 2);
    const surgeText = context.getSurgeConfigText();
    const res = await startSingboxService(jsonText, surgeText);

    if (res.running) {
      context.setPartial({
        runningMode: "normal",
        isStartingService: false,
      });
      context.appendLog(`[INFO][Service] ${res.message}`);
      if (res.recent_logs && res.recent_logs.length > 0) {
        context.appendLogsBatch(res.recent_logs);
      }
      return { ok: true, message: res.message };
    } else {
      context.setPartial({
        runningMode: "stopped",
        isStartingService: false,
      });
      context.appendLog(`[ERROR][Service] ${res.message}`);
      if (res.recent_logs && res.recent_logs.length > 0) {
        context.appendLogsBatch(res.recent_logs);
      }
      return { ok: false, message: res.message };
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    context.setPartial({ isStartingService: false });
    context.appendLog(`[ERROR][Service] Service ${action} error: ${msg}`);
    return { ok: false, message: msg };
  }
}

export async function performSingboxCheck(context: {
  getSingboxConfig: () => any;
  getSurgeConfigText: () => string;
  setPartial: (patch: Record<string, any>) => void;
  appendLog: (line: string) => void;
}): Promise<void> {
  context.setPartial({ isCheckingConfig: true });
  await yieldToNextPaint();

  try {
    const jsonText = JSON.stringify(context.getSingboxConfig(), null, 2);
    const surgeText = context.getSurgeConfigText();
    const res = await validateSingboxConfigWithCore(jsonText, surgeText);
    context.setPartial({
      lastCheckResult: res,
      isCheckingConfig: false,
    });
    if (res.serviceReloaded) {
      context.appendLog(
        `[INFO][Service] Dynamic config sync complete -> hot-reloaded running sing-box service (${res.singboxConfigPath}).`
      );
    }
  } catch (err: any) {
    context.setPartial({ isCheckingConfig: false });
    context.appendLog(
      `[ERROR][CoreCheck] Config validation failed: ${
        err?.message || String(err)
      }`
    );
  }
}
