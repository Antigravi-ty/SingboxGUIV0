import React, { useEffect, useRef, useState } from "react";
import { ToggleSwitch } from "@primer/react";
import { FolderCode, Moon, Palette, Settings, Sun } from "lucide-react";
import { TopbarIconStyle, useThemeStore } from "../../stores/themeStore";
import { syncUiConfigSnapshotToDisk } from "../../stores/workspaceServiceActions";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { SingboxBrandIcon } from "./SingboxBrandIcon";

export const TopbarSettingsPopover: React.FC = () => {
  const {
    colorMode,
    topbarIconStyle,
    advancedMode,
    setColorMode,
    setTopbarIconStyle,
    setAdvancedMode,
  } = useThemeStore();
  const autoDetectInterface = useWorkspaceStore((s) => s.autoDetectInterface);
  const listenIp = useWorkspaceStore((s) => s.listenIp);
  const listenPort = useWorkspaceStore((s) => s.listenPort);
  const workingListenPort = useWorkspaceStore((s) => s.workingListenPort);
  const includeSurgeProxyGroups = useWorkspaceStore(
    (s) => s.includeSurgeProxyGroups
  );
  const setNetworkParams = useWorkspaceStore((s) => s.setNetworkParams);

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const handleSelectIconStyle = (style: TopbarIconStyle) => {
    setTopbarIconStyle(style);
    void syncUiConfigSnapshotToDisk({
      listenIp,
      listenPort,
      workingListenPort,
      autoDetectInterface,
      includeSurgeProxyGroups,
    });
  };

  const handleToggleAdvanced = (next: boolean) => {
    setAdvancedMode(next);
    void syncUiConfigSnapshotToDisk({
      listenIp,
      listenPort,
      workingListenPort,
      autoDetectInterface,
      includeSurgeProxyGroups,
    });
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        className={`primer-btn primer-btn-icon-only ${
          open ? "primer-btn-status-accent" : ""
        }`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings"
        title="Settings (System Tray Icon, Enhanced NIC Mode, UI Config & Theme)"
      >
        <Settings size={14} />
      </button>

      {open && (
        <div
          className="primer-select-panel-overlay"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            width: 345,
            zIndex: 1300,
          }}
        >
          <div className="primer-select-panel-header">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Palette size={13} />
                <span>System Tray, Enhanced Mode &amp; Settings</span>
              </span>
            </div>
          </div>

          <div
            style={{
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              fontSize: 12,
            }}
          >
            {/* 1. System Tray / macOS Menu Bar Icon Style */}
            <div>
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>System Tray / macOS Top Bar Icon</span>
                <SingboxBrandIcon
                  styleMode={topbarIconStyle}
                  colorMode={colorMode}
                  size={18}
                />
              </div>
              <div className="primer-segmented-control">
                <button
                  type="button"
                  className={`primer-segmented-button ${
                    topbarIconStyle === "monochrome"
                      ? "primer-segmented-button-active"
                      : ""
                  }`}
                  onClick={() => handleSelectIconStyle("monochrome")}
                >
                  Monochrome (Default)
                </button>
                <button
                  type="button"
                  className={`primer-segmented-button ${
                    topbarIconStyle === "real"
                      ? "primer-segmented-button-active"
                      : ""
                  }`}
                  onClick={() => handleSelectIconStyle("real")}
                >
                  Real Color
                </button>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--fg-muted)",
                  marginTop: 4,
                  lineHeight: 1.4,
                }}
              >
                {topbarIconStyle === "monochrome"
                  ? "Apple macOS HIG Template Icon: renders 100% crisp white when Core is running, and dims to 42% alpha when stopped."
                  : "Applied to OS system tray / macOS menu bar using full-color 3D box artwork (dims when stopped)."}
              </div>
            </div>

            {/* 2. Quick Toggle for route.auto_detect_interface (Enhanced Mode) */}
            <div
              style={{
                paddingTop: 8,
                borderTop: "1px solid var(--border-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div>
                <div
                  id="settings-autodetect-label"
                  style={{ fontWeight: 600, fontSize: 11.5 }}
                >
                  Enhanced Mode (<code>auto_detect_interface</code>)
                </div>
                <div style={{ fontSize: 10.5, color: "var(--fg-muted)" }}>
                  Auto-bind outbound traffic to physical NIC (default: ON)
                </div>
              </div>
              <ToggleSwitch
                size="small"
                statusLabelPosition="end"
                aria-labelledby="settings-autodetect-label"
                checked={autoDetectInterface}
                onChange={(checked: boolean) =>
                  setNetworkParams({
                    autoDetectInterface: checked,
                  })
                }
              />
            </div>

            {/* 3. Advanced Workspace Mode Toggle */}
            <div
              style={{
                paddingTop: 8,
                borderTop: "1px solid var(--border-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div>
                <div
                  id="settings-advanced-mode-label"
                  style={{ fontWeight: 600, fontSize: 11.5 }}
                >
                  Advanced Mode (Full Tabs &amp; Telemetry)
                </div>
                <div style={{ fontSize: 10.5, color: "var(--fg-muted)" }}>
                  Show all 6 navigation tabs &amp; full header metadata
                </div>
              </div>
              <ToggleSwitch
                size="small"
                statusLabelPosition="end"
                aria-labelledby="settings-advanced-mode-label"
                checked={advancedMode}
                onChange={handleToggleAdvanced}
              />
            </div>

            {/* 4. Theme Color Mode */}
            <div
              style={{
                paddingTop: 8,
                borderTop: "1px solid var(--border-muted)",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                Workspace Theme Mode
              </div>
              <div className="primer-segmented-control">
                <button
                  type="button"
                  className={`primer-segmented-button ${
                    colorMode === "light"
                      ? "primer-segmented-button-active"
                      : ""
                  }`}
                  onClick={() => setColorMode("light")}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Sun size={12} /> Light
                  </span>
                </button>
                <button
                  type="button"
                  className={`primer-segmented-button ${
                    colorMode === "dark"
                      ? "primer-segmented-button-active"
                      : ""
                  }`}
                  onClick={() => setColorMode("dark")}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Moon size={12} /> Dark
                  </span>
                </button>
              </div>
            </div>

            {/* 5. Application Support & Agent-Friendly UI Config Storage */}
            <div
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                backgroundColor: "var(--bg-canvas-subtle)",
                border: "1px solid var(--border-default)",
                fontSize: 11,
                lineHeight: 1.45,
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  marginBottom: 3,
                }}
              >
                <FolderCode size={12} />
                <span>Dual-Profile Config &amp; Binary Directory</span>
              </div>
              <div style={{ color: "var(--fg-muted)" }}>
                <code>~/Library/Application Support/com.antigravity.singboxguiv0/</code>
                <br />
                Persists <code>config.stable.json</code> (:{listenPort}),{" "}
                <code>config.working.json</code> (:{workingListenPort}),{" "}
                <code>ui-config.json</code>, <code>managed-pids.json</code>{" "}
                &amp; <code>sing-box</code>.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
