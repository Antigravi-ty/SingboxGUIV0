import React, { useMemo, useState } from "react";
import {
  Play,
  Plus,
  RotateCcw,
  Route,
  Search,
  Trash2,
} from "lucide-react";
import {
  sniffAvailableMitmPort,
  toggleMitmEngineListener,
} from "../../services/tauriGateway";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { MitmRouteActionType } from "../../types/mitm";
import { evaluateUrlAgainstMitmRules } from "../../utils/ansiLogParser";
import { MitmRootCaValidatorPanel } from "./MitmRootCaValidatorPanel";

export const MitmRoutingView: React.FC = () => {
  const {
    mitmRules,
    addMitmRule,
    toggleMitmRule,
    deleteMitmRule,
    loadSampleMitmRules,
    endpoints,
    appendLog,
  } = useWorkspaceStore();

  const [mitmRunning, setMitmRunning] = useState(false);
  const [mitmPort, setMitmPort] = useState(8080);

  // New URL Regex Rule form state
  const [newRuleName, setNewRuleName] = useState("");
  const [newRulePattern, setNewRulePattern] = useState("");
  const [newRuleAction, setNewRuleAction] =
    useState<MitmRouteActionType>("route_outbound");
  const [newRuleTargetTag, setNewRuleTargetTag] = useState("");

  // Live URL Regex Tester
  const [testUrlInput, setTestUrlInput] = useState("");

  const urlEvaluation = useMemo(
    () =>
      testUrlInput.trim()
        ? evaluateUrlAgainstMitmRules(testUrlInput.trim(), "GET", mitmRules)
        : null,
    [testUrlInput, mitmRules]
  );

  const handleToggleMitm = async () => {
    const nextState = !mitmRunning;
    const res = await toggleMitmEngineListener(nextState, mitmPort);
    setMitmRunning(res.enabled);
    appendLog(`[INFO][MITM] ${res.message}`);
  };

  const handleSniffPort = async () => {
    const port = await sniffAvailableMitmPort(mitmPort);
    setMitmPort(port);
    appendLog(`[INFO][MITM] Sniffed available local TCP port: ${port}`);
  };

  const handleCreateRule = () => {
    if (!newRuleName.trim() || !newRulePattern.trim()) return;
    addMitmRule({
      name: newRuleName.trim(),
      urlRegex: newRulePattern.trim(),
      methods: ["*"],
      actionType: newRuleAction,
      targetOutboundOrGroup: newRuleTargetTag.trim() || "DIRECT",
      enabled: true,
      note: "Custom URL Regex routing rule",
    });
    setNewRuleName("");
    setNewRulePattern("");
    setNewRuleTargetTag("");
  };

  const availablePrefixSuggestions = useMemo(() => {
    const prefixes = new Set<string>(["DIRECT", "REJECT"]);
    for (const ep of endpoints.slice(0, 30)) {
      prefixes.add(ep.finalTag);
    }
    return Array.from(prefixes);
  }, [endpoints]);

  return (
    <div className="view-container">
      {/* MITM Engine Header & Port Controls */}
      <div className="panel" style={{ padding: "var(--space-4)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--space-3)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
            }}
          >
            <Route
              size={18}
              style={{ color: "var(--accent-fg)", flexShrink: 0 }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: "var(--text-md)" }}>
                MITM Engine &amp; Native URL Regex Routing (Surge Decoupling
                Layer)
              </div>
              <div
                style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}
              >
                Combines <code>sbagrepo</code> TLS SNI/HTTP sniffing and Root CA
                MITM inspection with regex-based outbound dispatch so URL regex
                rules can gradually transition off Surge 5.10.
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}
            >
              MITM Listen Port:
            </span>
            <input
              type="number"
              className="text-input"
              style={{ width: "90px", fontFamily: "var(--font-mono)" }}
              value={mitmPort}
              onChange={(e) => setMitmPort(Number(e.target.value) || 8080)}
            />
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleSniffPort}
              title="Find an available local TCP port"
            >
              Auto-Sniff Port
            </button>
            <button
              type="button"
              className={`btn btn-sm ${
                mitmRunning ? "btn-danger" : "btn-primary"
              }`}
              onClick={handleToggleMitm}
            >
              <Play size={14} />
              {mitmRunning ? "Stop MITM Sniffer" : "Start MITM Sniffer"}
            </button>
          </div>
        </div>
      </div>

      {/* Two-Column Layout: URL Regex Routing Table + 4-Step CA Validator */}
      <div className="topology-two-col-grid">
        {/* Left: URL Regex Routing Rules & Live Tester */}
        <div
          className="panel"
          style={{
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
              URL Regex Routing Rules ({mitmRules.length})
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="btn btn-sm"
                onClick={loadSampleMitmRules}
                title="Load built-in sample URL regex rules for testing"
              >
                <RotateCcw size={12} />
                Load Sample Rules
              </button>
              <span className="badge badge-accent">
                HTTP/HTTPS Host + Path Regex
              </span>
            </div>
          </div>

          {/* Live URL Matcher Box */}
          <div
            style={{
              padding: "var(--space-3)",
              borderRadius: "6px",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "6px",
              }}
            >
              <Search
                size={14}
                style={{ color: "var(--accent-fg)", flexShrink: 0 }}
              />
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}>
                Live URL Regex Routing Simulator
              </span>
            </div>
            <input
              type="text"
              className="text-input"
              style={{
                width: "100%",
                fontFamily: "var(--font-mono)",
                marginBottom: "8px",
              }}
              value={testUrlInput}
              onChange={(e) => setTestUrlInput(e.target.value)}
              placeholder="Enter full URL to test routing match (e.g. https://api.openai.com/v1/chat/completions)..."
            />
            <div
              style={{
                fontSize: "var(--text-xs)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: "var(--fg-muted)" }}>Matched Dispatch:</span>
              {!urlEvaluation ? (
                <span className="badge badge-neutral">
                  Enter a URL above to simulate rule evaluation
                </span>
              ) : urlEvaluation.matched && urlEvaluation.matchedRule ? (
                <span
                  className="badge badge-success"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {urlEvaluation.matchedRule.name} -&gt;{" "}
                  {urlEvaluation.actionSummary}
                </span>
              ) : (
                <span className="badge">{urlEvaluation.actionSummary}</span>
              )}
            </div>
          </div>

          {/* Add New URL Regex Rule */}
          <div className="responsive-form-grid">
            <input
              type="text"
              className="text-input"
              placeholder="Rule Name (e.g. OpenAI API)"
              value={newRuleName}
              onChange={(e) => setNewRuleName(e.target.value)}
            />
            <input
              type="text"
              className="text-input"
              style={{ fontFamily: "var(--font-mono)" }}
              placeholder="^https?://([a-z0-9-]+\.)?openai\.com/"
              value={newRulePattern}
              onChange={(e) => setNewRulePattern(e.target.value)}
            />
            <select
              className="select-input"
              value={newRuleAction}
              onChange={(e) =>
                setNewRuleAction(e.target.value as MitmRouteActionType)
              }
            >
              <option value="route_outbound">Route Outbound</option>
              <option value="inject_header">Inject Header</option>
              <option value="rewrite_url">Rewrite URL</option>
              <option value="mock_response">Mock Response</option>
              <option value="reject_request">Reject Request</option>
            </select>
            <input
              type="text"
              className="text-input"
              list="mitm-outbound-suggestions"
              style={{ fontFamily: "var(--font-mono)" }}
              placeholder="Target Prefix/Tag (e.g. YY-)"
              value={newRuleTargetTag}
              onChange={(e) => setNewRuleTargetTag(e.target.value)}
            />
            <datalist id="mitm-outbound-suggestions">
              {availablePrefixSuggestions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleCreateRule}
            >
              <Plus size={14} />
              Add Rule
            </button>
          </div>

          <div className="primer-datatable-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>On</th>
                  <th>Name</th>
                  <th>URL Regex Pattern</th>
                  <th>Action</th>
                  <th>Target Outbound / Group</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {mitmRules.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        textAlign: "center",
                        padding: "18px 12px",
                        color: "var(--fg-muted)",
                      }}
                    >
                      No MITM URL regex rules configured yet. Add a rule above
                      or click <strong>Load Sample Rules</strong>.
                    </td>
                  </tr>
                ) : (
                  mitmRules.map((rule) => (
                    <tr key={rule.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => toggleMitmRule(rule.id)}
                        />
                      </td>
                      <td style={{ fontWeight: 600 }}>{rule.name}</td>
                      <td
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                        }}
                      >
                        {rule.urlRegex}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            rule.actionType === "route_outbound"
                              ? "badge-accent"
                              : rule.actionType === "reject_request"
                              ? "badge-danger"
                              : "badge-success"
                          }`}
                        >
                          {rule.actionType}
                        </span>
                      </td>
                      <td
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                        }}
                      >
                        {rule.targetOutboundOrGroup}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => deleteMitmRule(rule.id)}
                          title="Delete rule"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: 4-Step MITM Root CA Certificate Validator */}
        <MitmRootCaValidatorPanel />
      </div>
    </div>
  );
};
