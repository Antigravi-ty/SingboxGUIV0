import {
  DEFAULT_CHAIN_LINK_RULES,
  DEFAULT_SUBSCRIPTIONS,
} from "../config/defaultSubscriptions";
import {
  ChainLinkRule,
  ChainNamingSchemeId,
  GeneratedProxyEndpoint,
  TopologyProviderNode,
  TopologyVisualEdge,
} from "../types/chainProxy";
import {
  ConversionSubscriptionSummary,
  ConvertedNodeMetadata,
  SingboxConfig,
  TlsSecurityPolicyMode,
} from "../types/singbox";
import { SubscriptionItem } from "../types/subscription";
import { buildSingboxAndSurgePipeline } from "../utils/chainProxyEngine";
import { convertSubscriptionsToSingboxNodes } from "../utils/mihomoToSingboxConverter";

export const STORAGE_SUBS_KEY = "singbox_gui_v0_subscriptions";
export const STORAGE_CHAINS_KEY = "singbox_gui_v0_chain_rules";
export const STORAGE_SCHEME_KEY = "singbox_gui_v0_naming_scheme";

export function loadInitialSubscriptions(): SubscriptionItem[] {
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

export function saveSubscriptionsToStorage(subs: SubscriptionItem[]): void {
  try {
    localStorage.setItem(STORAGE_SUBS_KEY, JSON.stringify(subs));
  } catch {
    // ignore
  }
}

export function loadInitialChainRules(): ChainLinkRule[] {
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

export function saveChainRulesToStorage(rules: ChainLinkRule[]): void {
  try {
    localStorage.setItem(STORAGE_CHAINS_KEY, JSON.stringify(rules));
  } catch {
    // ignore
  }
}

export function loadInitialNamingScheme(): ChainNamingSchemeId {
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

export function saveNamingSchemeToStorage(scheme: ChainNamingSchemeId): void {
  try {
    localStorage.setItem(STORAGE_SCHEME_KEY, scheme);
  } catch {
    // ignore
  }
}

export function clearWorkspaceStorage(): void {
  try {
    localStorage.removeItem(STORAGE_SUBS_KEY);
    localStorage.removeItem(STORAGE_CHAINS_KEY);
  } catch {
    // ignore
  }
}

export function executeFullCompilation(state: {
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
}): {
  directNodes: ConvertedNodeMetadata[];
  summaries: ConversionSubscriptionSummary[];
  singboxConfig: SingboxConfig;
  surgeConfigText: string;
  endpoints: GeneratedProxyEndpoint[];
  providerNodes: TopologyProviderNode[];
  visualEdges: TopologyVisualEdge[];
} {
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
