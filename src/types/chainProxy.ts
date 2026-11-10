import { SingboxOutbound } from "./singbox";

export type ChainNamingSchemeId =
  | "scheme_a_tilde"
  | "scheme_b_dir"
  | "scheme_c_exit_at";

export type ChainExpansionMode =
  | "primary_entry_to_all_exits"
  | "round_robin_pairing"
  | "full_cartesian";

export interface ChainNamingSchemeSpec {
  id: ChainNamingSchemeId;
  title: string;
  shortBadge: string;
  summary: string;
  directExample: string;
  oneHopExample: string;
  twoHopExample: string;
  selfHopExample: string;
  regexCheatSheet: Array<{
    intent: string;
    pattern: string;
    explanation: string;
  }>;
  pros: string[];
  cons: string[];
}

export interface ChainLinkRule {
  id: string;
  name: string;
  enabled: boolean;
  hopCount: 1 | 2;
  entryPrefix: string;
  entryNodeFilterRegex: string;
  middlePrefix?: string;
  middleNodeFilterRegex?: string;
  exitPrefix: string;
  exitNodeFilterRegex: string;
  expansionMode: ChainExpansionMode;
  maxGeneratedNodes: number;
}

export interface GeneratedProxyEndpoint {
  index: number;
  username: string;
  password: string;
  finalTag: string;
   surgeProxyLine: string;
  hopCount: 0 | 1 | 2;
  isSelfHop: boolean;
  entryPrefix: string;
  middlePrefix?: string;
  exitPrefix: string;
  hopTags: string[];
  protocolChain: string[];
  ruleId?: string;
  outbound: SingboxOutbound;
}

export interface TopologyProviderNode {
  prefix: string;
  label: string;
  nodeCount: number;
  insecureCount: number;
  protocols: string[];
  colorHex: string;
  sampleNodes: string[];
  hasCustomDoH: boolean;
}

export interface TopologyVisualEdge {
  id: string;
  ruleId: string;
  ruleName: string;
  enabled: boolean;
  hopCount: 1 | 2;
  isSelfHop: boolean;
  fromPrefix: string;
  viaPrefix?: string;
  toPrefix: string;
  entryFilter: string;
  middleFilter?: string;
  exitFilter: string;
  generatedCount: number;
  colorHex: string;
  sampleGeneratedTags: string[];
}
