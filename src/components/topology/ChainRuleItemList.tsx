import React from "react";
import { Trash2 } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspaceStore";

export const ChainRuleItemList: React.FC = () => {
  const visualEdges = useWorkspaceStore((s) => s.visualEdges);
  const chainRules = useWorkspaceStore((s) => s.chainRules);
  const selectedChainRuleId = useWorkspaceStore((s) => s.selectedChainRuleId);
  const selectChainRule = useWorkspaceStore((s) => s.selectChainRule);
  const toggleChainRule = useWorkspaceStore((s) => s.toggleChainRule);
  const deleteChainRule = useWorkspaceStore((s) => s.deleteChainRule);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        marginTop: 4,
      }}
    >
      {chainRules.length === 0 && (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--fg-muted)",
            padding: "6px 2px",
          }}
        >
          No chain rules configured yet. Direct (0-hop) SOCKS5 endpoints are
          generated automatically for all active subscription nodes.
        </div>
      )}
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
  );
};
