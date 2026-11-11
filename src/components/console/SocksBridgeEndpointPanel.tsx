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
  const workingListenPort = useWorkspaceStore((s) => s.workingListenPort);
  const autoDetectInterface = useWorkspaceStore((s) => s.autoDetectInterface);
  const includeSurgeProxyGroups = useWorkspaceStore(
    (s) => s.includeSurgeProxyGroups
  );
  const setNetworkParams = useWorkspaceStore((s) => s.setNetworkParams);
  const runningMode = useWorkspaceStore((s) => s.runningMode);
  const stableSlotStatus = useWorkspaceStore((s) => s.stableSlotStatus);
  const workingSlotStatus = useWorkspaceStore((s) => s.workingSlotStatus);
  const setDualSlotStatus = useWorkspaceStore((s) => s.setDualSlotStatus);
  const isStartingService = useWorkspaceStore((s) => s.isStartingService);
  const startOrStopServiceAction = useWorkspaceStore(
    (s) => s.startOrStopServiceAction
  );
  const appendLog = useWorkspaceStore((s) => s.appendLog);

  const [ipInput, setIpInput] = useState(listenIp);
  const [portInput, setPortInput] = useState(String(listenPort));
  const [workingPortInput, setWorkingPortInput] = useState(
    String(workingListenPort)
  );
  const [isCheckingPort, setIsCheckingPort] = useState(false);
  const [activePid, setActivePid] = useState<number | null>(null);
  const [activeConfigPath, setActiveConfigPath] = useState<string>("");
  const [portCheckStatus, setPortCheckStatus] =
    useState<PortAvailabilityResult | null>(null);

  useEffect(() => {
    setIpInput(listenIp);
    setPortInput(String(listenPort));
    setWorkingPortInput(String(workingListenPort));
  }, [listenIp, listenPort, workingListenPort]);

  useEffect(() => {
    getSingboxServiceStatus()
      .then((st) => {
        setActivePid(st.pid);
        if (st.config_path) setActiveConfigPath(st.config_path);
        setDualSlotStatus(st.stable_slot ?? null, st.working_slot ?? null);
      })
      .catch(() => {});
  }, [runningMode, setDualSlotStatus]);

  const isStableRunning = Boolean(stableSlotStatus?.running);
  const isWorkingRunning = Boolean(workingSlotStatus?.running);

  const handleApplyAndVerifyPort = async () => {
    const parsedPort = Number(portInput) || 11400;
    let parsedWorkingPort = Number(workingPortInput) || 11401;
    if (parsedWorkingPort === parsedPort) {
      parsedWorkingPort = parsedPort + 1;
      setWorkingPortInput(String(parsedWorkingPort));
    }
    const cleanIp = ipInput.trim() || "127.0.0.1";
    setIsCheckingPort(true);
    await yieldToNextPaint();
    try {
      if (
        isStableRunning &&
        parsedPort === listenPort &&
        cleanIp === listenIp
      ) {
        setNetworkParams({
          listenIp: cleanIp,
          listenPort: parsedPort,
          workingListenPort: parsedWorkingPort,
        });
        setPortCheckStatus({
          port: parsedPort,
          host: cleanIp,
          occupied: false,
          available: true,
          message: `Managed Stable Core (PID ${
            stableSlotStatus?.pid || activePid || "active"
          }) is currently listening on ${cleanIp}:${parsedPort}; Working Core port set to :${parsedWorkingPort}.`,
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
          workingListenPort: parsedWorkingPort,
        });
        appendLog(
          `[INFO][BridgePort] Applied & persisted Stable (${cleanIp}:${parsedPort}) & Working (${cleanIp}:${parsedWorkingPort}) endpoints to ui-config.json, config.stable.json and config.working.json`
        );
      }
    } finally {
      setIsCheckingPort(false);
    }
  };

  const handleForceApplyPort = () => {
    const parsedPort = Number(portInput) || 11400;
    const parsedWorkingPort = Number(workingPortInput) || 11401;
    const cleanIp = ipInput.trim() || "127.0.0.1";
    setNetworkParams({
      listenIp: cleanIp,
      listenPort: parsedPort,
      workingListenPort: parsedWorkingPort,
    });
    appendLog(
      `[WARN][BridgePort] Updated & persisted SOCKS5 Bridge ports to Stable ${cleanIp}:${parsedPort} / Working ${cleanIp}:${parsedWorkingPort}.`
    );
  };

  const handleToggleStableService = async () => {
    if (isStableRunning) {
      await startOrStopServiceAction("stop", "stable");
      return;
    }

    const parsedPort = Number(portInput) || listenPort || 11400;
    const parsedWorkingPort =
      Number(workingPortInput) || workingListenPort || 11401;
    const cleanIp = ipInput.trim() || listenIp || "127.0.0.1";
    if (
      parsedPort !== listenPort ||
      parsedWorkingPort !== workingListenPort ||
      cleanIp !== listenIp
    ) {
      setNetworkParams({
        listenIp: cleanIp,
        listenPort: parsedPort,
        workingListenPort: parsedWorkingPort,
      });
    }
    await startOrStopServiceAction("start", "stable");
  };

  const handleToggleWorkingService = async () => {
    if (isWorkingRunning) {
      await startOrStopServiceAction("stop", "working");
      return;
    }

    const parsedPort = Number(portInput) || listenPort || 11400;
    let parsedWorkingPort =
      Number(workingPortInput) || workingListenPort || 11401;
    if (parsedWorkingPort === parsedPort) {
      parsedWorkingPort = parsedPort + 1;
      setWorkingPortInput(String(parsedWorkingPort));
    }
    const cleanIp = ipInput.trim() || listenIp || "127.0.0.1";
    if (
      parsedPort !== listenPort ||
      parsedWorkingPort !== workingListenPort ||
      cleanIp !== listenIp
    ) {
      setNetworkParams({
        listenIp: cleanIp,
        listenPort: parsedPort,
        workingListenPort: parsedWorkingPort,
      });
    }
    await startOrStopServiceAction("start", "working");
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
              Dual Core Control (Stable vs Working Config Isolation)
            </span>
            {stableSlotStatus?.pid && (
              <span
                className="badge badge-success"
                style={{ marginLeft: 8, fontSize: 10.5 }}
              >
                Stable PID {stableSlotStatus.pid} (:{listenPort})
              </span>
            )}
            {workingSlotStatus?.pid && (
              <span
                className="badge badge-warning"
                style={{ marginLeft: 6, fontSize: 10.5 }}
              >
                Working PID {workingSlotStatus.pid} (:{workingListenPort})
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
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
              isStableRunning ? "btn-danger" : "btn-primary"
            }`}
            onClick={handleToggleStableService}
            disabled={isStartingService || isCheckingPort}
            title="Start or Stop Stable Core (config.stable.json)"
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
                ? `Stop Stable (:${listenPort})`
                : `Start Stable (:${portInput})`}
            </span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${
              isWorkingRunning ? "btn-danger" : ""
            }`}
            onClick={handleToggleWorkingService}
            disabled={isStartingService || isCheckingPort}
            title="Start or Stop Working/Test Core (config.working.json — auto hot-reloads on UI edits)"
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
                ? `Stop Working (:${workingListenPort})`
                : `Start Working (:${workingPortInput})`}
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
        <div style={{ flex: "1 1 130px", minWidth: 110 }}>
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
        <div style={{ flex: "0 1 115px", minWidth: 95 }}>
          <label
            style={{
              fontSize: "11px",
              color: "var(--fg-muted)",
              display: "block",
              marginBottom: "4px",
            }}
          >
            Stable Port (11400)
          </label>
          <input
            type="number"
            className="text-input"
            style={{ width: "100%", fontFamily: "var(--font-mono)" }}
            value={portInput}
            onChange={(e) => setPortInput(e.target.value)}
          />
        </div>
        <div style={{ flex: "0 1 120px", minWidth: 95 }}>
          <label
            style={{
              fontSize: "11px",
              color: "var(--fg-muted)",
              display: "block",
              marginBottom: "4px",
            }}
          >
            Working Port (11401)
          </label>
          <input
            type="number"
            className="text-input"
            style={{ width: "100%", fontFamily: "var(--font-mono)" }}
            value={workingPortInput}
            onChange={(e) => setWorkingPortInput(e.target.value)}
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
          {isCheckingPort ? "Checking..." : "Verify & Apply Ports"}
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
