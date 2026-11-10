import React, { useMemo, useState } from "react";
import {
  Copy,
  Download,
  Filter,
  GitBranch,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { CHAIN_NAMING_SCHEMES } from "../../config/chainNamingPresets";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import {
  ChainExpansionMode,
  ChainNamingSchemeId,
} from "../../types/chainProxy";
import { triggerTextFileDownload } from "../../utils/subscriptionHelpers";
import { ChainTopologySvgCanvas } from "./ChainTopologySvgCanvas";

export const ChainTopologyView: React.FC = () => {
  const providerNodes = useWorkspaceStore((s) => s.providerNodes);
  const visualEdges = useWorkspaceStore((s) => s.visualEdges);
  const chainRules = useWorkspaceStore((s) => s.chainRules);
  const selectedChainRuleId = useWorkspaceStore((s) => s.selectedChainRuleId);
  const selectChainRule = useWorkspaceStore((s) => s.selectChainRule);
  const addChainRule = useWorkspaceStore((s) => s.addChainRule);
  const toggleChainRule = useWorkspaceStore((s) => s.toggleChainRule);
  const deleteChainRule = useWorkspaceStore((s) => s.deleteChainRule);
  const namingScheme = useWorkspaceStore((s) => s.namingScheme);
  const setNamingScheme = useWorkspaceStore((s) => s.setNamingScheme);
  const regexTestQuery = useWorkspaceStore((s) => s.regexTestQuery);
  const setRegexTestQuery = useWorkspaceStore((s) => s.setRegexTestQuery);
  const endpoints = useWorkspaceStore((s) => s.endpoints);
  const singboxConfig = useWorkspaceStore((s) => s.singboxConfig);
  const surgeConfigText = useWorkspaceStore((s) => s.surgeConfigText);
  const listenIp = useWorkspaceStore((s) => s.listenIp);
  const listenPort = useWorkspaceStore((s) => s.listenPort);

  const availablePrefixes = useMemo(
    () => providerNodes.map((p) => p.prefix),
    [providerNodes]
  );

  const [newHopCount, setNewHopCount] = useState<1 | 2>(1);
  const [newEntryPrefix, setNewEntryPrefix] = useState<string>("LC");
  const [newEntryFilter, setNewEntryFilter] = useState<string>("AWS-JP-1|JP|日本");
  const [newMiddlePrefix, setNewMiddlePrefix] = useState<string>("LT");
  const [newMiddleFilter, setNewMiddleFilter] = useState<string>("SG|新加坡");
  const [newExitPrefix, setNewExitPrefix] = useState<string>("YY");
  const [newExitFilter, setNewExitFilter] = useState<string>(".*");
  const [newExpansionMode, setNewExpansionMode] =
    useState<ChainExpansionMode>("primary_entry_to_all_exits");
  const [newMaxNodes, setNewMaxNodes] = useState<number>(20);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const currentSchemeSpec = CHAIN_NAMING_SCHEMES[namingScheme];

  const regexMatchedEndpoints = useMemo(() => {
    const q = regexTestQuery.trim();
    if (!q) return endpoints;
    try {
      const rx = new RegExp(q);
      return endpoints.filter((ep) => rx.test(ep.finalTag));
    } catch {
      return [];
    }
  }, [endpoints, regexTestQuery]);

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
      middleNodeFilterRegex: newHopCount === 2 ? newMiddleFilter || ".*" : undefined,
      exitPrefix: newExitPrefix,
      exitNodeFilterRegex: newExitFilter || ".*",
      expansionMode: newExpansionMode,
      maxGeneratedNodes: newMaxNodes,
    });
  };

  const handleCopyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(`Copied ${label} to clipboard!`);
      setTimeout(() => setCopyFeedback(null), 2500);
    } catch {
      setCopyFeedback(`Failed to copy ${label}`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Export Action Bar */}
      <div className="primer-banner primer-banner-info">
        <div className="primer-banner-main">
          <div className="primer-banner-icon">
            <GitBranch size={16} />
          </div>
          <div className="primer-banner-content">
            <div className="primer-banner-title">
              Universal Sing-box 1.14.4 SOCKS5 Bridge + Surge 5.10 Smart Transition Engine
            </div>
            <div className="primer-banner-description">
              All protocols (VLESS Reality, Hysteria2 port-hop, AnyTLS, VMess, SS-2022, Trojan, ECH) are handled 100% by Sing-box 1.14.4 and exported to Surge 5.10 as authenticated SOCKS5 endpoints (<code>{listenIp}:{listenPort}</code>, users <code>000..{String(Math.max(0, endpoints.length - 1)).padStart(3, "0")}</code>).
              {copyFeedback && (
                <strong style={{ marginLeft: 10, color: "var(--fg-success)" }}>
                  {copyFeedback}
                </strong>
              )}
            </div>
          </div>
        </div>
        <div className="primer-banner-actions">
          <button
            type="button"
            className="primer-btn primer-btn-primary"
            onClick={() =>
              triggerTextFileDownload(
                JSON.stringify(singboxConfig, null, 2),
                "config.json",
                "application/json;charset=utf-8"
              )
            }
          >
            <Download size={13} />
            <span>Export config.json (Sing-box 1.14.4)</span>
          </button>
          <button
            type="button"
            className="primer-btn primer-btn-status-accent"
            onClick={() =>
              triggerTextFileDownload(
                surgeConfigText,
                "aSingbox127.conf",
                "text/plain;charset=utf-8"
              )
            }
          >
            <Download size={13} />
            <span>Export aSingbox127.conf (Surge 5.10)</span>
          </button>
          <button
            type="button"
            className="primer-btn"
            onClick={() => handleCopyText(surgeConfigText, "aSingbox127.conf")}
          >
            <Copy size={13} />
            <span>Copy Surge Conf</span>
          </button>
        </div>
      </div>

      {/* Interactive SVG Topology Graph */}
      <ChainTopologySvgCanvas
        providerNodes={providerNodes}
        visualEdges={visualEdges}
        selectedRuleId={selectedChainRuleId}
        onSelectRule={selectChainRule}
        listenIp={listenIp}
        listenPort={listenPort}
        totalEndpoints={endpoints.length}
      />

      {/* Split Grid: Dynamic Chain Builder (Left) + Regex Naming Scheme Optimizer (Right) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))",
          gap: 16,
        }}
      >
        {/* Dynamic Chain Link Builder & Active Rules */}
        <div className="primer-box">
          <div className="primer-box-header">
            <span>Dynamic Chain Proxy Association Builder (Inter-Group &amp; Self-Relay)</span>
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
                  onChange={(e) =>
                    setNewHopCount(Number(e.target.value) as 1 | 2)
                  }
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
                      {p} {p === newEntryPrefix && newHopCount === 1 ? "(Self-Hop)" : "Group"}
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
                    onClick={() =>
                      selectChainRule(isSelected ? null : rule.id)
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: `1px solid ${
                        isSelected
                          ? "var(--fg-accent)"
                          : "var(--border-default)"
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
                        | Exit filter: <code>{rule.exitNodeFilterRegex}</code>{" "}
                        -&gt;{" "}
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

        {/* Naming Scheme Selector & Live Regex Filter Tester */}
        <div className="primer-box">
          <div className="primer-box-header">
            <span>Regex-Friendly Prefix Scheme &amp; Surge Policy Filter Tester</span>
            <span className="primer-label primer-label-success">
              {currentSchemeSpec.shortBadge}
            </span>
          </div>
          <div
            className="primer-box-body"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div className="primer-segmented-control">
              {(
                [
                  "scheme_a_tilde",
                  "scheme_b_dir",
                  "scheme_c_exit_at",
                ] as ChainNamingSchemeId[]
              ).map((schemeId) => {
                const spec = CHAIN_NAMING_SCHEMES[schemeId];
                const active = namingScheme === schemeId;
                return (
                  <button
                    key={schemeId}
                    type="button"
                    className={`primer-segmented-button ${
                      active ? "primer-segmented-button-active" : ""
                    }`}
                    onClick={() => setNamingScheme(schemeId)}
                  >
                    {spec.shortBadge}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                backgroundColor: "var(--bg-canvas-subtle)",
                border: "1px solid var(--border-muted)",
                fontSize: 11.5,
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {currentSchemeSpec.title}
              </div>
              <div style={{ color: "var(--fg-muted)", marginBottom: 6 }}>
                {currentSchemeSpec.summary}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "110px 1fr",
                  gap: "3px 8px",
                  fontSize: 11,
                }}
              >
                <span style={{ color: "var(--fg-muted)" }}>Direct (0-hop):</span>
                <code>{currentSchemeSpec.directExample}</code>
                <span style={{ color: "var(--fg-muted)" }}>1-Hop Chain:</span>
                <code>{currentSchemeSpec.oneHopExample}</code>
                <span style={{ color: "var(--fg-muted)" }}>2-Hop Chain:</span>
                <code>{currentSchemeSpec.twoHopExample}</code>
                <span style={{ color: "var(--fg-muted)" }}>Self-Hop:</span>
                <code>{currentSchemeSpec.selfHopExample}</code>
              </div>
            </div>

            {/* Interactive Regex Cheat-Sheet Pills */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--fg-muted)",
                  marginBottom: 6,
                }}
              >
                Click any Regex preset below to test against all{" "}
                {endpoints.length} generated nodes:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {currentSchemeSpec.regexCheatSheet.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`primer-btn primer-card-action-btn ${
                      regexTestQuery === item.pattern
                        ? "primer-btn-status-accent"
                        : ""
                    }`}
                    onClick={() => setRegexTestQuery(item.pattern)}
                    title={item.explanation}
                  >
                    <span>{item.intent}:</span>
                    <code>{item.pattern}</code>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Regex Tester Input + Matched Preview */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Filter size={14} style={{ color: "var(--fg-accent)" }} />
              <input
                className="primer-input"
                value={regexTestQuery}
                onChange={(e) => setRegexTestQuery(e.target.value)}
                placeholder="Enter policy-regex-filter pattern (e.g. ^YY- or ^CP1~LC>YY~)"
              />
              <span className="primer-badge primer-badge-accent">
                {regexMatchedEndpoints.length} / {endpoints.length} matched
              </span>
            </div>

            <div
              style={{
                maxHeight: 165,
                overflowY: "auto",
                border: "1px solid var(--border-muted)",
                borderRadius: 6,
                padding: "6px 10px",
                backgroundColor: "var(--bg-canvas-inset)",
                fontSize: 11,
              }}
            >
              {regexMatchedEndpoints.length === 0 ? (
                <div style={{ color: "var(--fg-muted)" }}>
                  No endpoints matched regex <code>{regexTestQuery}</code>.
                </div>
              ) : (
                regexMatchedEndpoints.slice(0, 40).map((ep) => (
                  <div
                    key={ep.username}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "2px 0",
                      borderBottom: "1px dashed var(--border-muted)",
                    }}
                  >
                    <span>
                      <strong style={{ color: "var(--fg-accent)" }}>
                        [{ep.username}]
                      </strong>{" "}
                      {ep.finalTag}
                    </span>
                    <span style={{ color: "var(--fg-muted)" }}>
                      {ep.hopCount === 0
                        ? "DIRECT"
                        : ep.isSelfHop
                        ? "SELF-HOP"
                        : `${ep.hopCount}-HOP`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Generated SOCKS5 Table */}
      <div className="primer-datatable-container" style={{ maxHeight: 390 }}>
        <div className="primer-datatable-header-bar">
          <div className="primer-datatable-title">
            <span>
              Generated SOCKS5 Bridge Endpoints ({endpoints.length} / 1000 slots)
            </span>
          </div>
          <div className="primer-datatable-actions">
            <span className="primer-label primer-label-neutral">
              Listen: {listenIp}:{listenPort} (auth password = 0)
            </span>
          </div>
        </div>
        <div className="primer-datatable-scroll">
          <table className="primer-datatable">
            <thead>
              <tr>
                <th>SOCKS5 User</th>
                <th>Topology Type</th>
                <th>Surge 5.10 Proxy Name (Sing-box Outbound Tag)</th>
                <th>Hop Path / Sing-box detour Chain</th>
                <th>Protocols</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep) => (
                <tr key={ep.username} className="primer-datatable-row">
                  <td>
                    <code>
                      {ep.username}:0
                    </code>
                  </td>
                  <td>
                    <span
                      className={`primer-label ${
                        ep.hopCount === 0
                          ? "primer-label-neutral"
                          : ep.hopCount === 2
                          ? "primer-label-done"
                          : ep.isSelfHop
                          ? "primer-label-sponsors"
                          : "primer-label-accent"
                      }`}
                    >
                      {ep.hopCount === 0
                        ? "0-Hop Direct"
                        : ep.isSelfHop
                        ? "1-Hop Self-Relay"
                        : `${ep.hopCount}-Hop Chain`}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{ep.finalTag}</td>
                  <td>
                    <code>{ep.hopTags.join(" -> ")}</code>
                  </td>
                  <td>
                    <span className="primer-label primer-label-success">
                      {ep.protocolChain.join(" => ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
