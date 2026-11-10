export type UserAgentType =
  | "clash-verge"
  | "mihomo"
  | "clash-meta"
  | "sing-box";

export interface UserAgentPreset {
  id: UserAgentType;
  label: string;
  uaString: string;
  expectedFormat: "yaml" | "json";
  description: string;
}

export interface SubscriptionUserInfo {
  upload?: number;
  download?: number;
  total?: number;
  expire?: number | null;
}

export interface SubscriptionItem {
  id: string;
  prefix: string;
  name: string;
  url: string;
  enabled: boolean;
  userAgentType: UserAgentType;
  userAgentString: string;
  filename: string;
  format: "yaml" | "json";
  autoUpdateIntervalMinutes: number;
  lastUpdated: string;
  userInfo?: SubscriptionUserInfo | null;
  rawContent: string;
  customDnsDoHUrls?: string[];
  customPrivateDomainSuffixes?: string[];
}

export interface JsonPathMatch {
  path: string;
  key: string;
  value: unknown;
  valuePreview: string;
  type: "object" | "array" | "string" | "number" | "boolean" | "null";
}

export interface FetchSubscriptionResult {
  success: boolean;
  content?: string;
  userInfo?: SubscriptionUserInfo | null;
  error?: string;
  invalidSyntax?: boolean;
  syntaxErrorDetails?: {
    message: string;
    line: number;
    column: number;
    rawContent: string;
  };
}
