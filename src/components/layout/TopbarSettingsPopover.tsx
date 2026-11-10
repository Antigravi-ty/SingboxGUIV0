import React, { useEffect, useRef, useState } from "react";
import { FolderCode, Moon, Palette, Settings, Sun } from "lucide-react";
import { TopbarIconStyle, useThemeStore } from "../../stores/themeStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { SingboxBrandIcon } from "./SingboxBrandIcon";

export const TopbarSettingsPopover: React.FC = () => {
  const {
    colorMode,
    topbarIconStyle,
    setColorMode,
    setTopbarIconStyle,
  } = useThemeStore();
  const autoDetectInterface = useWorkspaceStore((s) => s.autoDetectInterface);
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
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        className={`primer-btn ${open ? "primer-btn-status-accent" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="Appearance, Topbar Icon Style & Core Binary Settings"
      >
        <Settings size={13} />
        <span>Settings</span>
      </button>

      {open && (
        <div
          className="primer-select-panel-overlay"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            width: 330,
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
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Palette size={13} />
                <span>GUI Appearance &amp; Runtime Settings</span>
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
            {/* 1. Topbar Brand Icon Style */}
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
                <span>Topbar Icon Style (macOS Design)</span>
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
                    topbarIconStyle === "real"
                      ? "primer-segmented-button-active"
                      : ""
                  }`}
                  onClick={() => handleSelectIconStyle("real")}
                >
                  Real Color
                </button>
                <button
                  type="button"
                  className={`primer-segmented-button ${
                    topbarIconStyle === "monochrome"
                      ? "primer-segmented-button-active"
                      : ""
                  }`}
                  onClick={() => handleSelectIconStyle("monochrome")}
                >
                  Monochrome (B&amp;W)
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
                  ? "Standardized macOS menu-bar template: crisp white fill in Light mode, deep black fill in Dark mode."
                  : "Original 3D skeuomorphic cardboard box artwork."}
              </div>
            </div>

            {/* 2. Theme Color Mode */}
            <div>
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

            {/* 3. Quick Toggle for route.auto_detect_interface */}
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
                <div style={{ fontWeight: 600, fontSize: 11.5 }}>
                  <code>auto_detect_interface</code>
                </div>
                <div style={{ fontSize: 10.5, color: "var(--fg-muted)" }}>
                  Bind outbound traffic to physical NIC (Sing-box 1.14.4{" "}
                  <code>route.auto_detect_interface</code>)
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoDetectInterface}
                className="primer-toggle-switch-btn"
                onClick={() =>
                  setNetworkParams({
                    autoDetectInterface: !autoDetectInterface,
                  })
                }
              >
                <span className="primer-toggle-switch-knob" />
              </button>
            </div>

            {/* 4. Application Support & Binary Placement Guide */}
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
                <span>Application Support &amp; Binary Storage</span>
              </div>
              <div style={{ color: "var(--fg-muted)" }}>
                1. <code>~/Library/Application Support/com.antigravity.singboxguiv0/</code>{" "}
                (Unified store for <code>sing-box</code>, <code>config.json</code> &amp;{" "}
                <code>aSingbox127.conf</code>)
                <br />
                2. <code>./bin/sing-box</code> &amp; <code>./src-tauri/binaries/</code>{" "}
                (Auto-imported into Application Support)
                <br />
                3. <code>/opt/homebrew/bin/sing-box</code> &amp;{" "}
                <code>/usr/local/bin/sing-box</code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
