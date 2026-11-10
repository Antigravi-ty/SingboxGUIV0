import { formatChainNodeTag } from "../config/chainNamingPresets";
import {
  ChainLinkRule,
  ChainNamingSchemeId,
  GeneratedProxyEndpoint,
} from "../types/chainProxy";
import { ConvertedNodeMetadata, SingboxOutbound } from "../types/singbox";

export const MAX_SOCKS5_ENDPOINTS = 5000;

export function cloneOutboundWithDetour(
  baseOutbound: SingboxOutbound,
  newTag: string,
  detourTag: string
): SingboxOutbound {
  const cloned = JSON.parse(JSON.stringify(baseOutbound)) as SingboxOutbound;
  cloned.tag = newTag;
  cloned.detour = detourTag;
  return cloned;
}

export function buildUrltestOutbound(
  tag: string,
  memberTags: string[]
): SingboxOutbound {
  return {
    type: "urltest",
    tag,
    outbounds: memberTags,
    url: "https://www.gstatic.com/generate_204",
    interval: "3m",
    tolerance: 50,
  };
}

export function expandTwoHopRule(params: {
  rule: ChainLinkRule;
  namingScheme: ChainNamingSchemeId;
  entryCandidates: ConvertedNodeMetadata[];
  middleCandidates: ConvertedNodeMetadata[];
  exitCandidates: ConvertedNodeMetadata[];
  maxForRule: number;
  listenIp: string;
  listenPort: number;
  counterRef: { value: number };
  registerUniqueTag: (base: string) => string;
  formatUsername: (idx: number) => string;
  allOutbounds: SingboxOutbound[];
  endpoints: GeneratedProxyEndpoint[];
  sampleGeneratedTags: string[];
}): number {
  const {
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
  } = params;

  let ruleGeneratedCount = 0;
  if (!rule.middlePrefix || middleCandidates.length === 0) {
    return 0;
  }

  if (
    rule.expansionMode === "urltest_pool_to_exits" ||
    rule.expansionMode === "urltest_pool_single_hop"
  ) {
    const entryPoolTag =
      entryCandidates.length > 1
        ? registerUniqueTag(
            `_POOL_ENTRY_${rule.entryPrefix}_${rule.id.slice(-6)}`
          )
        : entryCandidates[0].tag;
    if (entryCandidates.length > 1) {
      allOutbounds.push(
        buildUrltestOutbound(
          entryPoolTag,
          entryCandidates.map((c) => c.tag)
        )
      );
    }

    const chainedMidTags: string[] = [];
    for (const midNode of middleCandidates) {
      const midRelayTag = registerUniqueTag(
        `_RELAY_${rule.entryPrefix}_TO_${midNode.tag}`.replace(/\s+/g, "_")
      );
      allOutbounds.push(
        cloneOutboundWithDetour(midNode.outbound, midRelayTag, entryPoolTag)
      );
      chainedMidTags.push(midRelayTag);
    }

    const midDetourTag =
      chainedMidTags.length > 1
        ? registerUniqueTag(`_POOL_MID_${rule.middlePrefix}_${rule.id.slice(-6)}`)
        : chainedMidTags[0];
    if (chainedMidTags.length > 1) {
      allOutbounds.push(buildUrltestOutbound(midDetourTag, chainedMidTags));
    }

    for (const exitNode of exitCandidates.slice(0, maxForRule)) {
      if (counterRef.value >= MAX_SOCKS5_ENDPOINTS) break;
      const baseChainTag = formatChainNodeTag({
        scheme: namingScheme,
        hopCount: 2,
        entryPrefix: rule.entryPrefix,
        middlePrefix: rule.middlePrefix,
        exitPrefix: rule.exitPrefix,
        exitRawName: exitNode.rawNodeName,
        entryRawName:
          entryCandidates.length > 1
            ? `AutoPool(${entryCandidates.length})`
            : entryCandidates[0].rawNodeName,
        middleRawName:
          middleCandidates.length > 1
            ? `AutoPool(${middleCandidates.length})`
            : middleCandidates[0].rawNodeName,
      });
      const chainTag = registerUniqueTag(baseChainTag);
      const finalChainedOutbound = cloneOutboundWithDetour(
        exitNode.outbound,
        chainTag,
        midDetourTag
      );
      allOutbounds.push(finalChainedOutbound);

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
        hopCount: 2,
        isSelfHop: false,
        entryPrefix: rule.entryPrefix,
        middlePrefix: rule.middlePrefix,
        exitPrefix: rule.exitPrefix,
        hopTags: [entryPoolTag, midDetourTag, exitNode.tag],
        protocolChain: ["urltest-entry", "urltest-mid", exitNode.protocol],
        ruleId: rule.id,
        outbound: finalChainedOutbound,
      });
    }
  } else {
    const primaryEntry =
      entryCandidates.find((c) => c.tag === rule.preferredPrimaryEntryTag) ||
      entryCandidates[0];
    const primaryMiddle = middleCandidates[0];

    if (
      primaryEntry &&
      primaryMiddle &&
      primaryEntry.tag !== primaryMiddle.tag
    ) {
      const intermediateRelayTag = registerUniqueTag(
        `_RELAY_${rule.entryPrefix}_${primaryEntry.rawNodeName}_TO_${rule.middlePrefix}_${primaryMiddle.rawNodeName}`.replace(
          /\s+/g,
          "_"
        )
      );
      const relayOutbound = cloneOutboundWithDetour(
        primaryMiddle.outbound,
        intermediateRelayTag,
        primaryEntry.tag
      );
      allOutbounds.push(relayOutbound);

      for (const exitNode of exitCandidates.slice(0, maxForRule)) {
        if (counterRef.value >= MAX_SOCKS5_ENDPOINTS) break;
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
        const chainTag = registerUniqueTag(baseChainTag);

        const finalChainedOutbound = cloneOutboundWithDetour(
          exitNode.outbound,
          chainTag,
          intermediateRelayTag
        );
        allOutbounds.push(finalChainedOutbound);

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

  return ruleGeneratedCount;
}
