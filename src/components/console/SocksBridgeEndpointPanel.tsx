import React, { useEffect, useState } from "react";
import { Spinner, ToggleSwitch } from "@primer/react";
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
} from "../../services/tauriGateway";
import { yieldToNextPaint } from "../../stores/workspaceServiceActions";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { PortAvailabilityResult } from "../../types/singbox";

export const SocksBridgeEndpointPanel: React.FC = () => {
  const listenIp = useWorkspaceStore((s) => s.listenIp);
  const listenPort = useWorkspaceStore((s) => s.listenPort);
  const autoDetectInterface = useWorkspaceStore((s) => s.autoDetectInterface);
  const includeSurgeProxyGroups = useWorkspaceStore(
    (s) => s.includeSurgeProxyGroups
  );
  const setNetworkParams = useWorkspaceStore((s) => s.setNetworkParams);
  const runningMode = useWorkspaceStore((s) => s.runningMode);
  const isStartingService = useWorkspaceStore((s) => s.isStartingService);
  const startOrStopServiceAction = useWorkspaceStore(
    (s) => s.startOrStopServiceAction
  );
  const appendLog = useWorkspaceStore((s) => s.appendLog);

  const [ipInput, setIpInput] = useState(listenIp);
  const [portInput, setPortInput] = useState(String(listenPort));
  const [isCheckingPort, setIsCheckingPort] = useState(false);
  const [activePid, setActivePid] = useState<number | null>(null);
  const [activeConfigPath, setActiveConfigPath] = useState<string>("");
  const [portCheckStatus, setPortCheckStatus] =
    useState<PortAvailabilityResult | null>(null);

  useEffect(() => {
    setIpInput(listenIp);
    setPortInput(String(listenPort));
  }, [listenIp, listenPort]);

  useEffect(() => {
    getSingboxServiceStatus()
      .then((st) => {
        setActivePid(st.pid);
        if (st.config_path) setActiveConfigPath(st.config_path);
      })
      .catch(() => {});
  }, [runningMode]);

  const handleApplyAndVerifyPort = async () => {
    const parsedPort = Number(portInput) || 11400;
    const cleanIp = ipInput.trim() || "127.0.0.1";
    setIsCheckingPort(true);
    await yieldToNextPaint();
    try {
      if (
        runningMode !== "stopped" &&
        parsedPort === listenPort &&
        cleanIp === listenIp
      ) {
        setPortCheckStatus({
          port: parsedPort,
          host: cleanIp,
          occupied: false,
          available: true,
          message: `Managed sing-box service (PID ${
            activePid || "active"
          }) is currently listening on ${cleanIp}:${parsedPort}.`,
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
          `[INFO][BridgePort] Applied & persisted SOCKS5 Bridge endpoint ${cleanIp}:${parsedPort} to ui-config.json, config.json and aSingbox127.conf`
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
      `[WARN][BridgePort] Updated & persisted SOCKS5 Bridge port to ${cleanIp}:${parsedPort} in ui-config.json, config.json and aSingbox127.conf.`
    );
  };

  const handleToggleService = async () => {
    if (runningMode !== "stopped") {
      await startOrStopServiceAction("stop");
      setActivePid(null);
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
    await startOrStopServiceAction("start");
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
            disabled={isStartingService || isCheckingPort}
          >
            {isStartingService ? (
              <Spinner size="small" srText={null} />
            ) : runningMode !== "stopped" ? (
              <Square size={13} />
            ) : (
              <Play size={13} />
            )}
            <span>
              {isStartingService
                ? runningMode !== "stopped"
                  ? "Stopping..."
                  : "Starting..."
                : runningMode !== "stopped"
                ? `Stop Service (${listenPort})`
                : `Start Service (${portInput})`}
            </span>
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
          disabled={isCheckingPort || isStartingService}
          title="Check if port is occupied before applying to exported config"
        >
          {isCheckingPort ? (
            <Spinner size="small" srText={null} />
          ) : (
            <Radio size={13} />
          )}
          {isCheckingPort ? "Checking Port..." : "Verify & Apply Endpoint"}
        </button>
      </div>

      {/* Port Availability Feedback Banner */}
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
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 6,
              flex: 1,
            }}
          >
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

      {/* Native Primer ToggleSwitch for route.auto_detect_interface */}
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
          <div
            id="socks-panel-autodetect-label"
            style={{ fontSize: 12, fontWeight: 600 }}
          >
            Enhanced Mode — Auto-Detect Network Interface (
            <code>
              &quot;auto_detect_interface&quot;: {String(autoDetectInterface)}
            </code>
            )
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--fg-muted)",
              lineHeight: 1.4,
            }}
          >
            Sing-box 1.14.4 <code>route.auto_detect_interface</code> (default:
            ON). Persisted automatically to <code>ui-config.json</code>.
          </div>
        </div>
        <ToggleSwitch
          size="small"
          statusLabelPosition="end"
          aria-labelledby="socks-panel-autodetect-label"
          checked={autoDetectInterface}
          onChange={(checked: boolean) => {
            setNetworkParams({ autoDetectInterface: checked });
            appendLog(
              `[INFO][Config] Updated route.auto_detect_interface = ${checked}`
            );
          }}
        />
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
