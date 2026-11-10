import React, { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { MitmRouteActionType } from "../../types/mitm";
import { evaluateUrlAgainstMitmRules } from "../../utils/ansiLogParser";

export const MitmUrlRuleFormAndTester: React.FC = () => {
  const { mitmRules, addMitmRule, endpoints } = useWorkspaceStore();

  const [newRuleName, setNewRuleName] = useState("");
  const [newRulePattern, setNewRulePattern] = useState("");
  const [newRuleAction, setNewRuleAction] =
    useState<MitmRouteActionType>("route_outbound");
  const [newRuleTargetTag, setNewRuleTargetTag] = useState("");
  const [testUrlInput, setTestUrlInput] = useState("");

  const urlEvaluation = useMemo(
    () =>
      testUrlInput.trim()
        ? evaluateUrlAgainstMitmRules(testUrlInput.trim(), "GET", mitmRules)
        : null,
    [testUrlInput, mitmRules]
  );

  const availablePrefixSuggestions = useMemo(() => {
    const prefixes = new Set<string>(["DIRECT", "REJECT"]);
    for (const ep of endpoints.slice(0, 30)) {
      prefixes.add(ep.finalTag);
    }
    return Array.from(prefixes);
  }, [endpoints]);

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

  return (
    <>
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
    </>
  );
};
