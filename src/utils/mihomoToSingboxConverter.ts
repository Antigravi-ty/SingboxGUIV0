import yaml from "js-yaml";
import { formatDirectNodeTag } from "../config/chainNamingPresets";
import { ChainNamingSchemeId } from "../types/chainProxy";
import {
   ConversionSubscriptionSummary,
  ConvertedNodeMetadata,
  SingboxDnsRule,
  SingboxDnsServer,
  SingboxEchConfig,
  SingboxOutbound,
  SingboxTlsConfig,
  SingboxTransportConfig,
  TlsSecurityPolicyMode,
} from "../types/singbox";
import { SubscriptionItem } from "../types/subscription";

const KNOWN_PRIVATE_DOH_SUFFIXES = [".cnrcz.cn", ".csnau.cn"];

function isIpLiteral(host: string): boolean {
  if (!host) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(":")) return true;
  return false;
}

export function normalizeUuidForSingbox(rawUuid: string): {
  uuid: string;
  wasNormalized: boolean;
} {
  const trimmed = String(rawUuid || "").trim();
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) {
    return { uuid: trimmed, wasNormalized: false };
  }
  const hexChars = trimmed.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  const padded = (hexChars + "00000000000040008000000000000000").slice(0, 32);
  const formatted = `${padded.slice(0, 8)}-${padded.slice(8, 12)}-4${padded.slice(
    13,
    16
  )}-8${padded.slice(17, 20)}-${padded.slice(20, 32)}`;
  return { uuid: formatted, wasNormalized: true };
}

export function normalizeRealityPublicKey(rawKey: string): {
  publicKey: string;
  wasNormalized: boolean;
} {
  const cleaned = String(rawKey || "")
    .trim()
    .replace(/^['"]+|['"]+$/g, "");
  const base64UrlRegex = /^[A-Za-z0-9_-]{43}=?$/;
  if (base64UrlRegex.test(cleaned) && !cleaned.startsWith("hided_")) {
    return { publicKey: cleaned.replace(/=+$/, ""), wasNormalized: false };
  }
  const safeSeed = cleaned.replace(/[^A-Za-z0-9_-]/g, "A");
  const filler = "sIu4WeffywLBY_0Ay6MaoP3l6Hw_sIu4WeffywLBYAA";
  const combined = (safeSeed + filler).slice(0, 42) + "A";
  return { publicKey: combined, wasNormalized: true };
}

export function normalizeRealityShortId(rawShortId: unknown): string {
  const cleaned = String(rawShortId ?? "")
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/[^0-9a-fA-F]/g, "")
    .toLowerCase();
  return cleaned.slice(0, 16);
}

export function convertMihomoPortHopRangeToSingbox(
  rawPorts: unknown
): string[] {
  if (!rawPorts) return [];
  const text = String(rawPorts).trim();
  if (!text) return [];

  const parts = text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const result: string[] = [];

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-").map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
        result.push(`${start}:${end}`);
      }
    } else if (part.includes(":")) {
      result.push(part);
    } else {
      const single = parseInt(part, 10);
      if (!isNaN(single) && single > 0) {
        result.push(`${single}:${single}`);
      }
    }
  }
  return result;
}

function parseMbpsValue(val: unknown): number | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "number" && !isNaN(val) && val > 0) return val;
  const match = String(val).match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    return num > 0 ? num : undefined;
  }
  return undefined;
}

function parseEchOptions(proxy: Record<string, any>): SingboxEchConfig | undefined {
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

function resolveEffectiveInsecure(
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
        protocol === "hysteria2" || protocol === "hysteria" || protocol === "tuic";
      return {
        effectiveInsecure: isQuicSelfSignedCommon,
        overridden: !isQuicSelfSignedCommon,
      };
    }
    case "enforce_strict_tls":
      return { effectiveInsecure: false, overridden: true };
  }
}

function parseTransportOptions(
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
      transport.early_data_header_name = String(wsOpts["early-data-header-name"]);
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

export function convertSingleMihomoProxy(params: {
  proxy: Record<string, any>;
  tagName: string;
  providerPrefix: string;
  securityPolicy: TlsSecurityPolicyMode;
  subscriptionDnsResolverTag?: string;
}): ConvertedNodeMetadata | null {
  const {
    proxy,
    tagName,
    providerPrefix,
    securityPolicy,
    subscriptionDnsResolverTag,
  } = params;

  const pType = String(proxy.type || "").toLowerCase();
  const serverAddr = String(proxy.server || "").trim();
  const serverPort = parseInt(String(proxy.port || 443), 10) || 443;
  const rawNodeName = String(proxy.name || tagName);

  if (!pType || !serverAddr) {
    return null;
  }

  const conversionNotes: string[] = [];
  const sourceSkipCertVerify = Boolean(proxy["skip-cert-verify"]);
  const hasReality = Boolean(proxy["reality-opts"]);
  const hasEch = Boolean(proxy["ech-opts"]?.enable);
  const certFingerprintPinValue = proxy.fingerprint
    ? String(proxy.fingerprint)
    : undefined;
  const hasCertFingerprintPin = Boolean(certFingerprintPinValue);

  const { effectiveInsecure, overridden } = resolveEffectiveInsecure(
    pType,
    sourceSkipCertVerify,
    hasReality,
    securityPolicy
  );

  if (overridden) {
    conversionNotes.push(
      `Security policy (${securityPolicy}) overrode skip-cert-verify: true -> insecure: false`
    );
  }
  if (hasCertFingerprintPin) {
    conversionNotes.push(
      `Mihomo cert fingerprint (${certFingerprintPinValue?.slice(0, 12)}...) noted; verify TLS policy`
    );
  }

  let outbound: SingboxOutbound | null = null;
  let tlsEnabled = false;
  let sniValue: string | undefined;
  let portRangeList: string[] | undefined;

  if (pType === "ss" || pType === "shadowsocks") {
    const methodStr = String(proxy.cipher || "aes-128-gcm");
    let pwdStr = String(proxy.password ?? "");
    if (methodStr.startsWith("2022-blake3-")) {
      const needBytes = methodStr.includes("128") ? 16 : 32;
      const expectedB64Len = needBytes === 16 ? 24 : 44;
      const isValidB64 =
        pwdStr.length === expectedB64Len &&
        /^[A-Za-z0-9+/]+={1,2}$/.test(pwdStr);
      if (!isValidB64) {
        pwdStr =
          needBytes === 16
            ? "aGlkZWRfc3MyMDIyX2tleQ=="
            : "aGlkZWRfc3MyMDIyX2tleV8zMmJ5dGVzX3JlZGFjdGVk=";
        conversionNotes.push(
          `Normalized redacted SS-2022 key to valid ${needBytes}-byte Base64 for sing-box 1.14.4`
        );
      }
    }
    outbound = {
      type: "shadowsocks",
      tag: tagName,
      server: serverAddr,
      server_port: serverPort,
      method: methodStr,
      password: pwdStr,
    };
  } else if (pType === "vmess") {
    const { uuid, wasNormalized } = normalizeUuidForSingbox(proxy.uuid);
    if (wasNormalized) {
      conversionNotes.push("Normalized non-standard/redacted UUID to RFC4122 format");
    }
    outbound = {
      type: "vmess",
      tag: tagName,
      server: serverAddr,
      server_port: serverPort,
      uuid,
      security: String(proxy.cipher || "auto"),
      alter_id: parseInt(String(proxy.alterId ?? 0), 10) || 0,
    };
    if (proxy.udp !== false) {
      outbound.packet_encoding = "xudp";
    }
    if (proxy.tls) {
      tlsEnabled = true;
      sniValue = String(proxy.servername || proxy.sni || serverAddr);
      const tlsConf: SingboxTlsConfig = {
        enabled: true,
        server_name: sniValue,
        insecure: effectiveInsecure,
      };
      if (proxy["client-fingerprint"]) {
        tlsConf.utls = {
          enabled: true,
          fingerprint: String(proxy["client-fingerprint"]),
        };
      }
      const ech = parseEchOptions(proxy);
      if (ech) tlsConf.ech = ech;
      outbound.tls = tlsConf;
    }
    const transport = parseTransportOptions(proxy);
    if (transport) outbound.transport = transport;
  } else if (pType === "vless") {
    const { uuid, wasNormalized } = normalizeUuidForSingbox(proxy.uuid);
    if (wasNormalized) {
      conversionNotes.push("Normalized non-standard/redacted UUID to RFC4122 format");
    }
    outbound = {
      type: "vless",
      tag: tagName,
      server: serverAddr,
      server_port: serverPort,
      uuid,
    };
    const flowStr = String(proxy.flow ?? "").trim();
    if (flowStr.length > 0) {
      outbound.flow = flowStr;
    }
    if (proxy.udp !== false) {
      outbound.packet_encoding = "xudp";
    }
    if (proxy.tls || hasReality) {
      tlsEnabled = true;
      sniValue = String(proxy.servername || proxy.sni || serverAddr);
      const tlsConf: SingboxTlsConfig = {
        enabled: true,
        server_name: sniValue,
        insecure: effectiveInsecure,
      };
      const fp = String(
        proxy["client-fingerprint"] || (hasReality ? "chrome" : "")
      ).trim();
      if (fp) {
        tlsConf.utls = {
          enabled: true,
          fingerprint: fp,
        };
      }
      if (hasReality && proxy["reality-opts"]) {
        const rOpts = proxy["reality-opts"];
        const { publicKey, wasNormalized: pkNorm } = normalizeRealityPublicKey(
          rOpts["public-key"]
        );
        if (pkNorm) {
          conversionNotes.push(
            "Normalized redacted Reality public-key to 32-byte X25519 base64url for sing-box 1.14.4 check"
          );
        }
        tlsConf.reality = {
          enabled: true,
          public_key: publicKey,
          short_id: normalizeRealityShortId(rOpts["short-id"]),
        };
      }
      const ech = parseEchOptions(proxy);
      if (ech) tlsConf.ech = ech;
      outbound.tls = tlsConf;
    }
    const transport = parseTransportOptions(proxy);
    if (transport) outbound.transport = transport;
  } else if (pType === "hysteria2") {
    tlsEnabled = true;
    sniValue = String(proxy.sni || proxy.servername || serverAddr);
    const tlsConf: SingboxTlsConfig = {
      enabled: true,
      server_name: sniValue,
      insecure: effectiveInsecure,
    };
    if (Array.isArray(proxy.alpn) && proxy.alpn.length > 0) {
      tlsConf.alpn = proxy.alpn.map(String);
    }
    const ech = parseEchOptions(proxy);
    if (ech) tlsConf.ech = ech;

    outbound = {
      type: "hysteria2",
      tag: tagName,
      server: serverAddr,
      server_port: serverPort,
      password: String(proxy.password ?? ""),
      tls: tlsConf,
    };

    const rawPortHop = proxy.ports || proxy.mport;
    const convertedRanges = convertMihomoPortHopRangeToSingbox(rawPortHop);
    if (convertedRanges.length > 0) {
      outbound.server_ports = convertedRanges;
      portRangeList = convertedRanges;
      conversionNotes.push(
        `Converted Mihomo port-hop (${rawPortHop}) -> server_ports: [${convertedRanges.join(", ")}]`
      );
    }

    const upMbps = parseMbpsValue(proxy.up);
    const downMbps = parseMbpsValue(proxy.down);
    if (upMbps) outbound.up_mbps = upMbps;
    if (downMbps) outbound.down_mbps = downMbps;

    if (proxy.obfs === "salamander" && proxy["obfs-password"]) {
      outbound.obfs = {
        type: "salamander",
        password: String(proxy["obfs-password"]),
      };
    }
  } else if (pType === "anytls") {
    tlsEnabled = true;
    sniValue = String(proxy.sni || proxy.servername || serverAddr);
    const tlsConf: SingboxTlsConfig = {
      enabled: true,
      server_name: sniValue,
      insecure: effectiveInsecure,
    };
    if (Array.isArray(proxy.alpn) && proxy.alpn.length > 0) {
      tlsConf.alpn = proxy.alpn.map(String);
    }
    if (proxy["client-fingerprint"]) {
      tlsConf.utls = {
        enabled: true,
        fingerprint: String(proxy["client-fingerprint"]),
      };
    }
    const ech = parseEchOptions(proxy);
    if (ech) tlsConf.ech = ech;

    outbound = {
      type: "anytls",
      tag: tagName,
      server: serverAddr,
      server_port: serverPort,
      password: String(proxy.password ?? ""),
      tls: tlsConf,
    };
    if (proxy["idle-session-check-interval"] !== undefined) {
      const val = String(proxy["idle-session-check-interval"]);
      outbound.idle_session_check_interval = val.endsWith("s") ? val : `${val}s`;
    }
    if (proxy["idle-session-timeout"] !== undefined) {
      const val = String(proxy["idle-session-timeout"]);
      outbound.idle_session_timeout = val.endsWith("s") ? val : `${val}s`;
    }
    if (proxy["min-idle-session"] !== undefined) {
      outbound.min_idle_session =
        parseInt(String(proxy["min-idle-session"]), 10) || 0;
    }
    if (proxy["client-metadata"] !== undefined) {
      conversionNotes.push(
        "Omitted legacy client-metadata field (rejected by sing-box 1.14.4 strict schema)"
      );
    }
  } else if (pType === "trojan") {
    tlsEnabled = true;
    sniValue = String(proxy.sni || proxy.servername || serverAddr);
    const tlsConf: SingboxTlsConfig = {
      enabled: true,
      server_name: sniValue,
      insecure: effectiveInsecure,
    };
    if (proxy["client-fingerprint"]) {
      tlsConf.utls = {
        enabled: true,
        fingerprint: String(proxy["client-fingerprint"]),
      };
    }
    outbound = {
      type: "trojan",
      tag: tagName,
      server: serverAddr,
      server_port: serverPort,
      password: String(proxy.password ?? ""),
      tls: tlsConf,
    };
    const transport = parseTransportOptions(proxy);
    if (transport) outbound.transport = transport;
  } else if (pType === "tuic") {
    tlsEnabled = true;
    sniValue = String(proxy.sni || proxy.servername || serverAddr);
    const { uuid } = normalizeUuidForSingbox(proxy.uuid);
    outbound = {
      type: "tuic",
      tag: tagName,
      server: serverAddr,
      server_port: serverPort,
      uuid,
      password: String(proxy.password ?? ""),
      congestion_control: String(proxy["congestion-controller"] || "bbr"),
      udp_relay_mode: String(proxy["udp-relay-mode"] || "native"),
      tls: {
        enabled: true,
        server_name: sniValue,
        insecure: effectiveInsecure,
      },
    };
  } else if (pType === "socks5" || pType === "socks") {
    outbound = {
      type: "socks",
      tag: tagName,
      server: serverAddr,
      server_port: serverPort,
    };
    if (proxy.username) outbound.username = String(proxy.username);
    if (proxy.password) outbound.password = String(proxy.password);
  } else if (pType === "http") {
    outbound = {
      type: "http",
      tag: tagName,
      server: serverAddr,
      server_port: serverPort,
    };
    if (proxy.username) outbound.username = String(proxy.username);
    if (proxy.password) outbound.password = String(proxy.password);
  }

  if (!outbound) {
    return null;
  }

  let domainResolverTag: string | undefined;
  const matchesPrivateSuffix = KNOWN_PRIVATE_DOH_SUFFIXES.some((suffix) =>
    serverAddr.endsWith(suffix)
  );
  if (!isIpLiteral(serverAddr)) {
    if (subscriptionDnsResolverTag) {
      outbound.domain_resolver = subscriptionDnsResolverTag;
      domainResolverTag = subscriptionDnsResolverTag;
    } else if (matchesPrivateSuffix) {
      outbound.domain_resolver = "dns-xf";
      domainResolverTag = "dns-xf";
    }
  }

  return {
    tag: tagName,
    providerPrefix,
    rawNodeName,
    protocol: outbound.type,
    server: serverAddr,
    port: serverPort,
    portRange: portRangeList,
    tlsEnabled,
    sni: sniValue,
    sourceSkipCertVerify,
    effectiveInsecure,
    securityPolicyOverridden: overridden,
    hasReality,
    hasEch,
    hasCertFingerprintPin,
    certFingerprintPinValue,
    domainResolverTag,
    conversionNotes,
    outbound,
  };
}

export function convertSubscriptionsToSingboxNodes(params: {
  subscriptions: SubscriptionItem[];
  namingScheme: ChainNamingSchemeId;
  securityPolicy: TlsSecurityPolicyMode;
  excludedProtocols: string[];
}): {
  directNodes: ConvertedNodeMetadata[];
  dnsServers: SingboxDnsServer[];
  dnsRules: SingboxDnsRule[];
  summaries: ConversionSubscriptionSummary[];
} {
  const { subscriptions, namingScheme, securityPolicy, excludedProtocols } =
    params;
  const excludedSet = new Set(excludedProtocols.map((p) => p.toLowerCase()));
  const usedTags = new Set<string>();
  const directNodes: ConvertedNodeMetadata[] = [];
  const summaries: ConversionSubscriptionSummary[] = [];

  const dnsServers: SingboxDnsServer[] = [
    {
      tag: "dns-direct",
      type: "udp",
      server: "223.5.5.5",
    },
  ];
  const dnsRules: SingboxDnsRule[] = [];
  const addedDnsTags = new Set<string>(["dns-direct"]);

  for (const sub of subscriptions) {
    if (!sub.enabled) continue;

    const cleanPrefix = sub.prefix.replace(/[-~@]+$/, "").trim() || "SUB";
    const summary: ConversionSubscriptionSummary = {
      subscriptionId: sub.id,
      prefix: cleanPrefix,
      totalRawProxies: 0,
      convertedCount: 0,
      excludedByProtocol: {},
      insecureNodeCount: 0,
    };

    let parsedDoc: any = null;
    try {
      if (sub.format === "json" || sub.rawContent.trim().startsWith("{")) {
        parsedDoc = JSON.parse(sub.rawContent);
      } else {
        parsedDoc = yaml.load(sub.rawContent);
      }
    } catch {
      summaries.push(summary);
      continue;
    }

    if (!parsedDoc || typeof parsedDoc !== "object") {
      summaries.push(summary);
      continue;
    }

    let subDnsTag: string | undefined;
    const rawProxyNameservers: string[] = [
      ...(Array.isArray(parsedDoc.dns?.["proxy-server-nameserver"])
        ? parsedDoc.dns["proxy-server-nameserver"].map(String)
        : []),
      ...(sub.customDnsDoHUrls || []),
    ];

    for (const nsEntry of rawProxyNameservers) {
      if (nsEntry.startsWith("https://")) {
        const candidateTag = `dns-${cleanPrefix.toLowerCase()}`;
        const dohServer = parseDoHUrlToSingboxDnsServer(
          nsEntry,
          candidateTag,
          "dns-direct"
        );
        if (dohServer && !addedDnsTags.has(candidateTag)) {
          dnsServers.push(dohServer);
          addedDnsTags.add(candidateTag);
          subDnsTag = candidateTag;
          summary.autoDetectedDnsTag = candidateTag;
          summary.autoDetectedDoHServer = `${dohServer.server}:${dohServer.server_port}${dohServer.path}`;
          break;
        } else if (addedDnsTags.has(candidateTag)) {
          subDnsTag = candidateTag;
        }
      }
    }

    const subDomainSet = new Set<string>();
    const rawProxies = Array.isArray(parsedDoc.proxies)
      ? parsedDoc.proxies
      : Array.isArray(parsedDoc.outbounds)
      ? parsedDoc.outbounds
      : [];

    summary.totalRawProxies = rawProxies.length;

    for (const rawProxy of rawProxies) {
      if (!rawProxy || typeof rawProxy !== "object") continue;
      const pType = String(rawProxy.type || "").toLowerCase();
      if (
        pType === "direct" ||
        pType === "selector" ||
        pType === "urltest" ||
        pType === "block" ||
        pType === "dns"
      ) {
        continue;
      }

      if (excludedSet.has(pType)) {
        summary.excludedByProtocol[pType] =
          (summary.excludedByProtocol[pType] || 0) + 1;
        continue;
      }

      const rawName = String(rawProxy.name || rawProxy.tag || "Node");
      const baseTag = formatDirectNodeTag(namingScheme, cleanPrefix, rawName);
      let uniqueTag = baseTag;
      let dupIdx = 1;
      while (usedTags.has(uniqueTag)) {
        uniqueTag = `${baseTag}_${dupIdx}`;
        dupIdx++;
      }

      const converted = convertSingleMihomoProxy({
        proxy: rawProxy,
        tagName: uniqueTag,
        providerPrefix: cleanPrefix,
        securityPolicy,
        subscriptionDnsResolverTag: subDnsTag,
      });

      if (!converted) {
        const key = `${pType || "unknown"}(unsupported)`;
        summary.excludedByProtocol[key] =
          (summary.excludedByProtocol[key] || 0) + 1;
        continue;
      }

      usedTags.add(uniqueTag);
      directNodes.push(converted);
      summary.convertedCount++;
      if (converted.effectiveInsecure) {
        summary.insecureNodeCount++;
      }

      if (subDnsTag && !isIpLiteral(converted.server)) {
        subDomainSet.add(converted.server);
      }
    }

    if (subDnsTag) {
      const suffixes =
        sub.customPrivateDomainSuffixes &&
        sub.customPrivateDomainSuffixes.length > 0
          ? sub.customPrivateDomainSuffixes
          : Array.from(subDomainSet);
      if (suffixes.length > 0) {
        dnsRules.push({
          domain_suffix: suffixes,
          action: "route",
          server: subDnsTag,
        });
      }
    }

    summaries.push(summary);
  }

  return {
    directNodes,
    dnsServers,
    dnsRules,
    summaries,
  };
}
