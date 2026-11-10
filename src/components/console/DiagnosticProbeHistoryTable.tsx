import React from "react";
import { CheckCircle2, Trash2, XCircle } from "lucide-react";
import { ConnectivityTestResult } from "../../types/singbox";

interface DiagnosticProbeHistoryTableProps {
  testHistory: ConnectivityTestResult[];
  onClear: () => void;
}

export const DiagnosticProbeHistoryTable: React.FC<
  DiagnosticProbeHistoryTableProps
> = ({ testHistory, onClear }) => {
  if (testHistory.length === 0) return null;

  return (
    <div
      style={{
        borderTop: "1px solid var(--border-default)",
        paddingTop: "var(--space-2)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 11.5, fontWeight: 600 }}>
          Recent Diagnostic Probes ({testHistory.length})
        </span>
        <button type="button" className="btn btn-sm" onClick={onClear}>
          <Trash2 size={11} />
          Clear Probes
        </button>
      </div>
      <div className="primer-datatable-scroll" style={{ maxHeight: 190 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Method</th>
              <th>Target</th>
              <th>Latency</th>
              <th>Detail</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {testHistory.map((item, idx) => (
              <tr key={`${item.testedAt}_${idx}`}>
                <td>
                  {item.success ? (
                    <span className="badge badge-success">
                      <CheckCircle2 size={11} /> PASS
                    </span>
                  ) : (
                    <span className="badge badge-danger">
                      <XCircle size={11} /> FAIL
                    </span>
                  )}
                </td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  {item.method}
                </td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  {item.target}
                </td>
                <td
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    color: item.success
                      ? "var(--success-fg)"
                      : "var(--danger-fg)",
                  }}
                >
                  {item.latency_ms} ms
                </td>
                <td style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                  {item.detail}
                </td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
                  {item.testedAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
