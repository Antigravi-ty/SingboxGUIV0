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
  const workingListenPort = useWorkspaceStore((s) => s.workingListenPort);
  const autoDetectInterface = useWorkspaceStore((s) => s.autoDetectInterface);
  const setNetworkParams = useWorkspaceStore((s) => s.setNetworkParams);
  const runningMode = useWorkspaceStore((s) => s.runningMode);
  const stableSlotStatus = useWorkspaceStore((s) => s.stableSlotStatus);
  const workingSlotStatus = useWorkspaceStore((s) => s.workingSlotStatus);
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
  const [workingPortInput, setWorkingPortInput] = useState(
    String(workingListenPort)
  );
  const [isApplyingEndpoint, setIsApplyingEndpoint] = useState(false);
  const [isExportingSurge, setIsExportingSurge] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);

  useEffect(() => {
    setIpInput(listenIp);
    setPortInput(String(listenPort));
    setWorkingPortInput(String(workingListenPort));
  }, [listenIp, listenPort, workingListenPort]);

  const isStableRunning = Boolean(stableSlotStatus?.running);
  const isWorkingRunning = Boolean(workingSlotStatus?.running);
  const isServiceRunning =
    isStableRunning || isWorkingRunning || runningMode !== "stopped";
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
    let parsedWorkingPort = Math.max(
      1024,
      Math.min(65535, Number(workingPortInput) || 11401)
    );
    if (parsedWorkingPort === parsedPort) {
      parsedWorkingPort = parsedPort < 65535 ? parsedPort + 1 : parsedPort - 1;
      setWorkingPortInput(String(parsedWorkingPort));
    }
    setIsApplyingEndpoint(true);
    await yieldToNextPaint();
    try {
      if (
        !isStableRunning ||
        cleanIp !== listenIp ||
        parsedPort !== listenPort
      ) {
        const check = await checkBridgePortAvailability(cleanIp, parsedPort);
        if (check.occupied && !isStableRunning) {
          appendLog(`[WARN][BridgePort] ${check.message}`);
        }
      }
      setNetworkParams({
        listenIp: cleanIp,
        listenPort: parsedPort,
        workingListenPort: parsedWorkingPort,
      });
      appendLog(
        `[INFO][BridgePort] Persisted Stable (${cleanIp}:${parsedPort}) & Working (${cleanIp}:${parsedWorkingPort}) endpoints to ui-config.json, config.stable.json & config.working.json.`
      );
    } finally {
      setIsApplyingEndpoint(false);
    }
  };

  const handleToggleStableCore = async () => {
    if (isStableRunning) {
      await startOrStopServiceAction("stop", "stable");
    } else {
      const cleanIp = ipInput.trim() || listenIp || "127.0.0.1";
      const parsedPort = Number(portInput) || listenPort || 11400;
      const parsedWorkingPort =
        Number(workingPortInput) || workingListenPort || 11401;
      if (
        cleanIp !== listenIp ||
        parsedPort !== listenPort ||
        parsedWorkingPort !== workingListenPort
      ) {
        setNetworkParams({
          listenIp: cleanIp,
          listenPort: parsedPort,
          workingListenPort: parsedWorkingPort,
        });
      }
      await startOrStopServiceAction("start", "stable");
    }
  };

  const handleToggleWorkingCore = async () => {
    if (isWorkingRunning) {
      await startOrStopServiceAction("stop", "working");
    } else {
      const cleanIp = ipInput.trim() || listenIp || "127.0.0.1";
      const parsedPort = Number(portInput) || listenPort || 11400;
      let parsedWorkingPort =
        Number(workingPortInput) || workingListenPort || 11401;
      if (parsedWorkingPort === parsedPort) {
        parsedWorkingPort = parsedPort + 1;
        setWorkingPortInput(String(parsedWorkingPort));
      }
      if (
        cleanIp !== listenIp ||
        parsedPort !== listenPort ||
        parsedWorkingPort !== workingListenPort
      ) {
        setNetworkParams({
          listenIp: cleanIp,
          listenPort: parsedPort,
          workingListenPort: parsedWorkingPort,
        });
      }
      await startOrStopServiceAction("start", "working");
    }
  };

  const handleExportSurgeConf = async () => {
    setIsExportingSurge(true);
    await yieldToNextPaint();
    try {
      await runSingboxCheck(false);
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
      triggerBrowserDownload("config.stable.json", text);
      appendLog(
        `[INFO][Export] Exported Sing-box 1.14.4 configuration (config.stable.json — ${endpoints.length} SOCKS5 users).`
      );
    } finally {
      setIsExportingJson(false);
    }
  };

  return (
    <div className="panel" style={{ padding: "var(--space-4)", minWidth: 0 }}>
      {/* Row 1: Dual Core Controls (Stable vs Working) + Verify / Promote + Export */}
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
          {/* Stable Core Button (Isolated from dynamic editing) */}
          <button
            type="button"
            className={`primer-btn ${
              isStableRunning ? "primer-btn-danger" : "primer-btn-primary"
            }`}
            disabled={isStartingService}
            onClick={handleToggleStableCore}
            title="Launch or stop Stable Core (config.stable.json). Protected from dynamic UI edits until you click Promote or Start Stable."
          >
            {isStartingService ? (
              <Spinner size="small" srText={null} />
            ) : isStableRunning ? (
              <Square size={13} />
            ) : (
              <Play size={13} />
            )}
            <span>
              {isStableRunning
                ? `Stop Stable Core (:${listenPort})`
                : `Launch Stable Core (:${portInput || listenPort})`}
            </span>
          </button>

          {/* Working / Test Core Button (Auto hot-reloads on dynamic UI edits, runs on separate port) */}
          <button
            type="button"
            className={`primer-btn ${
              isWorkingRunning
                ? "primer-btn-status-attention"
                : "primer-btn-status-accent"
            }`}
            disabled={isStartingService}
            onClick={handleToggleWorkingCore}
            title="Launch or stop Working / Test Core (config.working.json) on a separate port. Hot-reloads automatically when you tweak multi-hop or TLS settings without freezing Stable Core."
          >
            {isStartingService ? (
              <Spinner size="small" srText={null} />
            ) : isWorkingRunning ? (
              <Square size={13} />
            ) : (
              <Play size={13} />
            )}
            <span>
              {isWorkingRunning
                ? `Stop Working Core (:${workingListenPort})`
                : `Launch Working Core (:${workingPortInput || workingListenPort})`}
            </span>
          </button>

          {/* Verify Working Config Button */}
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
            onClick={() => void runSingboxCheck(false)}
            title="Validate config.working.json with sing-box check (does NOT overwrite config.stable.json)"
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
              {isCheckingConfig ? "Verifying..." : "Verify Working"}
            </span>
          </button>

          {/* Promote Working -> Stable Snapshot Button */}
          <button
            type="button"
            className="primer-btn"
            disabled={isCheckingConfig}
            onClick={() => void runSingboxCheck(true)}
            title="Promote and save current Working configuration into config.stable.json & aSingbox127.stable.conf"
          >
            <CheckCircle2 size={13} />
            <span>Promote Working → Stable</span>
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
            title="Export Sing-box 1.14.4 config.stable.json"
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
            title="Open Application Support directory containing config.stable.json, config.working.json, aSingbox127.conf & ui-config.json"
          >
            <FolderOpen size={13} />
            <span>Open Config Folder</span>
          </button>
        </div>
      </div>

      {/* Row 2: Bind IP, Stable Port, Working Port, and Enhanced Mode (auto_detect_interface) Switch */}
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
              style={{ width: 120, fontFamily: "var(--font-mono)" }}
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
            title="Port used by config.stable.json (Stable Production Core)"
          >
            <span style={{ color: "var(--fg-muted)", fontWeight: 500 }}>
              Stable Port
            </span>
            <input
              type="number"
              className="primer-input"
              style={{ width: 86, fontFamily: "var(--font-mono)" }}
              min={1024}
              max={65535}
              value={portInput}
              onChange={(e) => setPortInput(e.target.value)}
            />
          </label>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
            }}
            title="Port used by config.working.json (Dynamic Hot-Reload Test Core)"
          >
            <span style={{ color: "var(--fg-muted)", fontWeight: 500 }}>
              Working Port
            </span>
            <input
              type="number"
              className="primer-input"
              style={{ width: 86, fontFamily: "var(--font-mono)" }}
              min={1024}
              max={65535}
              value={workingPortInput}
              onChange={(e) => setWorkingPortInput(e.target.value)}
            />
          </label>

          <button
            type="button"
            className="primer-btn"
            disabled={isApplyingEndpoint}
            onClick={handleApplyIpAndPort}
            title="Apply Bind IP, Stable Port & Working Port and persist to ui-config.json"
          >
            {isApplyingEndpoint ? (
              <Spinner size="small" srText={null} />
            ) : (
              <Radio size={13} />
            )}
            <span>Apply Ports</span>
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
                `[INFO][Config] Persisted route.auto_detect_interface = ${checked} to ui-config.json & config.working.json`
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
            Profiles: config.stable.json (:{listenPort}){" "}
            {isStableRunning ? "[RUNNING]" : "[STANDBY]"} | config.working.json
            (:{workingListenPort}) {isWorkingRunning ? "[RUNNING]" : "[HOT-RELOAD]"}
          </span>
        </div>
      )}
    </div>
  );
};
