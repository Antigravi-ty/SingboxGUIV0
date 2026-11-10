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
import {
  buildUrltestOutbound,
  cloneOutboundWithDetour,
  expandTwoHopRule,
  MAX_SOCKS5_ENDPOINTS,
} from "./chainTwoHopExpander";
import {
  buildSurgeConfigContent,
  buildTopologyProviderNodes,
} from "./surgeConfigBuilder";

export { MAX_SOCKS5_ENDPOINTS };

function safeRegexMatch(pattern: string | undefined, target: string): boolean {
  const trimmed = (pattern || "").trim();
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
  const allOutbounds: SingboxOutbound[] = [{ type: "direct", tag: "direct" }];
  const usedTags = new Set<string>(["direct"]);

  const byPrefix = new Map<string, ConvertedNodeMetadata[]>();
  for (const node of directNodes) {
    const list = byPrefix.get(node.providerPrefix) || [];
    list.push(node);
    byPrefix.set(node.providerPrefix, list);
  }

  const counterRef = { value: 0 };
  const formatUsername = (idx: number) =>
    idx < 1000 ? String(idx).padStart(3, "0") : String(idx);

  for (const node of directNodes) {
    if (counterRef.value >= MAX_SOCKS5_ENDPOINTS) break;
    const username = formatUsername(counterRef.value);
    const password = "0";
    counterRef.value++;

    usedTags.add(node.tag);
    allOutbounds.push(node.outbound);

    const surgeLine = `${node.tag} = socks5, ${listenIp}, ${listenPort}, username=${username}, password=${password}`;
    endpoints.push({
      index: counterRef.value - 1,
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

  const registerUniqueTag = (base: string): string => {
    let tag = base;
    let dup = 1;
    while (usedTags.has(tag)) {
      tag = `${base}_${dup}`;
      dup++;
    }
    usedTags.add(tag);
    return tag;
  };

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
    const edgeColor = PROVIDER_COLOR_MAP[rule.entryPrefix] || "#58a6ff";

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
        if (
          rule.expansionMode === "urltest_pool_to_exits" ||
          rule.expansionMode === "urltest_pool_single_hop"
        ) {
          const sharedEntryPoolTag = registerUniqueTag(
            `_POOL_ENTRY_${rule.entryPrefix}_${rule.id.slice(-6)}`
          );
          if (entryCandidates.length > 1) {
            allOutbounds.push(
              buildUrltestOutbound(
                sharedEntryPoolTag,
                entryCandidates.map((c) => c.tag)
              )
            );
          }

          const chainedExitTagsForSinglePool: string[] = [];

          for (const exitNode of exitCandidates.slice(0, maxForRule)) {
            if (counterRef.value >= MAX_SOCKS5_ENDPOINTS) break;

            const validEntries = entryCandidates.filter(
              (e) => e.tag !== exitNode.tag
            );
            if (validEntries.length === 0) continue;

            let detourTargetTag: string;
            if (validEntries.length === 1) {
              detourTargetTag = validEntries[0].tag;
            } else if (validEntries.length === entryCandidates.length) {
              detourTargetTag = sharedEntryPoolTag;
            } else {
              const filteredPoolTag = registerUniqueTag(
                `_POOL_ENTRY_${rule.entryPrefix}_EX_${exitNode.rawNodeName.replace(
                  /\s+/g,
                  "_"
                )}`
              );
              allOutbounds.push(
                buildUrltestOutbound(
                  filteredPoolTag,
                  validEntries.map((c) => c.tag)
                )
              );
              detourTargetTag = filteredPoolTag;
            }

            const entryLabel =
              validEntries.length > 1
                ? `AutoPool(${validEntries.length})`
                : validEntries[0].rawNodeName;

            const baseChainTag = formatChainNodeTag({
              scheme: namingScheme,
              hopCount: 1,
              entryPrefix: rule.entryPrefix,
              exitPrefix: rule.exitPrefix,
              exitRawName: exitNode.rawNodeName,
              entryRawName: entryLabel,
            });

            if (rule.expansionMode === "urltest_pool_single_hop") {
              const internalExitTag = registerUniqueTag(`_HOP_${baseChainTag}`);
              const chainedOutbound = cloneOutboundWithDetour(
                exitNode.outbound,
                internalExitTag,
                detourTargetTag
              );
              allOutbounds.push(chainedOutbound);
              chainedExitTagsForSinglePool.push(internalExitTag);
            } else {
              const chainTag = registerUniqueTag(baseChainTag);
              const chainedOutbound = cloneOutboundWithDetour(
                exitNode.outbound,
                chainTag,
                detourTargetTag
              );
              allOutbounds.push(chainedOutbound);

              const username = formatUsername(counterRef.value);
              const password = "0";
              counterRef.value++;
              ruleGeneratedCount++;
              if (sampleGeneratedTags.length < 4) {
                sampleGeneratedTags.push(chainTag);
              }

              endpoints.push({
                index: counterRef.value - 1,
                username,
                password,
                finalTag: chainTag,
                surgeProxyLine: `${chainTag} = socks5, ${listenIp}, ${listenPort}, username=${username}, password=${password}`,
                hopCount: 1,
                isSelfHop,
                entryPrefix: rule.entryPrefix,
                exitPrefix: rule.exitPrefix,
                hopTags: [
                  validEntries.length > 1
                    ? `${detourTargetTag}[${validEntries.length} nodes]`
                    : validEntries[0].tag,
                  exitNode.tag,
                ],
                protocolChain: ["urltest-pool", exitNode.protocol],
                ruleId: rule.id,
                outbound: chainedOutbound,
              });
            }
          }

          if (
            rule.expansionMode === "urltest_pool_single_hop" &&
            chainedExitTagsForSinglePool.length > 0 &&
            counterRef.value < MAX_SOCKS5_ENDPOINTS
          ) {
            const singlePoolTag = registerUniqueTag(
              formatChainNodeTag({
                scheme: namingScheme,
                hopCount: 1,
                entryPrefix: rule.entryPrefix,
                exitPrefix: rule.exitPrefix,
                exitRawName: `AutoExitPool(${chainedExitTagsForSinglePool.length})`,
                entryRawName: `AutoEntryPool(${entryCandidates.length})`,
              })
            );
            const topPoolOutbound = buildUrltestOutbound(
              singlePoolTag,
              chainedExitTagsForSinglePool
            );
            allOutbounds.push(topPoolOutbound);

            const username = formatUsername(counterRef.value);
            const password = "0";
            counterRef.value++;
            ruleGeneratedCount++;
            sampleGeneratedTags.push(singlePoolTag);

            endpoints.push({
              index: counterRef.value - 1,
              username,
              password,
              finalTag: singlePoolTag,
              surgeProxyLine: `${singlePoolTag} = socks5, ${listenIp}, ${listenPort}, username=${username}, password=${password}`,
              hopCount: 1,
              isSelfHop,
              entryPrefix: rule.entryPrefix,
              exitPrefix: rule.exitPrefix,
              hopTags: [
                `${sharedEntryPoolTag}[${entryCandidates.length}]`,
                `${singlePoolTag}[${chainedExitTagsForSinglePool.length}]`,
              ],
              protocolChain: ["urltest-entry", "urltest-exit"],
              ruleId: rule.id,
              outbound: topPoolOutbound,
            });
          }
        } else {
          const pairs: Array<{
            entry: ConvertedNodeMetadata;
            exit: ConvertedNodeMetadata;
          }> = [];

          if (rule.expansionMode === "primary_entry_to_all_exits") {
            const primaryEntry =
              entryCandidates.find(
                (c) => c.tag === rule.preferredPrimaryEntryTag
              ) || entryCandidates[0];
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
            if (counterRef.value >= MAX_SOCKS5_ENDPOINTS) break;
            const baseChainTag = formatChainNodeTag({
              scheme: namingScheme,
              hopCount: 1,
              entryPrefix: rule.entryPrefix,
              exitPrefix: rule.exitPrefix,
              exitRawName: pair.exit.rawNodeName,
              entryRawName: pair.entry.rawNodeName,
            });
            const chainTag = registerUniqueTag(baseChainTag);

            const chainedOutbound = cloneOutboundWithDetour(
              pair.exit.outbound,
              chainTag,
              pair.entry.tag
            );
            allOutbounds.push(chainedOutbound);

            const username = formatUsername(counterRef.value);
            const password = "0";
            counterRef.value++;
            ruleGeneratedCount++;
            if (sampleGeneratedTags.length < 4) {
              sampleGeneratedTags.push(chainTag);
            }

            endpoints.push({
              index: counterRef.value - 1,
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
        }
      } else if (rule.hopCount === 2 && rule.middlePrefix) {
        ruleGeneratedCount = expandTwoHopRule({
          rule,
          namingScheme,
          entryCandidates,
          middleCandidates,
          exitCandidates,
          maxForRule,
          listenIp,
          listenPort,
          counterRef,
          registerUniqueTag,
          formatUsername,
          allOutbounds,
          endpoints,
          sampleGeneratedTags,
        });
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

  const providerNodes = buildTopologyProviderNodes(byPrefix);

  const surgeConfigText = buildSurgeConfigContent({
    namingScheme,
    endpoints,
    providerNodes,
    visualEdges,
    includeSurgeProxyGroups,
  });

  return {
    singboxConfig,
    surgeConfigText,
    endpoints,
    providerNodes,
    visualEdges,
  };
}
