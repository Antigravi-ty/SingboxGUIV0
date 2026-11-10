import React from "react";
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
  Sun,
  Terminal,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { openAppConfigFolder } from "../../services/tauriGateway";
import { useThemeStore } from "../../stores/themeStore";
import {
  ActiveWorkspaceTab,
  useWorkspaceStore,
} from "../../stores/workspaceStore";
import { SingboxBrandIcon } from "./SingboxBrandIcon";
import { TopbarSettingsPopover } from "./TopbarSettingsPopover";

const NAV_TABS: Array<{
  id: ActiveWorkspaceTab;
  label: string;
  icon: LucideIcon;
}> = [
  {
    id: "topology",
    label: "Chain Topology & Surge Export",
    icon: GitBranch,
  },
  {
    id: "subscriptions",
    label: "Subscriptions & Mihomo Converter",
    icon: Share2,
  },
  {
    id: "security",
    label: "TLS & skip-cert-verify Policy",
    icon: ShieldAlert,
  },
  {
    id: "diagnostics",
    label: "Desensitized Config Export",
    icon: FileCode2,
  },
  {
    id: "mitm",
    label: "MITM & URL Regex Routing",
    icon: KeyRound,
  },
  {
    id: "console",
    label: "Sing-box 1.14.4 Console & Logs",
    icon: Terminal,
  },
];

export const TopNavigationHeader: React.FC = () => {
  const { colorMode, topbarIconStyle, toggleColorMode } = useThemeStore();
  const activeTab = useWorkspaceStore((s) => s.activeTab);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);
  const endpoints = useWorkspaceStore((s) => s.endpoints);
  const directNodes = useWorkspaceStore((s) => s.directNodes);
  const listenIp = useWorkspaceStore((s) => s.listenIp);
  const listenPort = useWorkspaceStore((s) => s.listenPort);
  const autoDetectInterface = useWorkspaceStore((s) => s.autoDetectInterface);
  const lastCheckResult = useWorkspaceStore((s) => s.lastCheckResult);
  const runSingboxCheck = useWorkspaceStore((s) => s.runSingboxCheck);

  const chainCount = endpoints.length - directNodes.length;
  const insecureCount = directNodes.filter((n) => n.effectiveInsecure).length;

  return (
    <header style={{ flexShrink: 0 }}>
      <div className="primer-header">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
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
              styleMode={topbarIconStyle}
              colorMode={colorMode}
              size={20}
            />
            <span>SingboxGUI V0</span>
          </div>

          <span className="primer-badge primer-badge-accent">
            CoreTarget: sing-box 1.14.4
          </span>

          <span className="primer-badge primer-badge-success">
            SOCKS5 Bridge: {listenIp}:{listenPort} ({endpoints.length} users:{" "}
            {directNodes.length} Direct + {chainCount} Chain)
          </span>

          <span
            className="primer-badge"
            title="route.auto_detect_interface in generated Sing-box 1.14.4 config.json"
          >
            auto_detect_interface: {autoDetectInterface ? "true" : "false"}
          </span>

          {insecureCount > 0 && (
            <button
              type="button"
              className="primer-btn primer-btn-status-attention"
              style={{ padding: "2px 8px", fontSize: 11 }}
              onClick={() => setActiveTab("security")}
              title="Click to inspect nodes with skip-cert-verify: true (insecure: true)"
            >
              <ShieldAlert size={12} />
              <span>{insecureCount} insecure TLS nodes</span>
            </button>
          )}
        </div>

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
            className="primer-btn"
            onClick={() => openAppConfigFolder().catch(() => {})}
            title={
              lastCheckResult?.configDir
                ? `Open ${lastCheckResult.configDir} (contains config.json, aSingbox127.conf, sing-box)`
                : "Open Application Support Configuration Folder"
            }
          >
            <FolderOpen size={13} />
            <span>Open Config Folder</span>
          </button>

          <button
            type="button"
            onClick={() => runSingboxCheck()}
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
            {lastCheckResult?.valid === false ? (
              <XCircle size={13} />
            ) : lastCheckResult?.emptyWorkspace ? (
              <AlertTriangle size={13} />
            ) : (
              <CheckCircle2 size={13} />
            )}
            <span>
              {lastCheckResult
                ? !lastCheckResult.valid
                  ? "1.14.4 Check: FAIL"
                  : lastCheckResult.emptyWorkspace
                  ? "config.json: 0 Nodes"
                  : `1.14.4 Synced (${endpoints.length} slots)`
                : "Sync & Verify Config"}
            </span>
          </button>

          <TopbarSettingsPopover />

          <button
            type="button"
            className="primer-btn primer-btn-icon-only"
            onClick={toggleColorMode}
            title={`Switch to ${colorMode === "dark" ? "light" : "dark"} mode`}
          >
            {colorMode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

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
    </header>
  );
};
