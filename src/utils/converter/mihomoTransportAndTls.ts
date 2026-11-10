import {
  SingboxDnsServer,
  SingboxEchConfig,
  SingboxTransportConfig,
  TlsSecurityPolicyMode,
} from "../../types/singbox";

export function parseEchOptions(
  proxy: Record<string, any>
): SingboxEchConfig | undefined {
  const echOpts = proxy["ech-opts"];
  if (!echOpts || typeof echOpts !== "object" || !echOpts.enable) {
    return undefined;
  }
  const echConf: SingboxEchConfig = { enabled: true };
  if (echOpts.config) {
    const rawConfig = String(echOpts.config).trim();
    if (rawConfig) {
      if (!rawConfig.includes("BEGIN ECH CONFIGS")) {
        echConf.config = [
          "-----BEGIN ECH CONFIGS-----",
          rawConfig,
          "-----END ECH CONFIGS-----",
        ];
      } else {
        echConf.config = rawConfig.split(/\r?\n/);
      }
    }
  }
  if (echOpts["query-server-name"]) {
    echConf.query_server_name = String(echOpts["query-server-name"]);
  }
  return echConf;
}

export function resolveEffectiveInsecure(
  protocol: string,
  sourceSkipCertVerify: boolean,
  hasReality: boolean,
  policyMode: TlsSecurityPolicyMode
): { effectiveInsecure: boolean; overridden: boolean } {
  if (hasReality) {
    return {
      effectiveInsecure: false,
      overridden: sourceSkipCertVerify === true,
    };
  }
  if (!sourceSkipCertVerify) {
    return { effectiveInsecure: false, overridden: false };
  }
  switch (policyMode) {
    case "follow_source_with_warning":
      return { effectiveInsecure: true, overridden: false };
    case "allow_quic_self_signed_only": {
      const isQuicSelfSignedCommon =
        protocol === "hysteria2" ||
        protocol === "hysteria" ||
        protocol === "tuic";
      return {
        effectiveInsecure: isQuicSelfSignedCommon,
        overridden: !isQuicSelfSignedCommon,
      };
    }
    case "enforce_strict_tls":
      return { effectiveInsecure: false, overridden: true };
  }
}

export function parseTransportOptions(
  proxy: Record<string, any>
): SingboxTransportConfig | undefined {
  const net = String(proxy.network || "tcp").toLowerCase();
  if (net === "ws") {
    const wsOpts = proxy["ws-opts"] || {};
    const headers: Record<string, string> = {};
    if (wsOpts.headers && typeof wsOpts.headers === "object") {
      for (const [k, v] of Object.entries(wsOpts.headers)) {
        headers[k] = String(v);
      }
    }
    const transport: SingboxTransportConfig = {
      type: "ws",
      path: String(wsOpts.path || "/"),
    };
    if (Object.keys(headers).length > 0) {
      transport.headers = headers;
    }
    if (typeof wsOpts["max-early-data"] === "number") {
      transport.max_early_data = wsOpts["max-early-data"];
    }
    if (wsOpts["early-data-header-name"]) {
      transport.early_data_header_name = String(
        wsOpts["early-data-header-name"]
      );
    }
    return transport;
  }
  if (net === "grpc") {
    const grpcOpts = proxy["grpc-opts"] || {};
    return {
      type: "grpc",
      service_name: String(grpcOpts["grpc-service-name"] || ""),
    };
  }
  if (net === "http" || net === "h2") {
    const httpOpts = proxy["http-opts"] || proxy["h2-opts"] || {};
    const hostVal = httpOpts.host;
    return {
      type: "http",
      path: Array.isArray(httpOpts.path)
        ? String(httpOpts.path[0] || "/")
        : String(httpOpts.path || "/"),
      host: Array.isArray(hostVal)
        ? hostVal.map(String)
        : hostVal
        ? [String(hostVal)]
        : undefined,
    };
  }
  return undefined;
}

export function parseDoHUrlToSingboxDnsServer(
  rawUrl: string,
  tag: string,
  bootstrapResolverTag = "dns-direct"
): SingboxDnsServer | null {
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith("https://")) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    const serverPort = parsed.port ? parseInt(parsed.port, 10) : 443;
    const path = `${parsed.pathname || "/dns-query"}${parsed.search || ""}`;
    return {
      tag,
      type: "https",
      server: parsed.hostname,
      server_port: serverPort,
      path,
      domain_resolver: bootstrapResolverTag,
    };
  } catch {
    return null;
  }
}
