import { create } from "zustand";
import {
  DEFAULT_AUTO_UPDATE_INTERVAL,
  DEFAULT_CHAIN_LINK_RULES,
  DEFAULT_MITM_URL_REGEX_RULES,
  DEFAULT_SUBSCRIPTIONS,
  DEFAULT_USER_AGENT_TYPE,
  USER_AGENT_PRESETS,
} from "../config/defaultSubscriptions";
import {
  fetchSubscriptionRemoteOrFallback,
  validateSingboxConfigWithCore,
} from "../services/tauriGateway";
import {
  ChainLinkRule,
  ChainNamingSchemeId,
  GeneratedProxyEndpoint,
  TopologyProviderNode,
  TopologyVisualEdge,
} from "../types/chainProxy";
import { MitmUrlRegexRule } from "../types/mitm";
import {
  ConversionSubscriptionSummary,
  ConvertedNodeMetadata,
  ParsedLogEntry,
  RunningMode,
  SingboxCheckResult,
  SingboxConfig,
  TlsSecurityPolicyMode,
} from "../types/singbox";
import { SubscriptionItem, UserAgentType } from "../types/subscription";
import { parseRawLogLine } from "../utils/ansiLogParser";
import { buildSingboxAndSurgePipeline } from "../utils/chainProxyEngine";
import { convertSubscriptionsToSingboxNodes } from "../utils/mihomoToSingboxConverter";
import { getCurrentFormattedTime } from "../utils/subscriptionHelpers";

export type ActiveWorkspaceTab =
  | "topology"
  | "subscriptions"
  | "security"
  | "diagnostics"
  | "mitm"
  | "console";

interface WorkspaceState {
  activeTab: ActiveWorkspaceTab;
  setActiveTab: (tab: ActiveWorkspaceTab) => void;

  subscriptions: SubscriptionItem[];
  isFetchingSub: boolean;
  subFeedback: { type: "info" | "warning" | "danger"; message: string } | null;
  clearSubFeedback: () => void;
  addOrFetchSubscription: (params: {
    prefix: string;
    name?: string;
    url: string;
    userAgentType?: UserAgentType;
    rawContentOverride?: string;
  }) => Promise<boolean>;
  toggleSubscriptionEnabled: (id: string) => void;
  updateSubscriptionItem: (
    id: string,
    patch: Partial<SubscriptionItem>
  ) => void;
  deleteSubscriptionItem: (id: string) => void;
  resetDemoSubscriptions: () => void;

  namingScheme: ChainNamingSchemeId;
  setNamingScheme: (scheme: ChainNamingSchemeId) => void;

  securityPolicy: TlsSecurityPolicyMode;
  skipCertWarningAcknowledged: boolean;
  setSecurityPolicy: (policy: TlsSecurityPolicyMode) => void;
  acknowledgeSkipCertWarning: (ack: boolean) => void;

  excludedProtocols: string[];
  toggleExcludedProtocol: (protocol: string) => void;

  listenIp: string;
  listenPort: number;
  logLevel: string;
  autoDetectInterface: boolean;
  includeSurgeProxyGroups: boolean;
  setNetworkParams: (patch: {
    listenIp?: string;
    listenPort?: number;
    logLevel?: string;
    autoDetectInterface?: boolean;
    includeSurgeProxyGroups?: boolean;
  }) => void;

  chainRules: ChainLinkRule[];
  selectedChainRuleId: string | null;
  selectChainRule: (id: string | null) => void;
  addChainRule: (rule: Omit<ChainLinkRule, "id">) => void;
  updateChainRule: (id: string, patch: Partial<ChainLinkRule>) => void;
  deleteChainRule: (id: string) => void;
  toggleChainRule: (id: string) => void;

  regexTestQuery: string;
  setRegexTestQuery: (query: string) => void;

  directNodes: ConvertedNodeMetadata[];
  summaries: ConversionSubscriptionSummary[];
  singboxConfig: SingboxConfig;
  surgeConfigText: string;
  endpoints: GeneratedProxyEndpoint[];
  providerNodes: TopologyProviderNode[];
  visualEdges: TopologyVisualEdge[];
  lastCheckResult: SingboxCheckResult | null;
  runSingboxCheck: () => Promise<void>;
  recomputePipeline: () => void;

  mitmRules: MitmUrlRegexRule[];
  addMitmRule: (rule: Omit<MitmUrlRegexRule, "id">) => void;
  toggleMitmRule: (id: string) => void;
  deleteMitmRule: (id: string) => void;

  runningMode: RunningMode;
  setRunningMode: (mode: RunningMode) => void;
  logs: ParsedLogEntry[];
  appendLog: (rawLine: string) => void;
  clearLogs: () => void;
}

const STORAGE_SUBS_KEY = "singbox_gui_v0_subscriptions";
const STORAGE_CHAINS_KEY = "singbox_gui_v0_chain_rules";
const STORAGE_SCHEME_KEY = "singbox_gui_v0_naming_scheme";

function loadInitialSubscriptions(): SubscriptionItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_SUBS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_SUBSCRIPTIONS;
}

function loadInitialChainRules(): ChainLinkRule[] {
  try {
    const saved = localStorage.getItem(STORAGE_CHAINS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_CHAIN_LINK_RULES;
}

function loadInitialNamingScheme(): ChainNamingSchemeId {
  try {
    const saved = localStorage.getItem(
      STORAGE_SCHEME_KEY
    ) as ChainNamingSchemeId | null;
    if (
      saved === "scheme_a_tilde" ||
      saved === "scheme_b_dir" ||
      saved === "scheme_c_exit_at"
    ) {
      return saved;
    }
  } catch {
    // ignore
  }
  return "scheme_a_tilde";
}

function executeFullCompilation(state: {
  subscriptions: SubscriptionItem[];
  namingScheme: ChainNamingSchemeId;
  securityPolicy: TlsSecurityPolicyMode;
  excludedProtocols: string[];
  chainRules: ChainLinkRule[];
  listenIp: string;
  listenPort: number;
  logLevel: string;
  autoDetectInterface: boolean;
  includeSurgeProxyGroups: boolean;
}) {
  const { directNodes, dnsServers, dnsRules, summaries } =
    convertSubscriptionsToSingboxNodes({
      subscriptions: state.subscriptions,
      namingScheme: state.namingScheme,
      securityPolicy: state.securityPolicy,
      excludedProtocols: state.excludedProtocols,
    });

  const {
    singboxConfig,
    surgeConfigText,
    endpoints,
    providerNodes,
    visualEdges,
  } = buildSingboxAndSurgePipeline({
    directNodes,
    dnsServers,
    dnsRules,
    chainRules: state.chainRules,
    namingScheme: state.namingScheme,
    listenIp: state.listenIp,
    listenPort: state.listenPort,
    logLevel: state.logLevel,
    autoDetectInterface: state.autoDetectInterface,
    includeSurgeProxyGroups: state.includeSurgeProxyGroups,
  });

  return {
    directNodes,
    summaries,
    singboxConfig,
    surgeConfigText,
    endpoints,
    providerNodes,
    visualEdges,
  };
}

const initialSubs = loadInitialSubscriptions();
const initialChains = loadInitialChainRules();
const initialScheme = loadInitialNamingScheme();
const initialCompiled = executeFullCompilation({
  subscriptions: initialSubs,
  namingScheme: initialScheme,
  securityPolicy: "follow_source_with_warning",
  excludedProtocols: [],
  chainRules: initialChains,
  listenIp: "127.0.0.1",
  listenPort: 11400,
  logLevel: "info",
  autoDetectInterface: false,
  includeSurgeProxyGroups: true,
});

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activeTab: "topology",
  setActiveTab: (tab) => set({ activeTab: tab }),

  subscriptions: initialSubs,
  isFetchingSub: false,
  subFeedback: null,
  clearSubFeedback: () => set({ subFeedback: null }),

  addOrFetchSubscription: async ({
    prefix,
    name,
    url,
    userAgentType = DEFAULT_USER_AGENT_TYPE,
    rawContentOverride,
  }) => {
    const cleanPrefix = prefix
      .replace(/[-~@]+$/, "")
      .trim()
      .slice(0, 8);
    if (!cleanPrefix) {
      set({
        subFeedback: {
          type: "danger",
          message: "Subscription prefix cannot be empty (e.g. LC, XF, YY).",
        },
      });
      return false;
    }

    const uaPreset =
      USER_AGENT_PRESETS.find((u) => u.id === userAgentType) ||
      USER_AGENT_PRESETS[0];

    set({ isFetchingSub: true, subFeedback: null });
    try {
      let rawContent = rawContentOverride ?? "";
      let userInfo = null;

      if (!rawContent) {
        const fetched = await fetchSubscriptionRemoteOrFallback(
          url.trim(),
          uaPreset.uaString
        );
        rawContent = fetched.body;
        userInfo = fetched.userInfo;
      }

      const format: "yaml" | "json" = rawContent.trim().startsWith("{")
        ? "json"
        : "yaml";

      const newSub: SubscriptionItem = {
        id: `sub_${Date.now()}_${cleanPrefix}`,
        prefix: cleanPrefix,
        name: name?.trim() || `${cleanPrefix} Subscription`,
        url: url.trim() || `local://${cleanPrefix}.${format}`,
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

      const existingIdx = get().subscriptions.findIndex(
        (s) => s.prefix.toLowerCase() === cleanPrefix.toLowerCase()
      );
      const nextSubs = [...get().subscriptions];
      if (existingIdx >= 0) {
        nextSubs[existingIdx] = {
          ...newSub,
          id: nextSubs[existingIdx].id,
        };
      } else {
        nextSubs.push(newSub);
      }

      try {
        localStorage.setItem(STORAGE_SUBS_KEY, JSON.stringify(nextSubs));
      } catch {
        // ignore
      }

      set({
        subscriptions: nextSubs,
        isFetchingSub: false,
        subFeedback: {
          type: "info",
          message: `Imported subscription [${cleanPrefix}] with User-Agent '${uaPreset.uaString}' (Auto-Update = 0).`,
        },
      });
      get().recomputePipeline();
      get().appendLog(
        `[INFO][Converter] Imported subscription ${cleanPrefix} (${rawContent.length} bytes) using UA ${uaPreset.uaString}`
      );
      return true;
    } catch (err: any) {
      set({
        isFetchingSub: false,
        subFeedback: {
          type: "danger",
          message: `Failed to fetch subscription [${cleanPrefix}]: ${
            err?.message || String(err)
          }`,
        },
      });
      return false;
    }
  },

  toggleSubscriptionEnabled: (id) => {
    const nextSubs = get().subscriptions.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    try {
      localStorage.setItem(STORAGE_SUBS_KEY, JSON.stringify(nextSubs));
    } catch {
      // ignore
    }
    set({ subscriptions: nextSubs });
    get().recomputePipeline();
  },

  updateSubscriptionItem: (id, patch) => {
    const nextSubs = get().subscriptions.map((s) => {
      if (s.id !== id) return s;
      const updated = { ...s, ...patch };
      if (patch.userAgentType) {
        const preset =
          USER_AGENT_PRESETS.find((u) => u.id === patch.userAgentType) ||
          USER_AGENT_PRESETS[0];
        updated.userAgentString = preset.uaString;
      }
      return updated;
    });
    try {
      localStorage.setItem(STORAGE_SUBS_KEY, JSON.stringify(nextSubs));
    } catch {
      // ignore
    }
    set({ subscriptions: nextSubs });
    get().recomputePipeline();
  },

  deleteSubscriptionItem: (id) => {
    const nextSubs = get().subscriptions.filter((s) => s.id !== id);
    try {
      localStorage.setItem(STORAGE_SUBS_KEY, JSON.stringify(nextSubs));
    } catch {
      // ignore
    }
    set({ subscriptions: nextSubs });
    get().recomputePipeline();
  },

  resetDemoSubscriptions: () => {
    try {
      localStorage.removeItem(STORAGE_SUBS_KEY);
      localStorage.removeItem(STORAGE_CHAINS_KEY);
    } catch {
      // ignore
    }
    set({
      subscriptions: DEFAULT_SUBSCRIPTIONS,
      chainRules: DEFAULT_CHAIN_LINK_RULES,
    });
    get().recomputePipeline();
  },

  namingScheme: initialScheme,
  setNamingScheme: (scheme) => {
    try {
      localStorage.setItem(STORAGE_SCHEME_KEY, scheme);
    } catch {
      // ignore
    }
    set({ namingScheme: scheme });
    get().recomputePipeline();
  },

  securityPolicy: "follow_source_with_warning",
  skipCertWarningAcknowledged: true,
  setSecurityPolicy: (policy) => {
    set({ securityPolicy: policy });
    get().recomputePipeline();
  },
  acknowledgeSkipCertWarning: (ack) =>
    set({ skipCertWarningAcknowledged: ack }),

  excludedProtocols: [],
  toggleExcludedProtocol: (protocol) => {
    const lower = protocol.toLowerCase();
    const cur = get().excludedProtocols;
    const next = cur.includes(lower)
      ? cur.filter((p) => p !== lower)
      : [...cur, lower];
    set({ excludedProtocols: next });
    get().recomputePipeline();
  },

  listenIp: "127.0.0.1",
  listenPort: 11400,
  logLevel: "info",
  autoDetectInterface: false,
  includeSurgeProxyGroups: true,
  setNetworkParams: (patch) => {
    set((s) => ({
      listenIp: patch.listenIp ?? s.listenIp,
      listenPort: patch.listenPort ?? s.listenPort,
      logLevel: patch.logLevel ?? s.logLevel,
      autoDetectInterface:
        patch.autoDetectInterface ?? s.autoDetectInterface,
      includeSurgeProxyGroups:
        patch.includeSurgeProxyGroups ?? s.includeSurgeProxyGroups,
    }));
    get().recomputePipeline();
  },

  chainRules: initialChains,
  selectedChainRuleId: initialChains[0]?.id || null,
  selectChainRule: (id) => set({ selectedChainRuleId: id }),

  addChainRule: (ruleInput) => {
    const newRule: ChainLinkRule = {
      ...ruleInput,
      id: `chain_${Date.now()}`,
    };
    const nextRules = [...get().chainRules, newRule];
    try {
      localStorage.setItem(STORAGE_CHAINS_KEY, JSON.stringify(nextRules));
    } catch {
      // ignore
    }
    set({ chainRules: nextRules, selectedChainRuleId: newRule.id });
    get().recomputePipeline();
    get().appendLog(
      `[INFO][Converter] Added ${newRule.hopCount}-hop chain proxy rule: ${newRule.name}`
    );
  },

  updateChainRule: (id, patch) => {
    const nextRules = get().chainRules.map((r) =>
      r.id === id ? { ...r, ...patch } : r
    );
    try {
      localStorage.setItem(STORAGE_CHAINS_KEY, JSON.stringify(nextRules));
    } catch {
      // ignore
    }
    set({ chainRules: nextRules });
    get().recomputePipeline();
  },

  deleteChainRule: (id) => {
    const nextRules = get().chainRules.filter((r) => r.id !== id);
    try {
      localStorage.setItem(STORAGE_CHAINS_KEY, JSON.stringify(nextRules));
    } catch {
      // ignore
    }
    set((s) => ({
      chainRules: nextRules,
      selectedChainRuleId:
        s.selectedChainRuleId === id
          ? nextRules[0]?.id || null
          : s.selectedChainRuleId,
    }));
    get().recomputePipeline();
  },

  toggleChainRule: (id) => {
    const nextRules = get().chainRules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    try {
      localStorage.setItem(STORAGE_CHAINS_KEY, JSON.stringify(nextRules));
    } catch {
      // ignore
    }
    set({ chainRules: nextRules });
    get().recomputePipeline();
  },

  regexTestQuery: "^YY-",
  setRegexTestQuery: (query) => set({ regexTestQuery: query }),

  directNodes: initialCompiled.directNodes,
  summaries: initialCompiled.summaries,
  singboxConfig: initialCompiled.singboxConfig,
  surgeConfigText: initialCompiled.surgeConfigText,
  endpoints: initialCompiled.endpoints,
  providerNodes: initialCompiled.providerNodes,
  visualEdges: initialCompiled.visualEdges,
  lastCheckResult: null,

  recomputePipeline: () => {
    const s = get();
    const compiled = executeFullCompilation({
      subscriptions: s.subscriptions,
      namingScheme: s.namingScheme,
      securityPolicy: s.securityPolicy,
      excludedProtocols: s.excludedProtocols,
      chainRules: s.chainRules,
      listenIp: s.listenIp,
      listenPort: s.listenPort,
      logLevel: s.logLevel,
      autoDetectInterface: s.autoDetectInterface,
      includeSurgeProxyGroups: s.includeSurgeProxyGroups,
    });
    set(compiled);
    get().runSingboxCheck();
  },

  runSingboxCheck: async () => {
    const jsonText = JSON.stringify(get().singboxConfig, null, 2);
    const res = await validateSingboxConfigWithCore(jsonText);
    set({ lastCheckResult: res });
  },

  mitmRules: DEFAULT_MITM_URL_REGEX_RULES,
  addMitmRule: (ruleInput) => {
    const newRule: MitmUrlRegexRule = {
      ...ruleInput,
      id: `mitm_${Date.now()}`,
    };
    set((s) => ({ mitmRules: [newRule, ...s.mitmRules] }));
  },
  toggleMitmRule: (id) =>
    set((s) => ({
      mitmRules: s.mitmRules.map((r) =>
        r.id === id ? { ...r, enabled: !r.enabled } : r
      ),
    })),
  deleteMitmRule: (id) =>
    set((s) => ({
      mitmRules: s.mitmRules.filter((r) => r.id !== id),
    })),

  runningMode: "stopped",
  setRunningMode: (mode) => set({ runningMode: mode }),
  logs: [
    parseRawLogLine(
      "[INFO][Converter] SingboxGUI V0 initialized with Sing-box 1.14.4 schema & Surge 5.10 SOCKS5 bridge.",
      1
    ),
    parseRawLogLine(
      "[INFO][Converter] Default subscription User-Agent set to clash-verge/v2.4.7; auto-update interval = 0 (manual only).",
      2
    ),
    parseRawLogLine(
      "[INFO][Converter] Auto-detected custom authenticated DoH (dns-xf) from XF subscription proxy-server-nameserver.",
      3
    ),
  ],
  appendLog: (rawLine) =>
    set((s) => {
      const next = [
        ...s.logs.slice(-499),
        parseRawLogLine(rawLine, s.logs.length + 1),
      ];
      return { logs: next };
    }),
  clearLogs: () => set({ logs: [] }),
}));
