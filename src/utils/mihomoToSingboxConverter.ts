import yaml from "js-yaml";
import { formatDirectNodeTag } from "../config/chainNamingPresets";
import { ChainNamingSchemeId } from "../types/chainProxy";
import {
  ConversionSubscriptionSummary,
  ConvertedNodeMetadata,
  SingboxDnsRule,
  SingboxDnsServer,
  TlsSecurityPolicyMode,
} from "../types/singbox";
import { SubscriptionItem } from "../types/subscription";
import {
  convertMihomoPortHopRangeToSingbox,
  isIpLiteral,
  normalizeRealityPublicKey,
  normalizeRealityShortId,
  normalizeUuidForSingbox,
} from "./converter/mihomoNormalizers";
import { parseDoHUrlToSingboxDnsServer } from "./converter/mihomoTransportAndTls";
import { convertSingleMihomoProxy } from "./converter/singleProxyConverter";

export {
  convertMihomoPortHopRangeToSingbox,
  convertSingleMihomoProxy,
  normalizeRealityPublicKey,
  normalizeRealityShortId,
  normalizeUuidForSingbox,
  parseDoHUrlToSingboxDnsServer,
};

function tryDecodeBase64Utf8(input: string): string | null {
  const cleaned = input.replace(/\s+/g, "");
  if (cleaned.length < 16 || !/^[A-Za-z0-9+/=_-]+$/.test(cleaned)) {
    return null;
  }
  try {
    const normalized = cleaned.replace(/-/g, "+").replace(/_/g, "/");
    const padded =
      normalized.length % 4 === 0
        ? normalized
        : normalized + "=".repeat(4 - (normalized.length % 4));
    const binStr = atob(padded);
    const bytes = Uint8Array.from(binStr, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

function parseShareUriLine(line: string, index: number): Record<string, any> | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return null;

  if (trimmed.startsWith("vmess://")) {
    const b64 = trimmed.slice("vmess://".length).split("#")[0];
    const decoded = tryDecodeBase64Utf8(b64);
    if (decoded) {
      try {
        const obj = JSON.parse(decoded);
        return {
          name: String(obj.ps || obj.remarks || `VMess-${index + 1}`),
          type: "vmess",
          server: String(obj.add || obj.host || ""),
          port: Number(obj.port || 443),
          uuid: String(obj.id || ""),
          alterId: Number(obj.aid || 0),
          cipher: String(obj.scy || "auto"),
          tls: obj.tls === "tls" || obj.tls === true,
          servername: String(obj.sni || obj.host || ""),
          network: String(obj.net || "tcp"),
          "ws-opts":
            obj.net === "ws"
              ? {
                  path: String(obj.path || "/"),
                  headers: obj.host ? { Host: String(obj.host) } : undefined,
                }
              : undefined,
        };
      } catch {
        return null;
      }
    }
  }

  const schemeMatch = trimmed.match(
    /^(vless|trojan|ss|hysteria2|hy2|tuic|anytls|socks5):\/\/(.+)$/i
  );
  if (!schemeMatch) return null;

  try {
    const urlObj = new URL(trimmed);
    const proto = schemeMatch[1].toLowerCase();
    const name = decodeURIComponent(urlObj.hash.replace(/^#/, "")) || `${proto.toUpperCase()}-${index + 1}`;
    const server = urlObj.hostname.replace(/^\[|\]$/g, "");
    const port = Number(urlObj.port || 443);
    const params = urlObj.searchParams;
    const sni = params.get("sni") || params.get("peer") || server;
    const insecure =
      params.get("allowInsecure") === "1" ||
      params.get("allowInsecure") === "true" ||
      params.get("insecure") === "1" ||
      params.get("insecure") === "true";

    if (proto === "vless") {
      return {
        name,
        type: "vless",
        server,
        port,
        uuid: decodeURIComponent(urlObj.username),
        tls: params.get("security") === "tls" || params.get("security") === "reality",
        servername: sni,
        flow: params.get("flow") || undefined,
        network: params.get("type") || "tcp",
        "skip-cert-verify": insecure,
        "client-fingerprint": params.get("fp") || "chrome",
        "reality-opts":
          params.get("security") === "reality"
            ? {
                "public-key": params.get("pbk") || "",
                "short-id": params.get("sid") || "",
              }
            : undefined,
      };
    }

    if (proto === "trojan") {
      return {
        name,
        type: "trojan",
        server,
        port,
        password: decodeURIComponent(urlObj.username),
        sni,
        "skip-cert-verify": insecure,
        network: params.get("type") || "tcp",
      };
    }

    if (proto === "hysteria2" || proto === "hy2") {
      return {
        name,
        type: "hysteria2",
        server,
        port,
        password: decodeURIComponent(
          urlObj.username + (urlObj.password ? `:${urlObj.password}` : "")
        ),
        sni,
        "skip-cert-verify": insecure,
        ports: params.get("mport") || undefined,
        obfs: params.get("obfs") || undefined,
        "obfs-password": params.get("obfs-password") || undefined,
      };
    }

    if (proto === "tuic") {
      return {
        name,
        type: "tuic",
        server,
        port,
        uuid: decodeURIComponent(urlObj.username),
        password: decodeURIComponent(urlObj.password || ""),
        sni,
        "skip-cert-verify": insecure,
        "congestion-controller": params.get("congestion_control") || "bbr",
      };
    }

    if (proto === "anytls") {
      return {
        name,
        type: "anytls",
        server,
        port,
        password: decodeURIComponent(urlObj.username),
        sni,
        "skip-cert-verify": insecure,
      };
    }

    if (proto === "ss") {
      let method = "aes-256-gcm";
      let password = "";
      const userPart = decodeURIComponent(urlObj.username);
      const decodedUser = tryDecodeBase64Utf8(userPart);
      const credStr =
        decodedUser && decodedUser.includes(":")
          ? decodedUser
          : urlObj.password
          ? `${userPart}:${decodeURIComponent(urlObj.password)}`
          : userPart;
      const colonIdx = credStr.indexOf(":");
      if (colonIdx > 0) {
        method = credStr.slice(0, colonIdx);
        password = credStr.slice(colonIdx + 1);
      }
      return {
        name,
        type: "ss",
        server,
        port,
        cipher: method,
        password,
      };
    }

    if (proto === "socks5") {
      return {
        name,
        type: "socks5",
        server,
        port,
        username: decodeURIComponent(urlObj.username || ""),
        password: decodeURIComponent(urlObj.password || ""),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function parseSubscriptionRawContentToDoc(rawContent: string): any | null {
  const trimmed = (rawContent || "").trim();
  if (!trimmed) return null;

  // Reject HTML error/login pages immediately
  if (
    /^<!doctype\s+html/i.test(trimmed) ||
    /^<html[\s>]/i.test(trimmed)
  ) {
    return null;
  }

  // 1. Try JSON
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
  }

  // 2. Try YAML if it contains proxies: or outbounds:
  try {
    const loaded = yaml.load(trimmed);
    if (loaded && typeof loaded === "object") {
      return loaded;
    }
  } catch {}

  // 3. Try Base64 decode -> YAML / JSON / Share URIs
  const decoded = tryDecodeBase64Utf8(trimmed);
  const textToScan = decoded || trimmed;

  if (decoded) {
    try {
      const loaded = yaml.load(decoded);
      if (loaded && typeof loaded === "object") {
        return loaded;
      }
    } catch {}
  }

  // 4. Try line-by-line share URIs (vless://, vmess://, trojan://, hysteria2://, ss://, etc.)
  const lines = textToScan.split(/\r?\n/);
  const shareProxies: Record<string, any>[] = [];
  lines.forEach((line, idx) => {
    const parsedUri = parseShareUriLine(line, idx);
    if (parsedUri && parsedUri.server) {
      shareProxies.push(parsedUri);
    }
  });
  if (shareProxies.length > 0) {
    return { proxies: shareProxies };
  }

  return null;
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

    const parsedDoc = parseSubscriptionRawContentToDoc(sub.rawContent);
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
