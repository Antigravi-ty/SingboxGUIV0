import React, { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { ChainExpansionMode } from "../../types/chainProxy";

export const ChainRuleBuilderPanel: React.FC = () => {
  const providerNodes = useWorkspaceStore((s) => s.providerNodes);
  const visualEdges = useWorkspaceStore((s) => s.visualEdges);
  const chainRules = useWorkspaceStore((s) => s.chainRules);
  const selectedChainRuleId = useWorkspaceStore((s) => s.selectedChainRuleId);
  const selectChainRule = useWorkspaceStore((s) => s.selectChainRule);
  const addChainRule = useWorkspaceStore((s) => s.addChainRule);
  const toggleChainRule = useWorkspaceStore((s) => s.toggleChainRule);
  const deleteChainRule = useWorkspaceStore((s) => s.deleteChainRule);

  const availablePrefixes = useMemo(
    () => providerNodes.map((p) => p.prefix),
    [providerNodes]
  );

  const [newHopCount, setNewHopCount] = useState<1 | 2>(1);
  const [newEntryPrefix, setNewEntryPrefix] = useState<string>("LC");
  const [newEntryFilter, setNewEntryFilter] =
    useState<string>("AWS-JP-1|JP|日本");
  const [newMiddlePrefix, setNewMiddlePrefix] = useState<string>("LT");
  const [newMiddleFilter, setNewMiddleFilter] = useState<string>("SG|新加坡");
  const [newExitPrefix, setNewExitPrefix] = useState<string>("YY");
  const [newExitFilter, setNewExitFilter] = useState<string>(".*");
  const [newExpansionMode, setNewExpansionMode] =
    useState<ChainExpansionMode>("primary_entry_to_all_exits");
  const [newMaxNodes, setNewMaxNodes] = useState<number>(20);

  const handleAddRule = () => {
    const isSelf = newHopCount === 1 && newEntryPrefix === newExitPrefix;
    const ruleTitle =
      newHopCount === 2
        ? `2-Hop: ${newEntryPrefix} (${newEntryFilter || "*"}) -> ${newMiddlePrefix} (${
            newMiddleFilter || "*"
          }) -> ${newExitPrefix} (${newExitFilter || "*"})`
        : isSelf
        ? `Self-Relay: ${newEntryPrefix} (${newEntryFilter || "*"}) -> ${newExitPrefix} (${
            newExitFilter || "*"
          })`
        : `1-Hop: ${newEntryPrefix} (${newEntryFilter || "*"}) -> ${newExitPrefix} (${
            newExitFilter || "*"
          })`;

    addChainRule({
      name: ruleTitle,
      enabled: true,
      hopCount: newHopCount,
      entryPrefix: newEntryPrefix,
      entryNodeFilterRegex: newEntryFilter || ".*",
      middlePrefix: newHopCount === 2 ? newMiddlePrefix : undefined,
      middleNodeFilterRegex:
        newHopCount === 2 ? newMiddleFilter || ".*" : undefined,
      exitPrefix: newExitPrefix,
      exitNodeFilterRegex: newExitFilter || ".*",
      expansionMode: newExpansionMode,
      maxGeneratedNodes: newMaxNodes,
    });
  };

  return (
    <div className="primer-box">
      <div className="primer-box-header">
        <span>
          Dynamic Chain Proxy Association Builder (Inter-Group &amp; Self-Relay)
        </span>
        <span className="primer-label primer-label-accent">
          Sing-box 1.14.4 detour
        </span>
      </div>
      <div
        className="primer-box-body"
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
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
              onChange={(e) => setNewHopCount(Number(e.target.value) as 1 | 2)}
            >
              <option value={1}>1-Hop (Entry -&gt; Exit or Self)</option>
              <option value={2}>2-Hop (Entry -&gt; Transit -&gt; Exit)</option>
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
              Entry Node Regex
            </label>
            <input
              className="primer-input"
              value={newEntryFilter}
              onChange={(e) => setNewEntryFilter(e.target.value)}
              placeholder="e.g. JP|日本"
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
                  placeholder="e.g. SG|新加坡"
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
              placeholder="e.g. US|美国 or .*"
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select
              className="primer-input"
              style={{ width: 210 }}
              value={newExpansionMode}
              onChange={(e) =>
                setNewExpansionMode(e.target.value as ChainExpansionMode)
              }
            >
              <option value="primary_entry_to_all_exits">
                Primary Entry -&gt; All Matched Exits
              </option>
              <option value="round_robin_pairing">
                Round-Robin 1:1 Pairing
              </option>
              <option value="full_cartesian">
                Full Cartesian Matrix (M × N)
              </option>
            </select>
            <input
              type="number"
              className="primer-input"
              style={{ width: 85 }}
              min={1}
              max={200}
              value={newMaxNodes}
              onChange={(e) =>
                setNewMaxNodes(Math.max(1, Number(e.target.value) || 20))
              }
              title="Max SOCKS5 endpoints generated for this chain rule"
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

        {/* Active Chain Link Rules List */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginTop: 4,
          }}
        >
          {chainRules.map((rule) => {
            const edgeStat = visualEdges.find((e) => e.ruleId === rule.id);
            const isSelected = selectedChainRuleId === rule.id;
            return (
              <div
                key={rule.id}
                onClick={() => selectChainRule(isSelected ? null : rule.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: `1px solid ${
                    isSelected ? "var(--fg-accent)" : "var(--border-default)"
                  }`,
                  backgroundColor: isSelected
                    ? "var(--selected-item-bg)"
                    : "var(--bg-canvas-subtle)",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      className={`primer-label ${
                        rule.hopCount === 2
                          ? "primer-label-done"
                          : rule.entryPrefix === rule.exitPrefix
                          ? "primer-label-sponsors"
                          : "primer-label-accent"
                      }`}
                    >
                      {rule.hopCount === 2
                        ? `CP2: ${rule.entryPrefix}->${rule.middlePrefix}->${rule.exitPrefix}`
                        : rule.entryPrefix === rule.exitPrefix
                        ? `SELF: ${rule.entryPrefix}->${rule.exitPrefix}`
                        : `CP1: ${rule.entryPrefix}->${rule.exitPrefix}`}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>
                      {rule.name}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--fg-muted)",
                    }}
                  >
                    Entry filter: <code>{rule.entryNodeFilterRegex}</code>{" "}
                    {rule.hopCount === 2 && (
                      <>
                        | Mid: <code>{rule.middleNodeFilterRegex}</code>{" "}
                      </>
                    )}
                    | Exit filter: <code>{rule.exitNodeFilterRegex}</code> -&gt;{" "}
                    <strong>
                      {edgeStat?.generatedCount || 0} SOCKS5 endpoints
                    </strong>
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    role="switch"
                    aria-checked={rule.enabled}
                    className="primer-toggle-switch-btn"
                    onClick={() => toggleChainRule(rule.id)}
                    title="Toggle chain rule active state"
                  >
                    <span className="primer-toggle-switch-knob" />
                  </button>
                  <button
                    type="button"
                    className="primer-btn primer-btn-icon-only primer-btn-danger"
                    onClick={() => deleteChainRule(rule.id)}
                    title="Remove chain rule"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
