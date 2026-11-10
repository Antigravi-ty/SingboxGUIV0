export interface MitmStatus {
  enabled: boolean;
  port: number | null;
  is_macos: boolean;
  message: string;
}

export interface ValidationStep {
  step_number: number;
  name: string;
  passed: boolean;
  message: string;
}

export interface CertValidationResult {
  success: boolean;
  subject: string;
  issuer: string;
  not_before: string;
  not_after: string;
  is_expired: boolean;
  is_ca: boolean;
  key_pair_matched: boolean;
  key_algorithm: string;
  key_storage: string;
  steps: ValidationStep[];
  cert_path: string;
  key_path?: string | null;
}

export type MitmRouteActionType =
  | "route_outbound"
  | "inject_header"
  | "rewrite_url"
  | "mock_response"
  | "reject_request";

export interface MitmUrlRegexRule {
  id: string;
  name: string;
  enabled: boolean;
  urlRegex: string;
  methods: string[];
  actionType: MitmRouteActionType;
  targetOutboundOrGroup: string;
  headerKey?: string;
  headerValue?: string;
  rewriteReplacement?: string;
  statusCode?: number;
  note: string;
}

export interface MitmUrlTestEvaluation {
  matched: boolean;
  matchedRule?: MitmUrlRegexRule;
  capturedGroups: string[];
  effectiveOutbound: string;
  actionSummary: string;
}
