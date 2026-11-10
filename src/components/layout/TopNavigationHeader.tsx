import React, { useState } from "react";
import { Spinner } from "@primer/react";
import {
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  FolderOpen,
  GitBranch,
  KeyRound,
  Moon,
  Share2,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
  Terminal,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { openAppConfigFolder } from "../../services/tauriGateway";
import { useThemeStore } from "../../stores/themeStore";
import { syncUiConfigSnapshotToDisk } from "../../stores/workspaceServiceActions";
import {
  ActiveWorkspaceTab,
  useWorkspaceStore,
} from "../../stores/workspaceStore";
import { SingboxBrandIcon } from "./SingboxBrandIcon";
import { TopbarSettingsPopover } from "./TopbarSettingsPopover";
import { UnpinnedInsecureWarningPopover } from "./UnpinnedInsecureWarningPopover";

const NAV_TABS: Array<{
  id: ActiveWorkspaceTab;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "topology", label: "Chain Topology & Surge Export", icon: GitBranch },
  {
    id: "subscriptions",
    label: "Subscriptions & Mihomo Converter",
    icon: Share2,
  },
  { id: "security", label: "TLS & skip-cert-verify Policy", icon: ShieldAlert },
  { id: "diagnostics", label: "Desensitized Config Export", icon: FileCode2 },
  { id: "mitm", label: "MITM & URL Regex Routing", icon: KeyRound },
  { id: "console", label: "Sing-box 1.14.4 Console & Logs", icon: Terminal },
];

export const TopNavigationHeader: React.FC = () => {
  const { colorMode, advancedMode, toggleColorMode, setAdvancedMode } =
    useThemeStore();
  const activeTab = useWorkspaceStore((s) => s.activeTab);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);
  const endpoints = useWorkspaceStore((s) => s.endpoints);
  const directNodes = useWorkspaceStore((s) => s.directNodes);
  const listenIp = useWorkspaceStore((s) => s.listenIp);
  const listenPort = useWorkspaceStore((s) => s.listenPort);
  const autoDetectInterface = useWorkspaceStore((s) => s.autoDetectInterface);
  const includeSurgeProxyGroups = useWorkspaceStore(
    (s) => s.includeSurgeProxyGroups
  );
  const lastCheckResult = useWorkspaceStore((s) => s.lastCheckResult);
  const isCheckingConfig = useWorkspaceStore((s) => s.isCheckingConfig);
  const isStartingService = useWorkspaceStore((s) => s.isStartingService);
  const runningMode = useWorkspaceStore((s) => s.runningMode);
  const runSingboxCheck = useWorkspaceStore((s) => s.runSingboxCheck);
  const setSecurityPolicy = useWorkspaceStore((s) => s.setSecurityPolicy);

  const [expandNodeCountBadge, setExpandNodeCountBadge] = useState(false);

  const chainCount = Math.max(0, endpoints.length - directNodes.length);
  const insecureNodes = directNodes.filter((n) => n.effectiveInsecure);
  const unpinnedInsecureNodes = insecureNodes.filter(
    (n) => !n.hasCertFingerprintPin
  );
  const pinnedInsecureCount =
    insecureNodes.length - unpinnedInsecureNodes.length;
  const isServiceRunning = runningMode !== "stopped";

  const handleToggleAdvancedButton = () => {
    const next = !advancedMode;
    setAdvancedMode(next);
    if (!next) {
      setActiveTab("console");
    }
    void syncUiConfigSnapshotToDisk({
      listenIp,
      listenPort,
      autoDetectInterface,
      includeSurgeProxyGroups,
    });
  };

  return (
    <header style={{ flexShrink: 0 }}>
      <div className="primer-header">
        {/* Left Cluster: Brand + Simplified or Advanced Badges */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 700,
              fontSize: 14,
              color: "var(--fg-default)",
            }}
          >
            <SingboxBrandIcon
              styleMode="real"
              colorMode={colorMode}
              size={20}
            />
            <span>SingboxGUI V0</span>
          </div>

          {!advancedMode ? (
            <>
              <span
                className="primer-badge primer-badge-accent"
                title="Target Core: Sing-box 1.14.4"
              >
                1.14.4
              </span>

              <span
                className="primer-badge primer-badge-success"
                title={`SOCKS5 Bridge listening on ${listenIp}:${listenPort}`}
              >
                SOCKS5 :{listenPort}
              </span>

              {autoDetectInterface && (
                <span
                  className="primer-badge primer-badge-accent"
                  title="route.auto_detect_interface = true (Enhanced NIC auto-binding enabled)"
                >
                  Enhanced
                </span>
              )}

              <UnpinnedInsecureWarningPopover
                unpinnedInsecureNodes={unpinnedInsecureNodes}
                pinnedInsecureCount={pinnedInsecureCount}
                onForceStrictVerify={() =>
                  setSecurityPolicy("enforce_strict_tls")
                }
                onInspectTlsPolicy={() => {
                  setAdvancedMode(true);
                  setActiveTab("security");
                }}
              />
            </>
          ) : (
            <>
              <span className="primer-badge primer-badge-accent">
                CoreTarget: sing-box 1.14.4
              </span>

              <span className="primer-badge primer-badge-success">
                SOCKS5 Bridge: {listenIp}:{listenPort} ({endpoints.length}{" "}
                users: {directNodes.length} Direct + {chainCount} Chain)
              </span>

              <span
                className="primer-badge"
                title="route.auto_detect_interface in generated Sing-box 1.14.4 config.json"
              >
                auto_detect_interface: {autoDetectInterface ? "true" : "false"}
              </span>

              {insecureNodes.length > 0 && (
                <button
                  type="button"
                  className="primer-btn primer-btn-status-attention"
                  style={{ padding: "2px 8px", fontSize: 11 }}
                  onClick={() => setActiveTab("security")}
                  title="Click to inspect nodes with skip-cert-verify: true (insecure: true)"
                >
                  <ShieldAlert size={12} />
                  <span>
                    {insecureNodes.length} insecure TLS (
                    {unpinnedInsecureNodes.length} unpinned)
                  </span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Right Cluster (Right-to-Left: Moon -> Gear -> Service/D175+240 -> Folder -> Advanced) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {advancedMode && (
            <button
              type="button"
              disabled={isCheckingConfig}
              onClick={() => void runSingboxCheck()}
              className={`primer-btn ${
                lastCheckResult === null
                  ? ""
                  : !lastCheckResult.valid
                  ? "primer-btn-status-danger"
                  : lastCheckResult.emptyWorkspace
                  ? "primer-btn-status-attention"
                  : "primer-btn-status-success"
              }`}
              title={
                lastCheckResult?.commandOutput ||
                "Sync & validate config.json in Application Support against Sing-box 1.14.4"
              }
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
                {isCheckingConfig
                  ? "Verifying..."
                  : lastCheckResult
                  ? !lastCheckResult.valid
                    ? "1.14.4 Check: FAIL"
                    : lastCheckResult.emptyWorkspace
                    ? "config.json: 0 Nodes"
                    : `1.14.4 Synced (${endpoints.length} slots)`
                  : "Sync & Verify Config"}
              </span>
            </button>
          )}

          {/* Advanced Mode Toggle Button (default: inactive) */}
          <button
            type="button"
            className={`primer-btn ${
              advancedMode ? "primer-btn-status-accent" : ""
            }`}
            onClick={handleToggleAdvancedButton}
            aria-pressed={advancedMode}
            title={
              advancedMode
                ? "Advanced Mode Active (Full tabs & telemetry shown). Click to return to Simplified Console Mode."
                : "Enable Advanced Mode (Show all 6 workspace tabs & full telemetry)"
            }
          >
            <SlidersHorizontal size={13} />
            <span>Advanced</span>
          </button>

          {/* Left of Status Badge: Folder Button */}
          <button
            type="button"
            className="primer-btn primer-btn-icon-only"
            onClick={() => openAppConfigFolder().catch(() => {})}
            aria-label="Open Config Folder"
            title={
              lastCheckResult?.configDir
                ? `Open ${lastCheckResult.configDir} (config.json, aSingbox127.conf, ui-config.json)`
                : "Open Application Support Configuration Folder"
            }
          >
            <FolderOpen size={14} />
          </button>

          {/* Service Status & Node Count Badge (Yellow when Standby, Green when Running; D175+240 -> 175 Direct + 240 Chain) */}
          <button
            type="button"
            className={`primer-btn ${
              isServiceRunning
                ? "primer-btn-status-success"
                : "primer-btn-status-attention"
            }`}
            onClick={() => setExpandNodeCountBadge((v) => !v)}
            title={
              isServiceRunning
                ? `Service Running — ${directNodes.length} Direct + ${chainCount} Chain (${endpoints.length} total SOCKS5 users). Click to toggle label format.`
                : `Service Standby — ${directNodes.length} Direct + ${chainCount} Chain (${endpoints.length} total SOCKS5 users). Click to toggle label format.`
            }
          >
            {isStartingService ? (
              <Spinner size="small" srText={null} />
            ) : (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: isServiceRunning
                    ? "var(--fg-success)"
                    : "var(--fg-attention)",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
            )}
            <span>
              {expandNodeCountBadge
                ? `${directNodes.length} Direct + ${chainCount} Chain (${
                    isServiceRunning ? "Running" : "Standby"
                  })`
                : `D${directNodes.length}+${chainCount}`}
            </span>
          </button>

          {/* Small Gear Settings Button */}
          <TopbarSettingsPopover />

          {/* Rightmost: Moon / Sun Theme Toggle */}
          <button
            type="button"
            className="primer-btn primer-btn-icon-only"
            onClick={toggleColorMode}
            aria-label={`Switch to ${colorMode === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${colorMode === "dark" ? "light" : "dark"} mode`}
          >
            {colorMode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

      {/* Full 6-Tab Navigation Bar is only rendered when Advanced Mode is active */}
      {advancedMode && (
        <nav
          className="primer-header-secondary-tray"
          aria-label="Workspace Tabs"
        >
          <div className="primer-header-nav-tabs">
            {NAV_TABS.map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`primer-btn ${
                    isActive ? "primer-btn-status-accent" : ""
                  }`}
                  style={{
                    fontWeight: isActive ? 600 : 500,
                    padding: "5px 11px",
                  }}
                >
                  <IconComp size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
};
