import React, { useMemo } from "react";
import { Filter } from "lucide-react";
import { CHAIN_NAMING_SCHEMES } from "../../config/chainNamingPresets";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { ChainNamingSchemeId } from "../../types/chainProxy";

export const ChainRegexNamingTesterPanel: React.FC = () => {
  const namingScheme = useWorkspaceStore((s) => s.namingScheme);
  const setNamingScheme = useWorkspaceStore((s) => s.setNamingScheme);
  const regexTestQuery = useWorkspaceStore((s) => s.regexTestQuery);
  const setRegexTestQuery = useWorkspaceStore((s) => s.setRegexTestQuery);
  const endpoints = useWorkspaceStore((s) => s.endpoints);

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

  return (
    <div className="primer-box" style={{ minWidth: 0 }}>
      <div className="primer-box-header">
        <span>Regex-Friendly Prefix Scheme &amp; Surge Policy Filter Tester</span>
        <span className="primer-label primer-label-success">
          {currentSchemeSpec.shortBadge}
        </span>
      </div>
      <div
        className="primer-box-body"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minWidth: 0,
        }}
      >
        <div
          className="primer-segmented-control"
          style={{ flexWrap: "wrap", height: "auto" }}
        >
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
                style={{ flex: "1 1 110px", whiteSpace: "normal" }}
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
            minWidth: 0,
            overflowX: "auto",
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
              gridTemplateColumns: "auto minmax(0, 1fr)",
              gap: "4px 10px",
              fontSize: 11,
              minWidth: 0,
            }}
          >
            <span style={{ color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
              Direct (0-hop):
            </span>
            <code style={{ wordBreak: "break-all" }}>
              {currentSchemeSpec.directExample}
            </code>
            <span style={{ color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
              1-Hop Chain:
            </span>
            <code style={{ wordBreak: "break-all" }}>
              {currentSchemeSpec.oneHopExample}
            </code>
            <span style={{ color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
              2-Hop Chain:
            </span>
            <code style={{ wordBreak: "break-all" }}>
              {currentSchemeSpec.twoHopExample}
            </code>
            <span style={{ color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
              Self-Hop:
            </span>
            <code style={{ wordBreak: "break-all" }}>
              {currentSchemeSpec.selfHopExample}
            </code>
          </div>
        </div>

        {/* Interactive Regex Cheat-Sheet Pills */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--fg-muted)",
              marginBottom: 6,
            }}
          >
            Click any Regex preset below to test against all {endpoints.length}{" "}
            generated nodes:
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
                style={{
                  whiteSpace: "normal",
                  textAlign: "left",
                  maxWidth: "100%",
                  wordBreak: "break-word",
                }}
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
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          <Filter
            size={14}
            style={{ color: "var(--fg-accent)", flexShrink: 0 }}
          />
          <input
            className="primer-input"
            style={{ flex: "1 1 180px", minWidth: 140 }}
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
            maxHeight: 200,
            overflowY: "auto",
            overflowX: "auto",
            border: "1px solid var(--border-muted)",
            borderRadius: 6,
            padding: "6px 10px",
            backgroundColor: "var(--bg-canvas-inset)",
            fontSize: 11,
            minWidth: 0,
          }}
        >
          {endpoints.length === 0 ? (
            <div style={{ color: "var(--fg-muted)" }}>
              No endpoints generated yet. Import a subscription on the{" "}
              <strong>Subscriptions</strong> tab (or click{" "}
              <strong>Load Sample Topology</strong> above) to test regex
              matching against live nodes.
            </div>
          ) : regexMatchedEndpoints.length === 0 ? (
            <div style={{ color: "var(--fg-muted)" }}>
              No endpoints matched regex <code>{regexTestQuery}</code>.
            </div>
          ) : (
            regexMatchedEndpoints.slice(0, 60).map((ep) => (
              <div
                key={ep.username}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "3px 0",
                  borderBottom: "1px dashed var(--border-muted)",
                  minWidth: "max-content",
                }}
              >
                <span style={{ whiteSpace: "nowrap" }}>
                  <strong style={{ color: "var(--fg-accent)" }}>
                    [{ep.username}]
                  </strong>{" "}
                  {ep.finalTag}
                </span>
                <span
                  style={{
                    color: "var(--fg-muted)",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
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
  );
};
