import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Play,
  Radio,
  Settings,
  Square,
} from "lucide-react";
import {
  checkBridgePortAvailability,
  getSingboxServiceStatus,
  openAppConfigFolder,
  startSingboxService,
  stopSingboxService,
} from "../../services/tauriGateway";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { PortAvailabilityResult } from "../../types/singbox";

export const SocksBridgeEndpointPanel: React.FC = () => {
  const {
    listenIp,
    listenPort,
    autoDetectInterface,
    includeSurgeProxyGroups,
    setNetworkParams,
    runningMode,
    setRunningMode,
    appendLog,
  } = useWorkspaceStore();

  const [ipInput, setIpInput] = useState(listenIp);
  const [portInput, setPortInput] = useState(String(listenPort));
  const [isCheckingPort, setIsCheckingPort] = useState(false);
  const [activePid, setActivePid] = useState<number | null>(null);
  const [activeConfigPath, setActiveConfigPath] = useState<string>("");
  const [portCheckStatus, setPortCheckStatus] =
    useState<PortAvailabilityResult | null>(null);
  const seenLogLinesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setIpInput(listenIp);
    setPortInput(String(listenPort));
  }, [listenIp, listenPort]);

  useEffect(() => {
    let cancelled = false;
    const syncStatus = async () => {
      try {
        const st = await getSingboxServiceStatus();
        if (cancelled) return;
        setActivePid(st.pid);
        if (st.config_path) setActiveConfigPath(st.config_path);
        setRunningMode(st.running ? "normal" : "stopped");
        for (const line of st.recent_logs || []) {
          if (!seenLogLinesRef.current.has(line)) {
            seenLogLinesRef.current.add(line);
            appendLog(`[INFO][sing-box] ${line}`);
          }
        }
      } catch {}
    };
    syncStatus();
    const timer = setInterval(syncStatus, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [appendLog, setRunningMode]);

  const handleApplyAndVerifyPort = async () => {
    const parsedPort = Number(portInput) || 11400;
    const cleanIp = ipInput.trim() || "127.0.0.1";
    setIsCheckingPort(true);
    try {
      // If our own managed service is running and we are changing ports, stop it first or hot-reload via setNetworkParams
      if (runningMode !== "stopped" && parsedPort === listenPort && cleanIp === listenIp) {
        setPortCheckStatus({
          port: parsedPort,
          host: cleanIp,
          occupied: false,
          available: true,
          message: `Managed sing-box service (PID ${activePid || "active"}) is currently listening on ${cleanIp}:${parsedPort}.`,
        });
        return;
      }
      const checkRes = await checkBridgePortAvailability(cleanIp, parsedPort);
      setPortCheckStatus(checkRes);
      if (checkRes.occupied) {
        appendLog(`[ERROR][BridgePort] ${checkRes.message}`);
      } else {
        setNetworkParams({
          listenIp: cleanIp,
          listenPort: parsedPort,
        });
        appendLog(
          `[INFO][BridgePort] Applied & synced SOCKS5 Bridge endpoint ${cleanIp}:${parsedPort} to config.json and aSingbox127.conf (${checkRes.message})`
        );
      }
    } finally {
      setIsCheckingPort(false);
    }
  };

  const handleForceApplyPort = () => {
    const parsedPort = Number(portInput) || 11400;
    const cleanIp = ipInput.trim() || "127.0.0.1";
    setNetworkParams({
      listenIp: cleanIp,
      listenPort: parsedPort,
    });
    appendLog(
      `[WARN][BridgePort] Updated & synced SOCKS5 Bridge port to ${cleanIp}:${parsedPort} in Application Support config.json and aSingbox127.conf.`
    );
  };

  const handleToggleService = async () => {
    setIsCheckingPort(true);
    try {
      if (runningMode !== "stopped") {
        const res = await stopSingboxService();
        setActivePid(null);
        setRunningMode("stopped");
        seenLogLinesRef.current.clear();
        appendLog(`[INFO][Service] ${res.message}`);
        return;
      }

      const parsedPort = Number(portInput) || listenPort || 11400;
      const cleanIp = ipInput.trim() || listenIp || "127.0.0.1";

      if (parsedPort !== listenPort || cleanIp !== listenIp) {
        setNetworkParams({
          listenIp: cleanIp,
          listenPort: parsedPort,
        });
      }

      const stateNow = useWorkspaceStore.getState();
      const jsonText = JSON.stringify(stateNow.singboxConfig, null, 2);
      const surgeText = stateNow.surgeConfigText;

      const startRes = await startSingboxService(jsonText, surgeText);
      setActivePid(startRes.pid);
      setActiveConfigPath(startRes.config_path);
      setRunningMode(startRes.running ? "normal" : "stopped");
      appendLog(`[INFO][Service] ${startRes.message}`);
      for (const line of startRes.recent_logs || []) {
        seenLogLinesRef.current.add(line);
        appendLog(`[INFO][sing-box] ${line}`);
      }
    } catch (err: any) {
      setRunningMode("stopped");
      setActivePid(null);
      appendLog(
        `[ERROR][Service] Failed to start sing-box service: ${
          err?.message || String(err)
        }`
      );
    } finally {
      setIsCheckingPort(false);
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
          <Settings
            size={16}
            style={{ color: "var(--accent-fg)", flexShrink: 0 }}
          />
          <div>
            <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
              Local SOCKS5 Bridge Port &amp; Live Sing-box Process Control
            </span>
            {activePid && (
              <span
                className="badge badge-success"
                style={{ marginLeft: 8, fontSize: 10.5 }}
              >
                PID {activePid} Active
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => openAppConfigFolder().catch(() => {})}
            title={activeConfigPath || "Open Application Support folder"}
          >
            <FolderOpen size={13} />
            Open Folder
          </button>
          <button
            type="button"
            className={`btn btn-sm ${
              runningMode !== "stopped" ? "btn-danger" : "btn-primary"
            }`}
            onClick={handleToggleService}
            disabled={isCheckingPort}
          >
            {runningMode !== "stopped" ? (
              <>
                <Square size={13} />
                <span>Stop Service ({listenPort})</span>
              </>
            ) : (
              <>
                <Play size={13} />
                <span>Start Service ({portInput})</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          alignItems: "flex-end",
          marginBottom: "var(--space-3)",
        }}
      >
        <div style={{ flex: "1 1 140px", minWidth: 120 }}>
          <label
            style={{
              fontSize: "11px",
              color: "var(--fg-muted)",
              display: "block",
              marginBottom: "4px",
            }}
          >
            SOCKS5 Bind IP
          </label>
          <input
            type="text"
            className="text-input"
            style={{ width: "100%", fontFamily: "var(--font-mono)" }}
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 1 110px", minWidth: 95 }}>
          <label
            style={{
              fontSize: "11px",
              color: "var(--fg-muted)",
              display: "block",
              marginBottom: "4px",
            }}
          >
            Listen Port (Default 11400)
          </label>
          <input
            type="number"
            className="text-input"
            style={{ width: "100%", fontFamily: "var(--font-mono)" }}
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={handleApplyAndVerifyPort}
          disabled={isCheckingPort}
          title="Check if port is occupied before applying to exported config"
        >
          <Radio size={13} />
          {isCheckingPort ? "Checking Port..." : "Verify & Apply Endpoint"}
        </button>
      </div>

      {/* Port Availability Feedback Banner (Error when Occupied, no silent auto-hop) */}
      {portCheckStatus && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            marginBottom: "var(--space-3)",
            background: portCheckStatus.occupied
              ? "var(--danger-subtle)"
              : "var(--success-subtle)",
            border: `1px solid ${
              portCheckStatus.occupied
                ? "var(--danger-fg)"
                : "var(--success-fg)"
            }`,
            fontSize: "11.5px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flex: 1 }}>
            {portCheckStatus.occupied ? (
              <AlertTriangle
                size={15}
                style={{
                  color: "var(--danger-fg)",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              />
            ) : (
              <CheckCircle2
                size={15}
                style={{
                  color: "var(--success-fg)",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              />
            )}
            <span style={{ lineHeight: 1.4 }}>{portCheckStatus.message}</span>
          </div>
          {portCheckStatus.occupied && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleForceApplyPort}
              title="Apply this port to exported config anyway"
            >
              Force Apply to Export
            </button>
          )}
        </div>
      )}

      {/* Toggle Switch for route.auto_detect_interface */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "8px 10px",
          borderRadius: 6,
          backgroundColor: "var(--bg-canvas-subtle)",
          border: "1px solid var(--border-default)",
          marginBottom: "var(--space-2)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>
            Auto-Detect Network Interface (
            <code>&quot;auto_detect_interface&quot;: {String(autoDetectInterface)}</code>)
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-muted)", lineHeight: 1.4 }}>
            Sing-box 1.14.4 <code>route.auto_detect_interface</code>. Enable when
            running Sing-box standalone/TUN; keep off or toggle when bridging
            behind Surge 5.10 with <code>PROCESS-NAME,sing-box,DIRECT</code>.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoDetectInterface}
          className="primer-toggle-switch-btn"
          onClick={() => {
            const next = !autoDetectInterface;
            setNetworkParams({ autoDetectInterface: next });
            appendLog(
              `[INFO][Config] Updated route.auto_detect_interface = ${next}`
            );
          }}
        >
          <span className="primer-toggle-switch-knob" />
        </button>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "var(--text-xs)",
          cursor: "pointer",
          marginTop: 6,
        }}
      >
        <input
          type="checkbox"
          checked={includeSurgeProxyGroups}
          onChange={(e) =>
            setNetworkParams({ includeSurgeProxyGroups: e.target.checked })
          }
        />
        <span>
          Include <code>[Proxy Group]</code> Smart regex groups (
          <code>policy-regex-filter</code>) in generated{" "}
          <code>aSingbox127.conf</code>
        </span>
      </label>
    </div>
  );
};
