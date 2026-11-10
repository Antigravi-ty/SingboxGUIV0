import React, { useState } from "react";
import {
  Activity,
  CheckCircle2,
  Play,
  Radio,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  CONNECTIVITY_TEST_METHODS,
  CONNECTIVITY_TEST_PRESETS,
} from "../../config/connectivityPresets";
import { runConnectivityDiagnostic } from "../../services/tauriGateway";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import {
  ConnectivityTestMethod,
  ConnectivityTestResult,
} from "../../types/singbox";

export const ConnectivityDiagnosticPanel: React.FC = () => {
  const { listenIp, listenPort, endpoints, appendLog } = useWorkspaceStore();

  const [selectedMethod, setSelectedMethod] =
    useState<ConnectivityTestMethod>("http_fetch");
  const [selectedPresetId, setSelectedPresetId] =
    useState<string>("google_204");
  const [customTargetInput, setCustomTargetInput] = useState<string>("");
  const [selectedSocksUser, setSelectedSocksUser] = useState<string>("000");
  const [isRunningTest, setIsRunningTest] = useState<boolean>(false);
  const [testHistory, setTestHistory] = useState<ConnectivityTestResult[]>([]);

  const activePreset = CONNECTIVITY_TEST_PRESETS.find(
    (p) => p.id === selectedPresetId
  );
  const effectiveTarget =
    selectedPresetId === "custom"
      ? customTargetInput.trim() || "https://www.gstatic.com/generate_204"
      : activePreset?.target || "https://www.gstatic.com/generate_204";

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const found = CONNECTIVITY_TEST_PRESETS.find((p) => p.id === presetId);
    if (found && selectedMethod !== "socks5_http") {
      setSelectedMethod(found.recommendedMethod);
    }
  };

  const handleRunProbe = async () => {
    setIsRunningTest(true);
    try {
      const res = await runConnectivityDiagnostic({
        method: selectedMethod,
        target: effectiveTarget,
        socksHost: listenIp,
        socksPort: listenPort,
        socksUser: selectedSocksUser,
        socksPass: "0",
        timeoutMs: 6000,
      });
      setTestHistory((prev) => [res, ...prev.slice(0, 14)]);
      appendLog(
        res.success
          ? `[INFO][Connectivity] [${res.method.toUpperCase()}] ${res.target} -> ${res.detail}`
          : `[ERROR][Connectivity] [${res.method.toUpperCase()}] ${res.target} -> ${res.detail}`
      );
    } finally {
      setIsRunningTest(false);
    }
  };

  const handleRunQuickMatrix = async () => {
    setIsRunningTest(true);
    try {
      const quickTargets: Array<{
        method: ConnectivityTestMethod;
        target: string;
      }> = [
        {
          method: "http_fetch",
          target: "https://www.gstatic.com/generate_204",
        },
        {
          method: "http_fetch",
          target: "http://cp.cloudflare.com/generate_204",
        },
        { method: "tcp_ping", target: "1.1.1.1:443" },
        { method: "tcp_ping", target: "8.8.8.8:443" },
      ];
      for (const item of quickTargets) {
        const res = await runConnectivityDiagnostic({
          method: item.method,
          target: item.target,
          socksHost: listenIp,
          socksPort: listenPort,
          socksUser: selectedSocksUser,
          socksPass: "0",
          timeoutMs: 5000,
        });
        setTestHistory((prev) => [res, ...prev.slice(0, 14)]);
        appendLog(
          res.success
            ? `[INFO][Connectivity] [${res.method.toUpperCase()}] ${res.target} -> ${res.detail}`
            : `[WARN][Connectivity] [${res.method.toUpperCase()}] ${res.target} -> ${res.detail}`
        );
      }
    } finally {
      setIsRunningTest(false);
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
          gap: 10,
          marginBottom: "var(--space-3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Activity
            size={17}
            style={{ color: "var(--accent-fg)", flexShrink: 0 }}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
              Self-Connectivity &amp; Multi-Protocol Diagnostic Suite
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>
              Test host reachability or local Sing-box SOCKS5 bridge via{" "}
              <code>HTTP 204</code> (Google / Cloudflare),{" "}
              <code>1.1.1.1 / 8.8.8.8</code> TCP handshake, or ICMP Ping.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleRunQuickMatrix}
            disabled={isRunningTest}
            title="Run Google 204, Cloudflare 204, 1.1.1.1:443, and 8.8.8.8:443 probes sequentially"
          >
            <Radio size={13} />
            Run 4-Point Matrix
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleRunProbe}
            disabled={isRunningTest}
          >
            <Play size={13} />
            {isRunningTest ? "Probing..." : "Run Connectivity Check"}
          </button>
        </div>
      </div>

      {/* 1. Segmented Control for Test Method */}
      <div style={{ marginBottom: "var(--space-3)" }}>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            marginBottom: 6,
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          <span>1. Diagnostic Method (Primer Segmented Control)</span>
          <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>
            {
              CONNECTIVITY_TEST_METHODS.find((m) => m.id === selectedMethod)
                ?.description
            }
          </span>
        </div>
        <div className="primer-segmented-control" style={{ flexWrap: "wrap" }}>
          {CONNECTIVITY_TEST_METHODS.map((m) => {
            const active = selectedMethod === m.id;
            return (
              <button
                key={m.id}
                type="button"
                className={`primer-segmented-button ${
                  active ? "primer-segmented-button-active" : ""
                }`}
                onClick={() => setSelectedMethod(m.id)}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional SOCKS5 User Selector when method === socks5_http */}
      {selectedMethod === "socks5_http" && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            backgroundColor: "var(--bg-canvas-subtle)",
            border: "1px solid var(--border-default)",
            marginBottom: "var(--space-3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
            fontSize: 12,
          }}
        >
          <span>
            SOCKS5 Bridge Endpoint: <code>{listenIp}:{listenPort}</code> — Select
            Authenticated Node User:
          </span>
          <select
            className="select-input"
            style={{ width: "auto", minWidth: 260, fontFamily: "var(--font-mono)" }}
            value={selectedSocksUser}
            onChange={(e) => setSelectedSocksUser(e.target.value)}
          >
            {endpoints.length === 0 ? (
              <option value="000">000 (Default SOCKS5 User)</option>
            ) : (
              endpoints.slice(0, 80).map((ep) => (
                <option key={ep.username} value={ep.username}>
                  user={ep.username} -&gt; {ep.finalTag} ({ep.protocolChain.join("->")})
                </option>
              ))
            )}
          </select>
        </div>
      )}

      {/* 2. Primer Selectable List (Radio List) for Target Address */}
      <div style={{ marginBottom: "var(--space-3)" }}>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            marginBottom: 6,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>
            2. Target Endpoint Address (Primer Selectable Radio List)
          </span>
          <code style={{ fontSize: 11, color: "var(--fg-accent)" }}>
            Active: {effectiveTarget}
          </code>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 6,
          }}
        >
          {CONNECTIVITY_TEST_PRESETS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleSelectPreset(preset.id)}
                className={`primer-snippet-row-btn ${
                  isSelected ? "primer-snippet-row-selected" : ""
                }`}
                style={{ cursor: "pointer", padding: "7px 10px" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    minWidth: 0,
                  }}
                >
                  <input
                    type="radio"
                    readOnly
                    checked={isSelected}
                    style={{ marginTop: 3, pointerEvents: "none" }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <span>{preset.label}</span>
                      <span className="primer-label primer-label-neutral">
                        {preset.category}
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--fg-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {preset.target}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {/* Custom Target Radio Option */}
          <div
            onClick={() => setSelectedPresetId("custom")}
            className={`primer-snippet-row-btn ${
              selectedPresetId === "custom" ? "primer-snippet-row-selected" : ""
            }`}
            style={{ cursor: "pointer", padding: "7px 10px" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
              }}
            >
              <input
                type="radio"
                readOnly
                checked={selectedPresetId === "custom"}
              />
              <input
                type="text"
                className="text-input"
                style={{
                  flex: 1,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  padding: "4px 8px",
                }}
                placeholder="Custom URL or IP:Port (e.g. https://cp.cloudflare.com/generate_204 or 1.1.1.1:443)"
                value={customTargetInput}
                onFocus={() => setSelectedPresetId("custom")}
                onChange={(e) => {
                  setSelectedPresetId("custom");
                  setCustomTargetInput(e.target.value);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Probe Results Table */}
      {testHistory.length > 0 && (
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
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setTestHistory([])}
            >
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
      )}
    </div>
  );
};
