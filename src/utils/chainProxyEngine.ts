import { formatChainNodeTag } from "../config/chainNamingPresets";
import { PROVIDER_COLOR_MAP } from "../config/defaultSubscriptions";
import {
  ChainLinkRule,
  ChainNamingSchemeId,
  GeneratedProxyEndpoint,
  TopologyProviderNode,
  TopologyVisualEdge,
} from "../types/chainProxy";
import {
  ConvertedNodeMetadata,
  SingboxConfig,
  SingboxDnsRule,
  SingboxDnsServer,
  SingboxOutbound,
  SingboxRouteRule,
} from "../types/singbox";

function safeRegexMatch(pattern: string, target: string): boolean {
  const trimmed = pattern.trim();
  if (!trimmed || trimmed === "*" || trimmed === ".*") {
    return true;
  }
  try {
    const regex = new RegExp(trimmed, "i");
    return regex.test(target);
  } catch {
    return target.toLowerCase().includes(trimmed.toLowerCase());
  }
}

function cloneOutboundWithDetour(
  baseOutbound: SingboxOutbound,
  newTag: string,
  detourTag: string
): SingboxOutbound {
  const cloned = JSON.parse(JSON.stringify(baseOutbound)) as SingboxOutbound;
  cloned.tag = newTag;
  cloned.detour = detourTag;
  return cloned;
}

export function buildSingboxAndSurgePipeline(params: {
  directNodes: ConvertedNodeMetadata[];
  dnsServers: SingboxDnsServer[];
  dnsRules: SingboxDnsRule[];
  chainRules: ChainLinkRule[];
  namingScheme: ChainNamingSchemeId;
  listenIp: string;
  listenPort: number;
  logLevel: string;
  autoDetectInterface: boolean;
  includeSurgeProxyGroups: boolean;
}): {
  singboxConfig: SingboxConfig;
  surgeConfigText: string;
  endpoints: GeneratedProxyEndpoint[];
  providerNodes: TopologyProviderNode[];
  visualEdges: TopologyVisualEdge[];
} {
  const {
    directNodes,
    dnsServers,
    dnsRules,
    chainRules,
    namingScheme,
    listenIp,
    listenPort,
    logLevel,
    autoDetectInterface,
    includeSurgeProxyGroups,
  } = params;

  const endpoints: GeneratedProxyEndpoint[] = [];
  const allOutbounds: SingboxOutbound[] = [
    { type: "direct", tag: "direct" },
  ];
  const usedTags = new Set<string>(["direct"]);

  const byPrefix = new Map<string, ConvertedNodeMetadata[]>();
  for (const node of directNodes) {
    const list = byPrefix.get(node.providerPrefix) || [];
    list.push(node);
    byPrefix.set(node.providerPrefix, list);
  }

  let counter = 0;
  const formatUsername = (idx: number) =>
    idx < 1000 ? String(idx).padStart(3, "0") : String(idx);

  for (const node of directNodes) {
    if (counter >= 999) break;
    const username = formatUsername(counter);
    const password = "0";
    counter++;

    usedTags.add(node.tag);
    allOutbounds.push(node.outbound);

    const surgeLine = `${node.tag} = socks5, ${listenIp}, ${listenPort}, username=${username}, password=${password}`;
    endpoints.push({
      index: counter - 1,
      username,
      password,
      finalTag: node.tag,
      surgeProxyLine: surgeLine,
      hopCount: 0,
      isSelfHop: false,
      entryPrefix: node.providerPrefix,
      exitPrefix: node.providerPrefix,
      hopTags: [node.tag],
      protocolChain: [node.protocol],
      outbound: node.outbound,
    });
  }

  const visualEdges: TopologyVisualEdge[] = [];

  for (const rule of chainRules) {
    const entryCandidates = (byPrefix.get(rule.entryPrefix) || []).filter((n) =>
      safeRegexMatch(rule.entryNodeFilterRegex, `${n.rawNodeName} ${n.tag}`)
    );
    const exitCandidates = (byPrefix.get(rule.exitPrefix) || []).filter((n) =>
      safeRegexMatch(rule.exitNodeFilterRegex, `${n.rawNodeName} ${n.tag}`)
    );
    const middleCandidates =
      rule.hopCount === 2 && rule.middlePrefix
        ? (byPrefix.get(rule.middlePrefix) || []).filter((n) =>
            safeRegexMatch(
              rule.middleNodeFilterRegex || ".*",
              `${n.rawNodeName} ${n.tag}`
            )
          )
        : [];

    const isSelfHop =
      rule.hopCount === 1 && rule.entryPrefix === rule.exitPrefix;
    const edgeColor =
      PROVIDER_COLOR_MAP[rule.entryPrefix] || "#58a6ff";

    const sampleGeneratedTags: string[] = [];
    let ruleGeneratedCount = 0;

    if (
      rule.enabled &&
      entryCandidates.length > 0 &&
      exitCandidates.length > 0 &&
      (rule.hopCount === 1 || middleCandidates.length > 0)
    ) {
      const maxForRule = Math.max(1, rule.maxGeneratedNodes || 25);

      if (rule.hopCount === 1) {
        const pairs: Array<{
          entry: ConvertedNodeMetadata;
          exit: ConvertedNodeMetadata;
        }> = [];

        if (rule.expansionMode === "primary_entry_to_all_exits") {
          const primaryEntry = entryCandidates[0];
          for (const exitNode of exitCandidates) {
            if (primaryEntry.tag === exitNode.tag) continue;
            pairs.push({ entry: primaryEntry, exit: exitNode });
          }
        } else if (rule.expansionMode === "round_robin_pairing") {
          const len = Math.max(entryCandidates.length, exitCandidates.length);
          for (let i = 0; i < len; i++) {
            const entryNode = entryCandidates[i % entryCandidates.length];
            const exitNode = exitCandidates[i % exitCandidates.length];
            if (entryNode.tag === exitNode.tag) continue;
            pairs.push({ entry: entryNode, exit: exitNode });
          }
        } else {
          for (const entryNode of entryCandidates) {
            for (const exitNode of exitCandidates) {
              if (entryNode.tag === exitNode.tag) continue;
              pairs.push({ entry: entryNode, exit: exitNode });
            }
          }
        }

        for (const pair of pairs.slice(0, maxForRule)) {
          if (counter >= 999) break;
          const baseChainTag = formatChainNodeTag({
            scheme: namingScheme,
            hopCount: 1,
            entryPrefix: rule.entryPrefix,
            exitPrefix: rule.exitPrefix,
            exitRawName: pair.exit.rawNodeName,
            entryRawName: pair.entry.rawNodeName,
          });
          let chainTag = baseChainTag;
          let dup = 1;
          while (usedTags.has(chainTag)) {
            chainTag = `${baseChainTag}_${dup}`;
            dup++;
          }
          usedTags.add(chainTag);

          const chainedOutbound = cloneOutboundWithDetour(
            pair.exit.outbound,
            chainTag,
            pair.entry.tag
          );
          allOutbounds.push(chainedOutbound);

          const username = formatUsername(counter);
          const password = "0";
          counter++;
          ruleGeneratedCount++;
          if (sampleGeneratedTags.length < 4) {
            sampleGeneratedTags.push(chainTag);
          }

          endpoints.push({
            index: counter - 1,
            username,
            password,
            finalTag: chainTag,
            surgeProxyLine: `${chainTag} = socks5, ${listenIp}, ${listenPort}, username=${username}, password=${password}`,
            hopCount: 1,
            isSelfHop,
            entryPrefix: rule.entryPrefix,
            exitPrefix: rule.exitPrefix,
            hopTags: [pair.entry.tag, pair.exit.tag],
            protocolChain: [pair.entry.protocol, pair.exit.protocol],
            ruleId: rule.id,
            outbound: chainedOutbound,
          });
        }
      } else if (rule.hopCount === 2 && rule.middlePrefix) {
        const primaryEntry = entryCandidates[0];
        const primaryMiddle = middleCandidates[0];

        if (
          primaryEntry &&
          primaryMiddle &&
          primaryEntry.tag !== primaryMiddle.tag
        ) {
          const intermediateRelayTag = `_RELAY_${rule.entryPrefix}_${primaryEntry.rawNodeName}_TO_${rule.middlePrefix}_${primaryMiddle.rawNodeName}`.replace(
            /\s+/g,
            "_"
          );
          if (!usedTags.has(intermediateRelayTag)) {
            usedTags.add(intermediateRelayTag);
            const relayOutbound = cloneOutboundWithDetour(
              primaryMiddle.outbound,
              intermediateRelayTag,
              primaryEntry.tag
            );
            allOutbounds.push(relayOutbound);
          }

          for (const exitNode of exitCandidates.slice(0, maxForRule)) {
            if (counter >= 999) break;
            if (
              exitNode.tag === primaryEntry.tag ||
              exitNode.tag === primaryMiddle.tag
            ) {
              continue;
            }

            const baseChainTag = formatChainNodeTag({
              scheme: namingScheme,
              hopCount: 2,
              entryPrefix: rule.entryPrefix,
              middlePrefix: rule.middlePrefix,
              exitPrefix: rule.exitPrefix,
              exitRawName: exitNode.rawNodeName,
              entryRawName: primaryEntry.rawNodeName,
              middleRawName: primaryMiddle.rawNodeName,
            });
            let chainTag = baseChainTag;
            let dup = 1;
            while (usedTags.has(chainTag)) {
              chainTag = `${baseChainTag}_${dup}`;
              dup++;
            }
            usedTags.add(chainTag);

            const finalChainedOutbound = cloneOutboundWithDetour(
              exitNode.outbound,
              chainTag,
              intermediateRelayTag
            );
            allOutbounds.push(finalChainedOutbound);

            const username = formatUsername(counter);
            const password = "0";
            counter++;
            ruleGeneratedCount++;
            if (sampleGeneratedTags.length < 4) {
              sampleGeneratedTags.push(chainTag);
            }

            endpoints.push({
              index: counter - 1,
              username,
              password,
              finalTag: chainTag,
              surgeProxyLine: `${chainTag} = socks5, ${listenIp}, ${listenPort}, username=${username}, password=${password}`,
              hopCount: 2,
              isSelfHop: false,
              entryPrefix: rule.entryPrefix,
              middlePrefix: rule.middlePrefix,
              exitPrefix: rule.exitPrefix,
              hopTags: [primaryEntry.tag, primaryMiddle.tag, exitNode.tag],
              protocolChain: [
                primaryEntry.protocol,
                primaryMiddle.protocol,
                exitNode.protocol,
              ],
              ruleId: rule.id,
              outbound: finalChainedOutbound,
            });
          }
        }
      }
    }

    visualEdges.push({
      id: `edge_${rule.id}`,
      ruleId: rule.id,
      ruleName: rule.name,
      enabled: rule.enabled,
      hopCount: rule.hopCount,
      isSelfHop,
      fromPrefix: rule.entryPrefix,
      viaPrefix: rule.hopCount === 2 ? rule.middlePrefix : undefined,
      toPrefix: rule.exitPrefix,
      entryFilter: rule.entryNodeFilterRegex,
      middleFilter: rule.middleNodeFilterRegex,
      exitFilter: rule.exitNodeFilterRegex,
      generatedCount: ruleGeneratedCount,
      colorHex: edgeColor,
      sampleGeneratedTags,
    });
  }

  const inboundUsers = endpoints.map((ep) => ({
    username: ep.username,
    password: ep.password,
  }));

  const routeRules: SingboxRouteRule[] = endpoints.map((ep) => ({
    auth_user: [ep.username],
    action: "route",
    outbound: ep.finalTag,
  }));

  const singboxConfig: SingboxConfig = {
    $schema: "https://sing-box.sagernet.org/schema.json",
    log: {
      level: logLevel || "info",
    },
    dns: {
      servers: dnsServers,
      rules: dnsRules,
    },
    inbounds: [
      {
        type: "mixed",
        tag: "mixed-in",
        listen: listenIp,
        listen_port: listenPort,
        users: inboundUsers,
      },
    ],
    outbounds: allOutbounds,
    route: {
      auto_detect_interface: autoDetectInterface,
      default_domain_resolver: "dns-direct",
      rules: routeRules,
      final: "direct",
    },
  };

  const providerNodes: TopologyProviderNode[] = [];
  for (const [prefix, nodes] of byPrefix.entries()) {
    const protocols = Array.from(new Set(nodes.map((n) => n.protocol)));
    const insecureCount = nodes.filter((n) => n.effectiveInsecure).length;
    const hasCustomDoH = nodes.some((n) => Boolean(n.domainResolverTag));
    providerNodes.push({
      prefix,
      label: `${prefix} Provider (${nodes.length} nodes)`,
      nodeCount: nodes.length,
      insecureCount,
      protocols,
      colorHex: PROVIDER_COLOR_MAP[prefix] || "#58a6ff",
      sampleNodes: nodes.slice(0, 4).map((n) => n.rawNodeName),
      hasCustomDoH,
    });
  }

  const surgeLines: string[] = [];
  surgeLines.push("#!MANAGED-CONFIG https://127.0.0.1/aSingbox127.conf interval=0 strict=false");
  surgeLines.push("# Generated by SingboxGUI V0 (Surge 5.10 Smart Transition Engine -> Sing-box 1.14.4 SOCKS5 Bridge)");
  surgeLines.push(`# Naming Scheme: ${namingScheme} | Total SOCKS5 Endpoints: ${endpoints.length}`);
  surgeLines.push("");
  surgeLines.push("[Proxy]");
  for (const ep of endpoints) {
    surgeLines.push(ep.surgeProxyLine);
  }

  if (includeSurgeProxyGroups && providerNodes.length > 0) {
    surgeLines.push("");
    surgeLines.push("[Proxy Group]");
    for (const pNode of providerNodes) {
      const dirRegex =
        namingScheme === "scheme_a_tilde"
          ? `^${pNode.prefix}-`
          : namingScheme === "scheme_b_dir"
          ? `^DIR-${pNode.prefix}-`
          : `^${pNode.prefix}@DIR-`;
      surgeLines.push(
        `Direct-${pNode.prefix} = smart, policy-regex-filter=${dirRegex}, include-other-group=false`
      );
    }
    for (const edge of visualEdges) {
      if (!edge.enabled || edge.generatedCount === 0) continue;
      const chainRegex =
        namingScheme === "scheme_a_tilde"
          ? edge.hopCount === 2
            ? `^CP2~${edge.fromPrefix}>${edge.viaPrefix}>${edge.toPrefix}~`
            : `^CP1~${edge.fromPrefix}>${edge.toPrefix}~`
          : namingScheme === "scheme_b_dir"
          ? edge.hopCount === 2
            ? `^CP2-${edge.fromPrefix}-${edge.viaPrefix}-${edge.toPrefix}-`
            : `^CP1-${edge.fromPrefix}-${edge.toPrefix}-`
          : edge.hopCount === 2
          ? `^${edge.toPrefix}@CP2-${edge.fromPrefix}-${edge.viaPrefix}-`
          : `^${edge.toPrefix}@CP1-${edge.fromPrefix}-`;
      const groupTitle =
        edge.hopCount === 2
          ? `Chain2-${edge.fromPrefix}-${edge.viaPrefix}-${edge.toPrefix}`
          : `Chain1-${edge.fromPrefix}-${edge.toPrefix}`;
      surgeLines.push(
        `${groupTitle} = smart, policy-regex-filter=${chainRegex}`
      );
    }
  }

  surgeLines.push("");
  surgeLines.push("[Rule]");
  surgeLines.push("# [Anti-Loop Critical] Allow sing-box outbound traffic to bypass Surge directly");
  surgeLines.push("PROCESS-NAME,sing-box,DIRECT");
  surgeLines.push("FINAL,DIRECT");
  surgeLines.push("");

  return {
    singboxConfig,
    surgeConfigText: surgeLines.join("\n"),
    endpoints,
    providerNodes,
    visualEdges,
  };
}
