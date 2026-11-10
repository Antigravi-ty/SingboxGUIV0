import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  FolderCode,
  Play,
  RefreshCw,
} from "lucide-react";
import { checkCoreBinaryStatus } from "../../services/tauriGateway";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { BinaryStatusInfo } from "../../types/singbox";

export const CoreBinaryValidatorPanel: React.FC = () => {
  const { lastCheckResult, runSingboxCheck, appendLog } = useWorkspaceStore();
  const [isChecking, setIsChecking] = useState(false);
  const [binaryStatus, setBinaryStatus] = useState<BinaryStatusInfo | null>(
    null
  );

  const refreshBinaryStatus = () => {
    checkCoreBinaryStatus()
      .then((info) => setBinaryStatus(info))
      .catch(() => {});
  };

  useEffect(() => {
    refreshBinaryStatus();
  }, []);

  const handleRunSingboxCheck = async () => {
    setIsChecking(true);
    try {
      refreshBinaryStatus();
      await runSingboxCheck();
      const latest = useWorkspaceStore.getState().lastCheckResult;
      if (latest) {
        appendLog(
          latest.valid
            ? `[INFO][sing-box] ${latest.version} — ${latest.commandOutput}`
            : `[ERROR][sing-box] ${latest.commandOutput}`
        );
      }
    } finally {
      setIsChecking(false);
    }
  };

  return (
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
          <Cpu size={18} style={{ color: "var(--accent-fg)", flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
              Sing-box 1.14.4 Stable Schema &amp; Local Binary Verifier
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>
              Validates <code>route.default_domain_resolver</code>,{" "}
              <code>domain_resolver</code> per outbound, Hysteria2{" "}
              <code>server_ports</code> (<code>61000:62000</code>), Reality uTLS,
              and AnyTLS schema.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={refreshBinaryStatus}
            title="Re-scan ./bin/sing-box and ./src-tauri/binaries/sing-box"
          >
            <RefreshCw size={13} />
            Rescan Binary
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleRunSingboxCheck}
            disabled={isChecking}
          >
            <Play size={14} />
            {isChecking ? "Checking..." : "Run sing-box check"}
          </button>
        </div>
      </div>

      {binaryStatus && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "8px 10px",
            borderRadius: 6,
            backgroundColor: "var(--bg-canvas-subtle)",
            border: "1px solid var(--border-default)",
            marginBottom: "var(--space-3)",
            fontSize: 11.5,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              className={`badge ${
                binaryStatus.imported ? "badge-success" : "badge-warning"
              }`}
            >
              {binaryStatus.imported
                ? `Binary Ready: sing-box ${binaryStatus.version || "1.14.4"}`
                : "Local Binary Not Found (Using Built-in 1.14.4 Schema Validator)"}
            </span>
            {binaryStatus.binary_path && (
              <code style={{ color: "var(--fg-muted)" }}>
                {binaryStatus.binary_path}
              </code>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 6,
              color: "var(--fg-muted)",
              fontSize: 11,
              lineHeight: 1.45,
            }}
          >
            <FolderCode size={13} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Recommended Local Placement (Git-Ignored):</strong> Put
              your <code>sing-box</code> 1.14.4 binary in{" "}
              <code>./bin/sing-box</code> (Vite &amp; project root) or{" "}
              <code>./src-tauri/binaries/sing-box</code> (Tauri v2 sidecar
              standard). Both paths are excluded in <code>.gitignore</code> so
              the binary will never be uploaded to Git.
            </div>
          </div>
        </div>
      )}

      {lastCheckResult && (
        <div
          style={{
            padding: "var(--space-3)",
            borderRadius: "6px",
            background: lastCheckResult.valid
              ? "var(--success-subtle)"
              : "var(--danger-subtle)",
            border: `1px solid ${
              lastCheckResult.valid ? "var(--success-fg)" : "var(--danger-fg)"
            }`,
            fontSize: "var(--text-xs)",
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
          }}
        >
          {lastCheckResult.valid ? (
            <CheckCircle2
              size={16}
              style={{
                color: "var(--success-fg)",
                flexShrink: 0,
                marginTop: "2px",
              }}
            />
          ) : (
            <AlertCircle
              size={16}
              style={{
                color: "var(--danger-fg)",
                flexShrink: 0,
                marginTop: "2px",
              }}
            />
          )}
          <div style={{ minWidth: 0, wordBreak: "break-word" }}>
            <div style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>
              {lastCheckResult.version} ({lastCheckResult.checkedAt})
            </div>
            <div
              style={{
                color: "var(--fg-muted)",
                fontFamily: "var(--font-mono)",
                marginTop: "2px",
              }}
            >
              {lastCheckResult.commandOutput}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
