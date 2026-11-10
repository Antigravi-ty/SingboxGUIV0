import React from "react";
import { Terminal, Trash2 } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { ConnectivityDiagnosticPanel } from "./ConnectivityDiagnosticPanel";
import { CoreBinaryValidatorPanel } from "./CoreBinaryValidatorPanel";
import { SocksBridgeEndpointPanel } from "./SocksBridgeEndpointPanel";

export const CoreConsoleAndLogsView: React.FC = () => {
  const { logs, clearLogs } = useWorkspaceStore();

  return (
    <div className="view-container">
      {/* Top Runtime Settings & Binary Validator */}
      <div className="responsive-two-col-grid">
        <CoreBinaryValidatorPanel />
        <SocksBridgeEndpointPanel />
      </div>

      {/* Self-Connectivity & Multi-Protocol Diagnostic Suite */}
      <ConnectivityDiagnosticPanel />

      {/* Console Log Stream */}
      <div className="panel" style={{ padding: "var(--space-4)", minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "var(--space-3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Terminal
              size={16}
              style={{ color: "var(--accent-fg)", flexShrink: 0 }}
            />
            <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
              Sing-box 1.14.4 &amp; Converter Telemetry Console ({logs.length}{" "}
              entries)
            </span>
          </div>
          <button type="button" className="btn btn-sm" onClick={clearLogs}>
            <Trash2 size={12} />
            Clear Console
          </button>
        </div>

        <div
          className="code-block"
          style={{
            maxHeight: "320px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: "var(--fg-muted)" }}>
              No console logs recorded.
            </div>
          ) : (
            logs.map((entry) => {
              const levelColor =
                entry.level === "ERROR" || entry.level === "FATAL"
                  ? "var(--danger-fg)"
                  : entry.level === "WARN"
                  ? "var(--warning-fg)"
                  : entry.level === "DEBUG"
                  ? "var(--fg-muted)"
                  : "var(--success-fg)";
              return (
                <div
                  key={entry.id}
                  style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}
                >
                  <span style={{ color: "var(--fg-muted)" }}>
                    [{entry.timestamp}]{" "}
                  </span>
                  <span style={{ color: levelColor, fontWeight: 600 }}>
                    [{entry.level}]
                  </span>{" "}
                  <span style={{ color: "var(--accent-fg)" }}>
                    [{entry.source}]
                  </span>{" "}
                  <span>{entry.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
