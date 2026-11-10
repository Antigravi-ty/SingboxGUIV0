import { create } from "zustand";
import {
  DEFAULT_CHAIN_LINK_RULES,
  DEFAULT_MITM_URL_REGEX_RULES,
  DEFAULT_SUBSCRIPTIONS,
  USER_AGENT_PRESETS,
} from "../config/defaultSubscriptions";
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
import {
  clearWorkspaceStorage,
  executeFullCompilation,
  loadInitialChainRules,
  loadInitialNamingScheme,
  loadInitialNetworkParams,
  loadInitialSubscriptions,
  saveChainRulesToStorage,
  saveNamingSchemeToStorage,
  saveNetworkParamsToStorage,
  saveSubscriptionsToStorage,
} from "./workspacePersistence";
import {
  hydrateStoresFromDiskUiConfig,
  performAddOrFetchSubscription,
  performServiceStartOrStop,
  performSingboxCheck,
  syncUiConfigSnapshotToDisk,
} from "./workspaceServiceActions";

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
  lastFailedRawResponse: {
    prefix: string;
    url: string;
    rawBody: string;
  } | null;
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
  clearAllSubscriptions: () => void;

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
  hydrateUiConfigFromDisk: () => Promise<void>;

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
  isCheckingConfig: boolean;
  isStartingService: boolean;
  runSingboxCheck: () => Promise<void>;
  startOrStopServiceAction: (
    action: "start" | "stop"
  ) => Promise<{ ok: boolean; message: string }>;
  recomputePipeline: () => void;

  mitmRules: MitmUrlRegexRule[];
  addMitmRule: (rule: Omit<MitmUrlRegexRule, "id">) => void;
  toggleMitmRule: (id: string) => void;
  deleteMitmRule: (id: string) => void;
  loadSampleMitmRules: () => void;

  runningMode: RunningMode;
  setRunningMode: (mode: RunningMode) => void;
  logs: ParsedLogEntry[];
  appendLog: (rawLine: string) => void;
  appendLogsBatch: (rawLines: string[]) => void;
  clearLogs: () => void;
}

const initialSubs = loadInitialSubscriptions();
const initialChains = loadInitialChainRules();
const initialScheme = loadInitialNamingScheme();
const initialNet = loadInitialNetworkParams();

const initialCompiled = executeFullCompilation({
  subscriptions: initialSubs,
  namingScheme: initialScheme,
  securityPolicy: "follow_source_with_warning",
  excludedProtocols: [],
  chainRules: initialChains,
  listenIp: initialNet.listenIp,
  listenPort: initialNet.listenPort,
  logLevel: "info",
  autoDetectInterface: initialNet.autoDetectInterface,
  includeSurgeProxyGroups: initialNet.includeSurgeProxyGroups,
});

let backgroundCheckTimer: ReturnType<typeof setTimeout> | null = null;
let nextLogSequenceId = 3;

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activeTab: "console",
  setActiveTab: (tab) => set({ activeTab: tab }),

  subscriptions: initialSubs,
  isFetchingSub: false,
  subFeedback: null,
  lastFailedRawResponse: null,
  clearSubFeedback: () =>
    set({ subFeedback: null, lastFailedRawResponse: null }),

  addOrFetchSubscription: (params) =>
    performAddOrFetchSubscription(params, {
      subscriptions: get().subscriptions,
      namingScheme: get().namingScheme,
      securityPolicy: get().securityPolicy,
      setPartial: (patch) => set(patch as any),
      recomputePipeline: () => get().recomputePipeline(),
      appendLog: (line) => get().appendLog(line),
    }),

  toggleSubscriptionEnabled: (id) => {
    const nextSubs = get().subscriptions.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    saveSubscriptionsToStorage(nextSubs);
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
    saveSubscriptionsToStorage(nextSubs);
    set({ subscriptions: nextSubs });
    get().recomputePipeline();
  },

  deleteSubscriptionItem: (id) => {
    const nextSubs = get().subscriptions.filter((s) => s.id !== id);
    saveSubscriptionsToStorage(nextSubs);
    set({ subscriptions: nextSubs });
    get().recomputePipeline();
  },

  resetDemoSubscriptions: () => {
    saveSubscriptionsToStorage(DEFAULT_SUBSCRIPTIONS);
    saveChainRulesToStorage(DEFAULT_CHAIN_LINK_RULES);
    set({
      subscriptions: DEFAULT_SUBSCRIPTIONS,
      chainRules: DEFAULT_CHAIN_LINK_RULES,
      selectedChainRuleId: DEFAULT_CHAIN_LINK_RULES[0]?.id || null,
      subFeedback: {
        type: "info",
        message:
          "Loaded built-in sample subscriptions (LC, XF, YY, LT, SE) and chain proxy rules.",
      },
    });
    get().recomputePipeline();
  },

  clearAllSubscriptions: () => {
    clearWorkspaceStorage();
    set({
      subscriptions: [],
      chainRules: [],
      selectedChainRuleId: null,
      subFeedback: {
        type: "info",
        message: "Cleared all subscriptions and chain proxy rules.",
      },
    });
    get().recomputePipeline();
  },

  namingScheme: initialScheme,
  setNamingScheme: (scheme) => {
    saveNamingSchemeToStorage(scheme);
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

  listenIp: initialNet.listenIp,
  listenPort: initialNet.listenPort,
  logLevel: "info",
  autoDetectInterface: initialNet.autoDetectInterface,
  includeSurgeProxyGroups: initialNet.includeSurgeProxyGroups,
  setNetworkParams: (patch) => {
    const cur = get();
    const nextListenIp = patch.listenIp ?? cur.listenIp;
    const nextListenPort = patch.listenPort ?? cur.listenPort;
    const nextLogLevel = patch.logLevel ?? cur.logLevel;
    const nextAutoDetect =
      patch.autoDetectInterface ?? cur.autoDetectInterface;
    const nextIncludeGroups =
      patch.includeSurgeProxyGroups ?? cur.includeSurgeProxyGroups;

    set({
      listenIp: nextListenIp,
      listenPort: nextListenPort,
      logLevel: nextLogLevel,
      autoDetectInterface: nextAutoDetect,
      includeSurgeProxyGroups: nextIncludeGroups,
    });

    const netSnapshot = {
      listenIp: nextListenIp,
      listenPort: nextListenPort,
      autoDetectInterface: nextAutoDetect,
      includeSurgeProxyGroups: nextIncludeGroups,
    };
    saveNetworkParamsToStorage(netSnapshot);
    void syncUiConfigSnapshotToDisk(netSnapshot);
    get().recomputePipeline();
  },

  hydrateUiConfigFromDisk: async () => {
    await hydrateStoresFromDiskUiConfig((netPatch) => {
      const cur = get();
      if (
        cur.listenIp !== netPatch.listenIp ||
        cur.listenPort !== netPatch.listenPort ||
        cur.autoDetectInterface !== netPatch.autoDetectInterface ||
        cur.includeSurgeProxyGroups !== netPatch.includeSurgeProxyGroups
      ) {
        set(netPatch);
        get().recomputePipeline();
      }
    });
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
    saveChainRulesToStorage(nextRules);
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
    saveChainRulesToStorage(nextRules);
    set({ chainRules: nextRules });
    get().recomputePipeline();
  },

  deleteChainRule: (id) => {
    const nextRules = get().chainRules.filter((r) => r.id !== id);
    saveChainRulesToStorage(nextRules);
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
    saveChainRulesToStorage(nextRules);
    set({ chainRules: nextRules });
    get().recomputePipeline();
  },

  regexTestQuery: "",
  setRegexTestQuery: (query) => set({ regexTestQuery: query }),

  directNodes: initialCompiled.directNodes,
  summaries: initialCompiled.summaries,
  singboxConfig: initialCompiled.singboxConfig,
  surgeConfigText: initialCompiled.surgeConfigText,
  endpoints: initialCompiled.endpoints,
  providerNodes: initialCompiled.providerNodes,
  visualEdges: initialCompiled.visualEdges,
  lastCheckResult: null,
  isCheckingConfig: false,
  isStartingService: false,

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

    if (backgroundCheckTimer) {
      clearTimeout(backgroundCheckTimer);
    }
    backgroundCheckTimer = setTimeout(() => {
      void get().runSingboxCheck();
    }, 180);
  },

  runSingboxCheck: () =>
    performSingboxCheck({
      getSingboxConfig: () => get().singboxConfig,
      getSurgeConfigText: () => get().surgeConfigText,
      setPartial: (patch) => set(patch as any),
      appendLog: (line) => get().appendLog(line),
    }),

  startOrStopServiceAction: (action) =>
    performServiceStartOrStop(action, {
      getSingboxConfig: () => get().singboxConfig,
      getSurgeConfigText: () => get().surgeConfigText,
      setPartial: (patch) => set(patch as any),
      appendLog: (line) => get().appendLog(line),
      appendLogsBatch: (lines) => get().appendLogsBatch(lines),
    }),

  mitmRules: [],
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
  loadSampleMitmRules: () =>
    set({ mitmRules: DEFAULT_MITM_URL_REGEX_RULES }),

  runningMode: "stopped",
  setRunningMode: (mode) => set({ runningMode: mode }),
  logs: [
    parseRawLogLine(
      "[INFO][Converter] SingboxGUI V0 initialized with Sing-box 1.14.4 schema & Surge 5.10 SOCKS5 bridge.",
      1
    ),
    parseRawLogLine(
      "[INFO][Converter] Enhanced mode (route.auto_detect_interface = true) enabled by default; UI config synced to ui-config.json.",
      2
    ),
  ],
  appendLog: (rawLine) =>
    set((s) => {
      const next = [
        ...s.logs.slice(-599),
        parseRawLogLine(rawLine, nextLogSequenceId++),
      ];
      return { logs: next };
    }),
  appendLogsBatch: (rawLines) => {
    if (!rawLines || rawLines.length === 0) return;
    set((s) => {
      const parsedBatch = rawLines
        .filter((l) => typeof l === "string" && l.trim().length > 0)
        .map((line) => parseRawLogLine(line, nextLogSequenceId++));
      if (parsedBatch.length === 0) return {};
      const combined = [...s.logs, ...parsedBatch].slice(-600);
      return { logs: combined };
    });
  },
  clearLogs: () => set({ logs: [] }),
}));
