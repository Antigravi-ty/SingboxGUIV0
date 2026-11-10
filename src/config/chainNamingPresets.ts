import { ChainNamingSchemeId, ChainNamingSchemeSpec } from "../types/chainProxy";

export const CHAIN_NAMING_SCHEMES: Record<
  ChainNamingSchemeId,
  ChainNamingSchemeSpec
> = {
  scheme_a_tilde: {
    id: "scheme_a_tilde",
    title: "Scheme A (Recommended): Native Direct (YY-) + Delimiter-Separated Chain (CP1~LC>YY~)",
    shortBadge: "YY- | CP1~LC>YY~",
    summary:
      "Direct nodes retain their clean native prefix (YY-) with a hyphen delimiter, while Chain Proxies use tilde and arrow delimiters (CP1~LC>YY~). Because 'YY-' never appears inside 'CP1~LC>YY~', a simple 'YY-' or '^YY-' regex exclusively matches Direct YY connections without false positives.",
    directExample: "YY-🇺🇸US-01 | BGP",
    oneHopExample: "CP1~LC>YY~🇺🇸US-01 | BGP [via 🇯🇵AWS-JP1]",
    twoHopExample: "CP2~LC>LT>YY~🇺🇸US-01 | BGP [via 🇯🇵AWS-JP1>🇸🇬SG]",
    selfHopExample: "CP1~LC>LC~🇺🇸US-Phoenix1 [via 🇯🇵AWS-JP1]",
    regexCheatSheet: [
      {
        intent: "Direct YY only (0-hop)",
        pattern: "^YY-",
        explanation:
          "Even unanchored 'YY-' matches ONLY Direct YY nodes because chain hops use '>YY~' instead of 'YY-'.",
      },
      {
        intent: "1-Hop LC -> YY only",
        pattern: "^CP1~LC>YY~",
        explanation: "Matches all 1-hop chains entering via LC and exiting via YY.",
      },
      {
        intent: "2-Hop LC -> LT -> YY only",
        pattern: "^CP2~LC>LT>YY~",
        explanation: "Matches 2-hop chains routed LC -> LT -> YY.",
      },
      {
        intent: "Self-Hop LC -> LC only (e.g. LC JP to LC US)",
        pattern: "^CP1~LC>LC~",
        explanation: "Matches intra-provider self-relay chains within LC.",
      },
      {
        intent: "All YY Exits (Direct + Any Chain landing on YY)",
        pattern: "(^YY-|>YY~)",
        explanation: "Matches both Direct YY nodes and any multi-hop chain whose exit is YY.",
      },
      {
        intent: "All Direct Nodes (All Providers, 0-hop)",
        pattern: "^(?!CP\\d~)",
        explanation: "Excludes all CP1~/CP2~ chain proxies.",
      },
    ],
    pros: [
      "Preserves native 'YY-' prefix for Direct nodes (100% compatible with existing Surge configs).",
      "Unanchored 'YY-' never collides with chain proxies because chain hops use '>' and '~' instead of '-'.",
      "Self-hop 'CP1~LC>LC~' is immediately distinguishable from Direct 'LC-'.",
    ],
    cons: [
      "Matching both Direct and Chain exits of YY together requires '(^YY-|>YY~)'.",
    ],
  },
  scheme_b_dir: {
    id: "scheme_b_dir",
    title: "Scheme B (Explicit Hop Prefix): DIR-YY- / CP1-LC-YY- / CP2-LC-LT-YY-",
    shortBadge: "DIR-YY- | CP1-LC-YY-",
    summary:
      "Every node explicitly starts with its hop topology tag: DIR-<Provider>- for direct connections, CP1-<Entry>-<Exit>- for 1-hop chains, and CP2-<Entry>-<Mid>-<Exit>- for 2-hop chains.",
    directExample: "DIR-YY-🇺🇸US-01 | BGP",
    oneHopExample: "CP1-LC-YY-🇺🇸US-01 | BGP [via 🇯🇵AWS-JP1]",
    twoHopExample: "CP2-LC-LT-YY-🇺🇸US-01 | BGP [via 🇯🇵AWS-JP1>🇸🇬SG]",
    selfHopExample: "CP1-LC-LC-🇺🇸US-Phoenix1 [via 🇯🇵AWS-JP1]",
    regexCheatSheet: [
      {
        intent: "Direct YY only (0-hop)",
        pattern: "^DIR-YY-",
        explanation: "Explicitly anchors on the DIR- prefix so CP1-LC-YY- is never matched.",
      },
      {
        intent: "1-Hop LC -> YY only",
        pattern: "^CP1-LC-YY-",
        explanation: "Matches 1-hop chains from LC to YY.",
      },
      {
        intent: "2-Hop LC -> LT -> YY only",
        pattern: "^CP2-LC-LT-YY-",
        explanation: "Matches 2-hop chains from LC via LT to YY.",
      },
      {
        intent: "Self-Hop LC -> LC only",
        pattern: "^CP1-LC-LC-",
        explanation: "Matches intra-provider chains within LC.",
      },
      {
        intent: "All Direct Nodes (All Providers)",
        pattern: "^DIR-",
        explanation: "Simple prefix match for all 0-hop nodes.",
      },
    ],
    pros: [
      "Uniform self-documenting structure across DIR, CP1, and CP2.",
      "Filtering all Direct nodes across every provider is simply '^DIR-'.",
    ],
    cons: [
      "Unanchored 'YY-' matches both 'DIR-YY-' and 'CP1-LC-YY-'; you must use '^DIR-YY-'.",
    ],
  },
  scheme_c_exit_at: {
    id: "scheme_c_exit_at",
    title: "Scheme C (Exit-First Grouping): YY@DIR- / YY@CP1-LC- / YY@CP2-LC-LT-",
    shortBadge: "YY@DIR- | YY@CP1-LC-",
    summary:
      "Places the final Exit Provider first followed by '@', so sorting alphabetically or matching '^YY@' groups all routes landing on YY together while '^YY@DIR-' isolates direct connections.",
    directExample: "YY@DIR-🇺🇸US-01 | BGP",
    oneHopExample: "YY@CP1-LC-🇺🇸US-01 | BGP [via 🇯🇵AWS-JP1]",
    twoHopExample: "YY@CP2-LC-LT-🇺🇸US-01 | BGP [via 🇯🇵AWS-JP1>🇸🇬SG]",
    selfHopExample: "LC@CP1-LC-🇺🇸US-Phoenix1 [via 🇯🇵AWS-JP1]",
    regexCheatSheet: [
      {
        intent: "Direct YY only (0-hop)",
        pattern: "^YY@DIR-",
        explanation: "Matches only direct YY nodes.",
      },
      {
        intent: "All YY Exits (Direct + All Chains landing on YY)",
        pattern: "^YY@",
        explanation: "Single prefix matches every route whose exit IP belongs to YY.",
      },
      {
        intent: "1-Hop LC -> YY only",
        pattern: "^YY@CP1-LC-",
        explanation: "Matches 1-hop chains landing on YY from LC.",
      },
      {
        intent: "2-Hop LC -> LT -> YY only",
        pattern: "^YY@CP2-LC-LT-",
        explanation: "Matches 2-hop chains landing on YY via LC -> LT.",
      },
      {
        intent: "Self-Hop LC -> LC only",
        pattern: "^LC@CP1-LC-",
        explanation: "Matches intra-provider chains landing on LC from LC.",
      },
    ],
    pros: [
      "Matching all routes that exit via YY (regardless of hop count) is just '^YY@'.",
      "Direct YY is cleanly isolated via '^YY@DIR-'.",
    ],
    cons: [
      "Changes the traditional 'YY-' prefix to 'YY@DIR-'.",
    ],
  },
};

export function formatDirectNodeTag(
  scheme: ChainNamingSchemeId,
  providerPrefix: string,
  rawNodeName: string
): string {
  const cleanPrefix = providerPrefix.replace(/[-~@]+$/, "").trim();
  switch (scheme) {
    case "scheme_a_tilde":
      return `${cleanPrefix}-${rawNodeName}`;
    case "scheme_b_dir":
      return `DIR-${cleanPrefix}-${rawNodeName}`;
    case "scheme_c_exit_at":
      return `${cleanPrefix}@DIR-${rawNodeName}`;
  }
}

export function formatChainNodeTag(params: {
  scheme: ChainNamingSchemeId;
  hopCount: 1 | 2;
  entryPrefix: string;
  middlePrefix?: string;
  exitPrefix: string;
  exitRawName: string;
  entryRawName: string;
  middleRawName?: string;
}): string {
  const entry = params.entryPrefix.replace(/[-~@]+$/, "").trim();
  const mid = (params.middlePrefix || "").replace(/[-~@]+$/, "").trim();
  const exit = params.exitPrefix.replace(/[-~@]+$/, "").trim();
  const viaSuffix =
    params.hopCount === 2 && params.middleRawName
      ? `[via ${params.entryRawName}>${params.middleRawName}]`
      : `[via ${params.entryRawName}]`;

  switch (params.scheme) {
    case "scheme_a_tilde":
      if (params.hopCount === 2 && mid) {
        return `CP2~${entry}>${mid}>${exit}~${params.exitRawName} ${viaSuffix}`;
      }
      return `CP1~${entry}>${exit}~${params.exitRawName} ${viaSuffix}`;

    case "scheme_b_dir":
      if (params.hopCount === 2 && mid) {
        return `CP2-${entry}-${mid}-${exit}-${params.exitRawName} ${viaSuffix}`;
      }
      return `CP1-${entry}-${exit}-${params.exitRawName} ${viaSuffix}`;

    case "scheme_c_exit_at":
      if (params.hopCount === 2 && mid) {
        return `${exit}@CP2-${entry}-${mid}-${params.exitRawName} ${viaSuffix}`;
      }
      return `${exit}@CP1-${entry}-${params.exitRawName} ${viaSuffix}`;
  }
}
