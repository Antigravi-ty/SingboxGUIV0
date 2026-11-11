export type TlsSecurityPolicyMode =
  | "follow_source_with_warning"
  | "allow_quic_self_signed_only"
  | "enforce_strict_tls";

export type RunningMode = "stopped" | "normal" | "admin";

export type InboundProxyType = "Mixed" | "HTTP only" | "SOCKS5 only";

export interface SingboxEchConfig {
  enabled: boolean;
  config?: string[];
  query_server_name?: string;
}

export interface SingboxUtlsConfig {
  enabled: boolean;
  fingerprint: string;
}

export interface SingboxRealityConfig {
  enabled: boolean;
  public_key: string;
  short_id: string;
}

export interface SingboxTlsConfig {
  enabled: boolean;
  server_name?: string;
  insecure?: boolean;
  alpn?: string[];
  utls?: SingboxUtlsConfig;
  reality?: SingboxRealityConfig;
  ech?: SingboxEchConfig;
}

export interface SingboxTransportConfig {
  type: "ws" | "grpc" | "http" | "httpupgrade" | "quic";
  path?: string;
  headers?: Record<string, string>;
  service_name?: string;
  host?: string[];
  max_early_data?: number;
  early_data_header_name?: string;
}

export interface SingboxOutbound {
  type: string;
  tag: string;
  detour?: string;
  domain_resolver?: string;
  server?: string;
  server_port?: number;
  server_ports?: string[];
  hop_interval?: string;
  uuid?: string;
  password?: string;
  method?: string;
  security?: string;
  alter_id?: number;
  flow?: string;
  packet_encoding?: string;
  up_mbps?: number;
  down_mbps?: number;
  obfs?: {
    type: string;
    password: string;
  };
  congestion_control?: string;
  udp_relay_mode?: string;
  zero_rtt_handshake?: boolean;
  idle_session_check_interval?: string;
  idle_session_timeout?: string;
  min_idle_session?: number;
  outbounds?: string[];
  url?: string;
  interval?: string;
  tolerance?: number;
  idle_timeout?: string;
  tls?: SingboxTlsConfig;
  transport?: SingboxTransportConfig;
  [key: string]: unknown;
}

export interface SingboxDnsServer {
  tag: string;
  type: "udp" | "tcp" | "https" | "tls" | "quic" | "h3" | "local" | "rcode";
  server?: string;
  server_port?: number;
  path?: string;
  domain_resolver?: string;
  detour?: string;
}

export interface SingboxDnsRule {
  domain_suffix?: string[];
  domain?: string[];
  action: "route" | "reject";
  server?: string;
}

export interface SingboxRouteRule {
  auth_user?: string[];
  domain_suffix?: string[];
  ip_is_private?: boolean;
  protocol?: string;
  action: "route" | "hijack-dns" | "sniff" | "reject";
  outbound?: string;
}

export interface SingboxConfig {
  $schema: string;
  log: {
    level: string;
  };
  dns: {
    servers: SingboxDnsServer[];
    rules: SingboxDnsRule[];
  };
  inbounds: Array<{
    type: "mixed";
    tag: string;
    listen: string;
    listen_port: number;
    users: Array<{
      username: string;
      password: string;
    }>;
  }>;
  outbounds: SingboxOutbound[];
  route: {
    auto_detect_interface: boolean;
    default_domain_resolver: string;
    rules: SingboxRouteRule[];
    final: string;
  };
}

export interface ConvertedNodeMetadata {
  tag: string;
  providerPrefix: string;
  rawNodeName: string;
  protocol: string;
  server: string;
  port: number;
  portRange?: string[];
  tlsEnabled: boolean;
  sni?: string;
  sourceSkipCertVerify: boolean;
  effectiveInsecure: boolean;
  securityPolicyOverridden: boolean;
  hasReality: boolean;
  hasEch: boolean;
  hasCertFingerprintPin: boolean;
  certFingerprintPinValue?: string;
  domainResolverTag?: string;
  conversionNotes: string[];
  outbound: SingboxOutbound;
}

export interface ConversionSubscriptionSummary {
  subscriptionId: string;
  prefix: string;
  totalRawProxies: number;
  convertedCount: number;
  excludedByProtocol: Record<string, number>;
  insecureNodeCount: number;
  autoDetectedDnsTag?: string;
  autoDetectedDoHServer?: string;
}

export interface ConfigInspectSummary {
  config_dir: string;
  singbox_config_path: string;
  surge_config_path: string;
  total_outbounds: number;
  proxy_outbound_count: number;
  urltest_pool_count: number;
  socks_user_count: number;
  dns_server_count: number;
  listen_address: string;
  file_size_bytes: number;
  empty_workspace: boolean;
}

export type CoreProfileSlot = "stable" | "working";

export interface CoreSlotStatusInfo {
  profile: CoreProfileSlot | string;
  running: boolean;
  pid: number | null;
  config_path: string;
  surge_config_path: string;
  listen_address: string;
}

export interface SingboxCheckResult {
  valid: boolean;
  version: string;
  commandOutput: string;
  checkedAt: string;
  binaryFound?: boolean;
  binaryPath?: string;
  configDir?: string;
  singboxConfigPath?: string;
  stableConfigPath?: string;
  workingConfigPath?: string;
  surgeConfigPath?: string;
  summary?: ConfigInspectSummary;
  serviceReloaded?: boolean;
  emptyWorkspace?: boolean;
}

export interface BinaryStatusInfo {
  imported: boolean;
  binary_name: string | null;
  binary_path: string | null;
  managed_binary_path?: string | null;
  config_dir?: string | null;
  singbox_config_path?: string | null;
  surge_config_path?: string | null;
  file_size: number | null;
  version?: string | null;
  searched_paths?: string[];
}

export interface SingboxServiceStatus {
  running: boolean;
  pid: number | null;
  active_profile?: string;
  binary_path: string;
  config_path: string;
  stable_config_path?: string;
  working_config_path?: string;
  surge_config_path: string;
  config_dir: string;
  listen_address: string;
  message: string;
  recent_logs: string[];
  stable_slot?: CoreSlotStatusInfo;
  working_slot?: CoreSlotStatusInfo;
}

export type ConnectivityTestMethod =
  | "http_fetch"
  | "socks5_http"
  | "tcp_ping"
  | "icmp_ping";

export interface ConnectivityTestPresetTarget {
  id: string;
  label: string;
  category: "HTTP 204 / Trace" | "DNS / IP Anycast" | "Custom";
  target: string;
  recommendedMethod: ConnectivityTestMethod;
  description: string;
}

export interface ConnectivityTestResult {
  success: boolean;
  method: ConnectivityTestMethod | string;
  target: string;
  latency_ms: number;
  status_code: number | null;
  detail: string;
  testedAt: string;
}

export interface PortAvailabilityResult {
  port: number;
  host: string;
  occupied: boolean;
  available: boolean;
  message: string;
}

export interface UnexpectedExitPayload {
  pid: number;
  code: number | null;
  mode: string;
  message: string;
}

export interface ParsedLogEntry {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG" | "FATAL" | "UNKNOWN";
  source: string;
  message: string;
  raw: string;
}

