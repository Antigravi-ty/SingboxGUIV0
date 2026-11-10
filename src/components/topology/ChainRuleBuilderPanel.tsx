import React, { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { ChainExpansionMode } from "../../types/chainProxy";
import { ChainRuleItemList } from "./ChainRuleItemList";

export const ChainRuleBuilderPanel: React.FC = () => {
  const providerNodes = useWorkspaceStore((s) => s.providerNodes);
  const addChainRule = useWorkspaceStore((s) => s.addChainRule);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);

  const availablePrefixes = useMemo(
    () => providerNodes.map((p) => p.prefix),
    [providerNodes]
  );

  const directNodes = useWorkspaceStore((s) => s.directNodes);

  const [newHopCount, setNewHopCount] = useState<1 | 2>(1);
  const [newEntryPrefix, setNewEntryPrefix] = useState<string>("");
  const [newEntryFilter, setNewEntryFilter] = useState<string>("");
  const [newMiddlePrefix, setNewMiddlePrefix] = useState<string>("");
  const [newMiddleFilter, setNewMiddleFilter] = useState<string>("");
  const [newExitPrefix, setNewExitPrefix] = useState<string>("");
  const [newExitFilter, setNewExitFilter] = useState<string>("");
  const [newExpansionMode, setNewExpansionMode] =
    useState<ChainExpansionMode>("urltest_pool_to_exits");
  const [newPreferredEntryTag, setNewPreferredEntryTag] = useState<string>("");
  const [newMaxNodes, setNewMaxNodes] = useState<number>(30);

  const matchedEntryNodes = useMemo(() => {
    const subNodes = directNodes.filter(
      (n) => n.providerPrefix === newEntryPrefix
    );
    const trimmed = newEntryFilter.trim();
    if (!trimmed || trimmed === "*" || trimmed === ".*") return subNodes;
    try {
      const rx = new RegExp(trimmed, "i");
      return subNodes.filter((n) => rx.test(`${n.rawNodeName} ${n.tag}`));
    } catch {
      return subNodes.filter((n) =>
        `${n.rawNodeName} ${n.tag}`
          .toLowerCase()
          .includes(trimmed.toLowerCase())
      );
    }
  }, [directNodes, newEntryPrefix, newEntryFilter]);

  useEffect(() => {
    if (availablePrefixes.length > 0) {
      if (!newEntryPrefix || !availablePrefixes.includes(newEntryPrefix)) {
        setNewEntryPrefix(availablePrefixes[0]);
      }
      if (!newMiddlePrefix || !availablePrefixes.includes(newMiddlePrefix)) {
        setNewMiddlePrefix(availablePrefixes[Math.min(1, availablePrefixes.length - 1)]);
      }
      if (!newExitPrefix || !availablePrefixes.includes(newExitPrefix)) {
        setNewExitPrefix(availablePrefixes[availablePrefixes.length - 1]);
      }
    } else {
      setNewEntryPrefix("");
      setNewMiddlePrefix("");
      setNewExitPrefix("");
    }
  }, [availablePrefixes, newEntryPrefix, newMiddlePrefix, newExitPrefix]);

  useEffect(() => {
    if (
      matchedEntryNodes.length > 0 &&
      (!newPreferredEntryTag ||
        !matchedEntryNodes.some((n) => n.tag === newPreferredEntryTag))
    ) {
      setNewPreferredEntryTag(matchedEntryNodes[0].tag);
    }
  }, [matchedEntryNodes, newPreferredEntryTag]);

  const handleAddRule = () => {
    if (!newEntryPrefix || !newExitPrefix) return;
    const isSelf = newHopCount === 1 && newEntryPrefix === newExitPrefix;
    const modeTag =
      newExpansionMode === "urltest_pool_to_exits"
        ? "AutoPool"
        : newExpansionMode === "urltest_pool_single_hop"
        ? "SingleSlotPool"
        : newExpansionMode === "full_cartesian"
        ? "Matrix"
        : "Static";
    const ruleTitle =
      newHopCount === 2
        ? `2-Hop [${modeTag}]: ${newEntryPrefix} (${newEntryFilter || "*"}) -> ${newMiddlePrefix} (${
            newMiddleFilter || "*"
          }) -> ${newExitPrefix} (${newExitFilter || "*"})`
        : isSelf
        ? `Self-Relay [${modeTag}]: ${newEntryPrefix} (${newEntryFilter || "*"}) -> ${newExitPrefix} (${
            newExitFilter || "*"
          })`
        : `1-Hop [${modeTag}]: ${newEntryPrefix} (${newEntryFilter || "*"}) -> ${newExitPrefix} (${
            newExitFilter || "*"
          })`;

    addChainRule({
      name: ruleTitle,
      enabled: true,
      hopCount: newHopCount,
      entryPrefix: newEntryPrefix,
      entryNodeFilterRegex: newEntryFilter.trim() || ".*",
      middlePrefix: newHopCount === 2 ? newMiddlePrefix : undefined,
      middleNodeFilterRegex:
        newHopCount === 2 ? newMiddleFilter.trim() || ".*" : undefined,
      exitPrefix: newExitPrefix,
      exitNodeFilterRegex: newExitFilter.trim() || ".*",
      expansionMode: newExpansionMode,
      maxGeneratedNodes: newMaxNodes,
      preferredPrimaryEntryTag:
        newExpansionMode === "primary_entry_to_all_exits"
          ? newPreferredEntryTag || undefined
          : undefined,
    });
  };

  return (
    <div className="primer-box">
      <div className="primer-box-header">
        <span>
          Dynamic Chain Proxy Association Builder (Inter-Group &amp; Self-Relay)
        </span>
        <span className="primer-label primer-label-accent">
          Sing-box 1.14.4 detour + urltest Pool
        </span>
      </div>
      <div
        className="primer-box-body"
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        {availablePrefixes.length === 0 ? (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 6,
              backgroundColor: "var(--bg-canvas-subtle)",
              border: "1px dashed var(--border-default)",
              color: "var(--fg-muted)",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span>
              No subscription groups imported yet. Import a Mihomo YAML /
              Sing-box JSON / Base64 subscription first to build inter-group or
              self-relay chain rules.
            </span>
            <button
              type="button"
              className="primer-btn primer-btn-primary"
              onClick={() => setActiveTab("subscriptions")}
            >
              Go to Subscriptions
            </button>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 8,
              }}
            >
              <div>
                <label style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                  Hop Count
                </label>
                <select
                  className="primer-input"
                  value={newHopCount}
                  onChange={(e) =>
                    setNewHopCount(Number(e.target.value) as 1 | 2)
                  }
                >
                  <option value={1}>1-Hop (Entry -&gt; Exit or Self)</option>
                  <option value={2}>
                    2-Hop (Entry -&gt; Transit -&gt; Exit)
                  </option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                  Entry Provider (Hop 1)
                </label>
                <select
                  className="primer-input"
                  value={newEntryPrefix}
                  onChange={(e) => setNewEntryPrefix(e.target.value)}
                >
                  {availablePrefixes.map((p) => (
                    <option key={p} value={p}>
                      {p} Group
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                  Entry Node Regex ({matchedEntryNodes.length} matched)
                </label>
                <input
                  className="primer-input"
                  value={newEntryFilter}
                  onChange={(e) => setNewEntryFilter(e.target.value)}
                  placeholder=".* (or HK|JP|IPLC)"
                />
              </div>

              {newHopCount === 2 && (
                <>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                      Transit Provider (Hop 2)
                    </label>
                    <select
                      className="primer-input"
                      value={newMiddlePrefix}
                      onChange={(e) => setNewMiddlePrefix(e.target.value)}
                    >
                      {availablePrefixes.map((p) => (
                        <option key={p} value={p}>
                          {p} Group
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                      Transit Node Regex
                    </label>
                    <input
                      className="primer-input"
                      value={newMiddleFilter}
                      onChange={(e) => setNewMiddleFilter(e.target.value)}
                      placeholder=".* (or SG|新加坡)"
                    />
                  </div>
                </>
              )}

              <div>
                <label style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                  Exit Provider (Landing)
                </label>
                <select
                  className="primer-input"
                  value={newExitPrefix}
                  onChange={(e) => setNewExitPrefix(e.target.value)}
                >
                  {availablePrefixes.map((p) => (
                    <option key={p} value={p}>
                      {p}{" "}
                      {p === newEntryPrefix && newHopCount === 1
                        ? "(Self-Hop)"
                        : "Group"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                  Exit Node Regex
                </label>
                <input
                  className="primer-input"
                  value={newExitFilter}
                  onChange={(e) => setNewExitFilter(e.target.value)}
                  placeholder=".* (or US|美国)"
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  flex: "1 1 auto",
                }}
              >
                <select
                  className="primer-input"
                  style={{ width: "auto", minWidth: 230, flex: "1 1 230px" }}
                  value={newExpansionMode}
                  onChange={(e) =>
                    setNewExpansionMode(e.target.value as ChainExpansionMode)
                  }
                >
                  <option value="urltest_pool_to_exits">
                    Dynamic Entry Pool (urltest Auto-Failover) -&gt; All Exits
                    (Recommended: N slots)
                  </option>
                  <option value="urltest_pool_single_hop">
                    Full Dynamic Dual Pool (Entry urltest -&gt; Exit urltest: 1
                    Slot)
                  </option>
                  <option value="primary_entry_to_all_exits">
                    Pinned Primary Entry -&gt; All Matched Exits (Static 1×N)
                  </option>
                  <option value="round_robin_pairing">
                    Round-Robin 1:1 Pairing (Static max(M,N))
                  </option>
                  <option value="full_cartesian">
                    Full Cartesian Matrix (Static M × N)
                  </option>
                </select>

                {newExpansionMode === "primary_entry_to_all_exits" &&
                  matchedEntryNodes.length > 0 && (
                    <select
                      className="primer-input"
                      style={{ width: "auto", minWidth: 160, flex: "1 1 160px" }}
                      value={newPreferredEntryTag}
                      onChange={(e) => setNewPreferredEntryTag(e.target.value)}
                      title="Select which specific Entry node acts as the Pinned Primary Entry"
                    >
                      {matchedEntryNodes.map((n, idx) => (
                        <option key={n.tag} value={n.tag}>
                          {idx === 0 ? `[Default #1] ${n.rawNodeName}` : n.rawNodeName}
                        </option>
                      ))}
                    </select>
                  )}

                <input
                  type="number"
                  className="primer-input"
                  style={{ width: 90 }}
                  min={1}
                  max={2000}
                  value={newMaxNodes}
                  onChange={(e) =>
                    setNewMaxNodes(Math.max(1, Number(e.target.value) || 30))
                  }
                  title="Max SOCKS5 endpoints generated for this chain rule (up to 2000)"
                />
              </div>

              <button
                type="button"
                className="primer-btn primer-btn-primary"
                onClick={handleAddRule}
              >
                <Plus size={13} />
                <span>Add Chain Link Rule</span>
              </button>
            </div>
          </>
        )}

        {/* Active Chain Link Rules List */}
        <ChainRuleItemList />
      </div>
    </div>
  );
};
