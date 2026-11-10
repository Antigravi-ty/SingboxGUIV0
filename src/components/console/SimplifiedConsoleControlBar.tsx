import React, { useEffect, useState } from "react";
import { Spinner, ToggleSwitch } from "@primer/react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCode2,
  FolderOpen,
  Play,
  Radio,
  RotateCcw,
  ShieldAlert,
  Square,
  XCircle,
} from "lucide-react";
import {
  checkBridgePortAvailability,
  openAppConfigFolder,
} from "../../services/tauriGateway";
import { useThemeStore } from "../../stores/themeStore";
import { yieldToNextPaint } from "../../stores/workspaceServiceActions";
import { useWorkspaceStore } from "../../stores/workspaceStore";

function triggerBrowserDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const SimplifiedConsoleControlBar: React.FC = () => {
  const setAdvancedMode = useThemeStore((s) => s.setAdvancedMode);

  const listenIp = useWorkspaceStore((s) => s.listenIp);
  const listenPort = useWorkspaceStore((s) => s.listenPort);
  const autoDetectInterface = useWorkspaceStore((s) => s.autoDetectInterface);
  const setNetworkParams = useWorkspaceStore((s) => s.setNetworkParams);
  const runningMode = useWorkspaceStore((s) => s.runningMode);
  const isCheckingConfig = useWorkspaceStore((s) => s.isCheckingConfig);
  const isStartingService = useWorkspaceStore((s) => s.isStartingService);
  const lastCheckResult = useWorkspaceStore((s) => s.lastCheckResult);
  const runSingboxCheck = useWorkspaceStore((s) => s.runSingboxCheck);
  const startOrStopServiceAction = useWorkspaceStore(
    (s) => s.startOrStopServiceAction
  );
  const directNodes = useWorkspaceStore((s) => s.directNodes);
  const endpoints = useWorkspaceStore((s) => s.endpoints);
  const surgeConfigText = useWorkspaceStore((s) => s.surgeConfigText);
  const singboxConfig = useWorkspaceStore((s) => s.singboxConfig);
  const resetDemoSubscriptions = useWorkspaceStore(
    (s) => s.resetDemoSubscriptions
  );
  const setSecurityPolicy = useWorkspaceStore((s) => s.setSecurityPolicy);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);
  const appendLog = useWorkspaceStore((s) => s.appendLog);

  const [ipInput, setIpInput] = useState(listenIp);
  const [portInput, setPortInput] = useState(String(listenPort));
  const [isApplyingEndpoint, setIsApplyingEndpoint] = useState(false);
  const [isExportingSurge, setIsExportingSurge] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);

  useEffect(() => {
    setIpInput(listenIp);
    setPortInput(String(listenPort));
  }, [listenIp, listenPort]);

  const isServiceRunning = runningMode !== "stopped";
  const chainCount = Math.max(0, endpoints.length - directNodes.length);
  const unpinnedInsecureNodes = directNodes.filter(
    (n) => n.effectiveInsecure && !n.hasCertFingerprintPin
  );
  const pinnedInsecureCount = directNodes.filter(
    (n) => n.effectiveInsecure && n.hasCertFingerprintPin
  ).length;

  const handleApplyIpAndPort = async () => {
    const cleanIp = ipInput.trim() || "127.0.0.1";
    const parsedPort = Math.max(
      1024,
      Math.min(65535, Number(portInput) || 11400)
    );
    setIsApplyingEndpoint(true);
    await yieldToNextPaint();
    try {
      if (!isServiceRunning || cleanIp !== listenIp || parsedPort !== listenPort) {
        const check = await checkBridgePortAvailability(cleanIp, parsedPort);
        if (check.occupied && !isServiceRunning) {
          appendLog(`[WARN][BridgePort] ${check.message}`);
        }
      }
      setNetworkParams({ listenIp: cleanIp, listenPort: parsedPort });
      appendLog(
        `[INFO][BridgePort] Persisted endpoint ${cleanIp}:${parsedPort} to ui-config.json, config.json & aSingbox127.conf.`
      );
    } finally {
      setIsApplyingEndpoint(false);
    }
  };

  const handleStartOrStop = async () => {
    if (!isServiceRunning) {
      const cleanIp = ipInput.trim() || listenIp || "127.0.0.1";
      const parsedPort = Number(portInput) || listenPort || 11400;
      if (cleanIp !== listenIp || parsedPort !== listenPort) {
        setNetworkParams({ listenIp: cleanIp, listenPort: parsedPort });
      }
      await startOrStopServiceAction("start");
    } else {
      await startOrStopServiceAction("stop");
    }
  };

  const handleExportSurgeConf = async () => {
    setIsExportingSurge(true);
    await yieldToNextPaint();
    try {
      await runSingboxCheck();
      triggerBrowserDownload("aSingbox127.conf", surgeConfigText);
      appendLog(
        `[INFO][Export] Exported Surge 5.10 configuration (aSingbox127.conf — D${directNodes.length}+${chainCount} proxies on ${listenIp}:${listenPort}).`
      );
    } finally {
      setIsExportingSurge(false);
    }
  };

  const handleExportSingboxJson = async () => {
    setIsExportingJson(true);
    await yieldToNextPaint();
    try {
      const text = JSON.stringify(singboxConfig, null, 2);
      triggerBrowserDownload("config.json", text);
      appendLog(
        `[INFO][Export] Exported Sing-box 1.14.4 configuration (config.json — ${endpoints.length} SOCKS5 users).`
      );
    } finally {
      setIsExportingJson(false);
    }
  };

  return (
    <div className="panel" style={{ padding: "var(--space-4)", minWidth: 0 }}>
      {/* Row 1: Primary Service, Verify, and Export Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          paddingBottom: "var(--space-3)",
          borderBottom: "1px solid var(--border-muted)",
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
          {/* Start / Stop Service Button with Primer Spinner */}
          <button
            type="button"
            className={`primer-btn ${
              isServiceRunning ? "primer-btn-danger" : "primer-btn-primary"
            }`}
            disabled={isStartingService}
            onClick={handleStartOrStop}
          >
            {isStartingService ? (
              <Spinner size="small" srText={null} />
            ) : isServiceRunning ? (
              <Square size={13} />
            ) : (
              <Play size={13} />
            )}
            <span>
              {isStartingService
                ? isServiceRunning
                  ? "Stopping Service..."
                  : "Starting Service..."
                : isServiceRunning
                ? `Stop Service (:${listenPort})`
                : `Start Service (:${portInput || listenPort})`}
            </span>
          </button>

          {/* Verify Configuration Button with Primer Spinner */}
          <button
            type="button"
            className={`primer-btn ${
              lastCheckResult?.valid === false
                ? "primer-btn-status-danger"
                : lastCheckResult?.valid
                ? "primer-btn-status-success"
                : ""
            }`}
            disabled={isCheckingConfig}
            onClick={() => void runSingboxCheck()}
            title="Write config.json & aSingbox127.conf to Application Support and verify with sing-box check"
          >
            {isCheckingConfig ? (
              <Spinner size="small" srText={null} />
            ) : lastCheckResult?.valid === false ? (
              <XCircle size={13} />
            ) : lastCheckResult?.emptyWorkspace ? (
              <AlertTriangle size={13} />
            ) : (
              <CheckCircle2 size={13} />
            )}
            <span>
              {isCheckingConfig ? "Verifying..." : "Verify Configuration"}
            </span>
          </button>

          {directNodes.length === 0 && (
            <button
              type="button"
              className="primer-btn"
              onClick={resetDemoSubscriptions}
              title="Load sample subscriptions (LC, XF, YY, LT, SE) and chain rules"
            >
              <RotateCcw size={13} />
              <span>Load Sample Nodes</span>
            </button>
          )}
        </div>

        {/* Export Configuration Controls (Surge aSingbox127.conf & Sing-box config.json) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="primer-btn primer-btn-status-accent"
            disabled={isExportingSurge}
            onClick={handleExportSurgeConf}
            title="Sync & Export Surge 5.10 configuration (aSingbox127.conf)"
          >
            {isExportingSurge ? (
              <Spinner size="small" srText={null} />
            ) : (
              <Download size={13} />
            )}
            <span>Export Surge (aSingbox127.conf)</span>
          </button>

          <button
            type="button"
            className="primer-btn"
            disabled={isExportingJson}
            onClick={handleExportSingboxJson}
            title="Export Sing-box 1.14.4 config.json"
          >
            {isExportingJson ? (
              <Spinner size="small" srText={null} />
            ) : (
              <FileCode2 size={13} />
            )}
            <span>Export config.json</span>
          </button>

          <button
            type="button"
            className="primer-btn"
            onClick={() => openAppConfigFolder().catch(() => {})}
            title="Open Application Support directory containing config.json, aSingbox127.conf & ui-config.json"
          >
            <FolderOpen size={13} />
            <span>Open Config Folder</span>
          </button>
        </div>
      </div>

      {/* Row 2: Bind IP, Listen Port, and Enhanced Mode (auto_detect_interface) Switch */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          paddingTop: "var(--space-3)",
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
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
            }}
          >
            <span style={{ color: "var(--fg-muted)", fontWeight: 500 }}>
              Bind IP
            </span>
            <input
              type="text"
              className="primer-input"
              style={{ width: 128, fontFamily: "var(--font-mono)" }}
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
            />
          </label>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
            }}
          >
            <span style={{ color: "var(--fg-muted)", fontWeight: 500 }}>
              SOCKS5 Port
            </span>
            <input
              type="number"
              className="primer-input"
              style={{ width: 92, fontFamily: "var(--font-mono)" }}
              min={1024}
              max={65535}
              value={portInput}
              onChange={(e) => setPortInput(e.target.value)}
            />
          </label>

          <button
            type="button"
            className="primer-btn"
            disabled={isApplyingEndpoint}
            onClick={handleApplyIpAndPort}
            title="Apply Bind IP & Port and persist to ui-config.json"
          >
            {isApplyingEndpoint ? (
              <Spinner size="small" srText={null} />
            ) : (
              <Radio size={13} />
            )}
            <span>Apply IP &amp; Port</span>
          </button>
        </div>

        {/* Native Primer ToggleSwitch for auto_detect_interface (default: ON) */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "4px 10px",
            borderRadius: 6,
            backgroundColor: "var(--bg-canvas-subtle)",
            border: "1px solid var(--border-default)",
          }}
        >
          <span
            id="simplified-autodetect-label"
            style={{ fontSize: 12, fontWeight: 600 }}
          >
            Enhanced Mode (<code>auto_detect_interface</code>)
          </span>
          <ToggleSwitch
            size="small"
            statusLabelPosition="end"
            aria-labelledby="simplified-autodetect-label"
            checked={autoDetectInterface}
            onChange={(checked: boolean) => {
              setNetworkParams({ autoDetectInterface: checked });
              appendLog(
                `[INFO][Config] Persisted route.auto_detect_interface = ${checked} to ui-config.json & config.json`
              );
            }}
          />
        </div>
      </div>

      {/* Unpinned Insecure TLS Warning Banner (only shown when unpinned insecure nodes exist) */}
      {unpinnedInsecureNodes.length > 0 && (
        <div
          className="primer-banner primer-banner-warning"
          style={{ marginTop: "var(--space-3)", flexWrap: "wrap" }}
        >
          <div className="primer-banner-main">
            <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <div className="primer-banner-content">
              <div className="primer-banner-title">
                {unpinnedInsecureNodes.length} Node(s) Have Unpinned{" "}
                <code>skip-cert-verify: true</code>
              </div>
              <div className="primer-banner-description">
                Nodes with <code>insecure: true</code> and no manual SHA-256
                certificate pinning may be vulnerable to MITM tampering.
                {pinnedInsecureCount > 0 &&
                  ` (${pinnedInsecureCount} SHA-256 pinned node(s) are safe and excluded.)`}
              </div>
            </div>
          </div>
          <div className="primer-banner-actions">
            <button
              type="button"
              className="primer-btn primer-card-action-btn"
              onClick={() => setSecurityPolicy("enforce_strict_tls")}
            >
              Force Strict TLS Verify
            </button>
            <button
              type="button"
              className="primer-btn primer-card-action-btn"
              onClick={() => {
                setAdvancedMode(true);
                setActiveTab("security");
              }}
            >
              Inspect Nodes
            </button>
          </div>
        </div>
      )}

      {/* Last Check Output Strip */}
      {lastCheckResult && (
        <div
          style={{
            marginTop: "var(--space-2)",
            fontSize: 11,
            color: "var(--fg-muted)",
            fontFamily: "var(--font-mono)",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span>
            {lastCheckResult.version} • {lastCheckResult.commandOutput}
          </span>
          <span>
            Synced: config.json, aSingbox127.conf, ui-config.json
          </span>
        </div>
      )}
    </div>
  );
};
