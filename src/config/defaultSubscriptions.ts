import { ChainLinkRule } from "../types/chainProxy";
import { MitmUrlRegexRule } from "../types/mitm";
import { SubscriptionItem, UserAgentPreset } from "../types/subscription";

export const DEFAULT_USER_AGENT_TYPE = "clash-verge" as const;
export const DEFAULT_AUTO_UPDATE_INTERVAL = 0;

export const USER_AGENT_PRESETS: UserAgentPreset[] = [
  {
    id: "clash-verge",
    label: "Clash Verge (Default Mihomo YAML)",
    uaString: "clash-verge/v2.4.7",
    expectedFormat: "yaml",
    description:
      "Recommended default. Requests full Mihomo/Clash.Meta YAML (VLESS Reality, Hysteria2, AnyTLS, ECH, custom DoH) for local conversion to Sing-box 1.14.4.",
  },
  {
    id: "mihomo",
    label: "Mihomo Core (Clash.Meta)",
    uaString: "mihomo/1.19.0",
    expectedFormat: "yaml",
    description:
      "Direct Mihomo core User-Agent for providers that gate AnyTLS or Hysteria2 port hopping behind mihomo/*.",
  },
  {
    id: "clash-meta",
    label: "ClashMetaForAndroid",
    uaString: "ClashMetaForAndroid/2.11.2.Meta",
    expectedFormat: "yaml",
    description:
      "Mobile Clash.Meta User-Agent compatible with legacy panels.",
  },
  {
    id: "sing-box",
    label: "Sing-Box 1.14.4 Native",
    uaString: "SFI (sing-box 1.14.4; language en_US)",
    expectedFormat: "json",
    description:
      "Requests native Sing-box JSON directly from panel (converted/normalized to 1.14.4 schema).",
  },
];

export const PROVIDER_COLOR_MAP: Record<string, string> = {
  LC: "#2f81f7",
  XF: "#a371f7",
  YY: "#3fb950",
  LT: "#d29922",
  RTX: "#f778ba",
  DY: "#58a6ff",
  SE: "#db6d28",
};

import {
  EXAMPLE_BASIC_LC_YAML,
  EXAMPLE_COMPLEX_XF_YAML,
  EXAMPLE_LT_YAML,
  EXAMPLE_SE_YAML,
  EXAMPLE_YY_YAML,
} from "./sampleSubscriptionYamls";

export {
  EXAMPLE_BASIC_LC_YAML,
  EXAMPLE_COMPLEX_XF_YAML,
  EXAMPLE_LT_YAML,
  EXAMPLE_SE_YAML,
  EXAMPLE_YY_YAML,
};

export const DEFAULT_SUBSCRIPTIONS: SubscriptionItem[] = [
  {
    id: "sub_lc_basic",
    prefix: "LC",
    name: "LC Cloud (exampleBasic.yaml — Hysteria2 Port-Hop + VLESS Reality/WS)",
    url: "https://sub.lc-cloud.example/api/v1/client/subscribe?token=hided_lc_token",
    enabled: true,
    userAgentType: "clash-verge",
    userAgentString: "clash-verge/v2.4.7",
    filename: "LC.yaml",
    format: "yaml",
    autoUpdateIntervalMinutes: 0,
    lastUpdated: "2026-11-09 20:00:00",
    userInfo: {
      upload: 2147483648,
      download: 15032385536,
      total: 107374182400,
      expire: null,
    },
    rawContent: EXAMPLE_BASIC_LC_YAML,
  },
  {
    id: "sub_xf_complex",
    prefix: "XF",
    name: "XFLTD (exampleComplex.yaml — Private Authenticated DoH + VLESS Reality)",
    url: "https://sub.xfltd.example/api/v1/client/subscribe?token=hided_xf_token",
    enabled: true,
    userAgentType: "clash-verge",
    userAgentString: "clash-verge/v2.4.7",
    filename: "XF.yaml",
    format: "yaml",
    autoUpdateIntervalMinutes: 0,
    lastUpdated: "2026-11-09 20:00:00",
    userInfo: {
      upload: 536870912,
      download: 8589934592,
      total: 53687091200,
      expire: 1893456000,
    },
    rawContent: EXAMPLE_COMPLEX_XF_YAML,
    customDnsDoHUrls: [
      "https://cn.ali-oss.cn:44443/dns-query/6dafe708-d9d6-48cc-a768-e6ed3018a9ec",
    ],
    customPrivateDomainSuffixes: [".cnrcz.cn", ".csnau.cn"],
  },
  {
    id: "sub_yy_bgp",
    prefix: "YY",
    name: "YY BGP Network (SS-2022 + VMess WS + Trojan)",
    url: "https://sub.yy-bgp.example/api/v1/client/subscribe?token=hided_yy_token",
    enabled: true,
    userAgentType: "clash-verge",
    userAgentString: "clash-verge/v2.4.7",
    filename: "YY.yaml",
    format: "yaml",
    autoUpdateIntervalMinutes: 0,
    lastUpdated: "2026-11-09 20:00:00",
    userInfo: {
      upload: 1073741824,
      download: 21474836480,
      total: 214748364800,
      expire: 1861920000,
    },
    rawContent: EXAMPLE_YY_YAML,
  },
  {
    id: "sub_lt_exp",
    prefix: "LT",
    name: "LT Experimental Transit (VLESS + ECH)",
    url: "https://sub.lt-transit.example/api/v1/client/subscribe?token=hided_lt_token",
    enabled: true,
    userAgentType: "clash-verge",
    userAgentString: "clash-verge/v2.4.7",
    filename: "LT.yaml",
    format: "yaml",
    autoUpdateIntervalMinutes: 0,
    lastUpdated: "2026-11-09 20:00:00",
    userInfo: {
      upload: 322122547,
      download: 4294967296,
      total: 53687091200,
      expire: null,
    },
    rawContent: EXAMPLE_LT_YAML,
  },
  {
    id: "sub_se_anytls",
    prefix: "SE",
    name: "SE Global AnyTLS & IEPL",
    url: "https://sub.se-anytls.example/api/v1/client/subscribe?token=hided_se_token",
    enabled: true,
    userAgentType: "clash-verge",
    userAgentString: "clash-verge/v2.4.7",
    filename: "SE.yaml",
    format: "yaml",
    autoUpdateIntervalMinutes: 0,
    lastUpdated: "2026-11-09 20:00:00",
    userInfo: {
      upload: 644245094,
      download: 9663676416,
      total: 107374182400,
      expire: 1877644800,
    },
    rawContent: EXAMPLE_SE_YAML,
  },
];

export const DEFAULT_CHAIN_LINK_RULES: ChainLinkRule[] = [
  {
    id: "chain_lc_to_yy",
    name: "1-Hop Dynamic Pool: LC (JP Entry Pool) -> YY (All Exits)",
    enabled: true,
    hopCount: 1,
    entryPrefix: "LC",
    entryNodeFilterRegex: "AWS-JP|JP|日本",
    exitPrefix: "YY",
    exitNodeFilterRegex: ".*",
    expansionMode: "urltest_pool_to_exits",
    maxGeneratedNodes: 25,
  },
  {
    id: "chain_lc_self_jp_to_us",
    name: "1-Hop Self-Relay: LC (JP Entry Pool) -> LC (US Exits)",
    enabled: true,
    hopCount: 1,
    entryPrefix: "LC",
    entryNodeFilterRegex: "AWS-JP|JP|日本",
    exitPrefix: "LC",
    exitNodeFilterRegex: "US-|美国",
    expansionMode: "urltest_pool_to_exits",
    maxGeneratedNodes: 15,
  },
  {
    id: "chain_2hop_lc_lt_yy",
    name: "2-Hop Multi-Relay: LC (JP) -> LT (SG Transit) -> YY (US/UK Exits)",
    enabled: true,
    hopCount: 2,
    entryPrefix: "LC",
    entryNodeFilterRegex: "AWS-JP|JP|日本",
    middlePrefix: "LT",
    middleNodeFilterRegex: "SG|新加坡",
    exitPrefix: "YY",
    exitNodeFilterRegex: "US|UK|美国|英国",
    expansionMode: "urltest_pool_to_exits",
    maxGeneratedNodes: 15,
  },
  {
    id: "chain_xf_to_se",
    name: "1-Hop DoH-Protected Entry: XF (HK Pool) -> SE (AnyTLS US/JP)",
    enabled: true,
    hopCount: 1,
    entryPrefix: "XF",
    entryNodeFilterRegex: "HK|香港",
    exitPrefix: "SE",
    exitNodeFilterRegex: "ANYTLS",
    expansionMode: "urltest_pool_to_exits",
    maxGeneratedNodes: 10,
  },
];

export const DEFAULT_MITM_URL_REGEX_RULES: MitmUrlRegexRule[] = [
  {
    id: "mitm_rule_openai",
    name: "AI API Traffic -> LC->YY US Chain",
    enabled: true,
    urlRegex: "^https?://([a-z0-9-]+\\.)?(openai\\.com|chatgpt\\.com|anthropic\\.com)/(.*)$",
    methods: ["GET", "POST"],
    actionType: "route_outbound",
    targetOutboundOrGroup: "^CP1~LC>YY~.*US",
    note: "Routes AI API requests through the 1-hop LC->YY US chain proxy.",
  },
  {
    id: "mitm_rule_github_raw",
    name: "GitHub Raw & Releases -> Self-Relay LC JP->US",
    enabled: true,
    urlRegex: "^https?://(raw\\.githubusercontent\\.com|objects\\.githubusercontent\\.com)/(.*)$",
    methods: ["GET", "HEAD"],
    actionType: "route_outbound",
    targetOutboundOrGroup: "^CP1~LC>LC~.*US",
    note: "Accelerates large artifact downloads via LC Japan to LC US self-hop.",
  },
  {
    id: "mitm_rule_debug_header",
    name: "Diagnostic Header Injection",
    enabled: true,
    urlRegex: "^https?://httpbin\\.org/anything/(.*)$",
    methods: ["GET", "POST"],
    actionType: "inject_header",
    targetOutboundOrGroup: "^YY-",
    headerKey: "x-singbox-mitm-routed",
    headerValue: "chain-verified",
    note: "Injects verification header when inspecting MITM routing.",
  },
];
