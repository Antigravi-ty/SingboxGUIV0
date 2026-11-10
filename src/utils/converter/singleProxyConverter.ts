import {
  ConvertedNodeMetadata,
  SingboxOutbound,
  SingboxTlsConfig,
  TlsSecurityPolicyMode,
} from "../../types/singbox";
import {
  convertMihomoPortHopRangeToSingbox,
  isIpLiteral,
  isKnownPrivateDohDomain,
  normalizeRealityPublicKey,
  normalizeRealityShortId,
  normalizeUuidForSingbox,
  parseMbpsValue,
} from "./mihomoNormalizers";
import {
  parseEchOptions,
  parseTransportOptions,
  resolveEffectiveInsecure,
} from "./mihomoTransportAndTls";

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
  const rawPin =
    proxy.fingerprint ||
    proxy["cert-sha256"] ||
    proxy.pinSHA256 ||
    proxy["certificate-public-key-sha256"] ||
    proxy.tls?.certificate_public_key_sha256;
  const certFingerprintPinValue = rawPin
    ? Array.isArray(rawPin)
      ? rawPin.map(String).join(",")
      : String(rawPin)
    : undefined;
  const hasCertFingerprintPin = Boolean(
    certFingerprintPinValue && certFingerprintPinValue.trim().length > 0
  );

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
  if (!isIpLiteral(serverAddr)) {
    if (subscriptionDnsResolverTag) {
      outbound.domain_resolver = subscriptionDnsResolverTag;
      domainResolverTag = subscriptionDnsResolverTag;
    } else if (isKnownPrivateDohDomain(serverAddr)) {
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
