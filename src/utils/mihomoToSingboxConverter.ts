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
