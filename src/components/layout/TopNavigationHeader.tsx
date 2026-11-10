import React from "react";
import {
  Activity,
  CheckCircle2,
  FileCode2,
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
import { useThemeStore } from "../../stores/themeStore";
import {
  ActiveWorkspaceTab,
  useWorkspaceStore,
} from "../../stores/workspaceStore";

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
  const { colorMode, toggleColorMode } = useThemeStore();
  const activeTab = useWorkspaceStore((s) => s.activeTab);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);
  const endpoints = useWorkspaceStore((s) => s.endpoints);
  const directNodes = useWorkspaceStore((s) => s.directNodes);
  const listenIp = useWorkspaceStore((s) => s.listenIp);
  const listenPort = useWorkspaceStore((s) => s.listenPort);
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
            <img
              src="/favicon.svg"
              alt="Sing-box"
              width={20}
              height={20}
              style={{ display: "block", flexShrink: 0 }}
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
            onClick={() => runSingboxCheck()}
            className={`primer-btn ${
              lastCheckResult === null
                ? ""
                : lastCheckResult.valid
                ? "primer-btn-status-success"
                : "primer-btn-status-danger"
            }`}
            title="Validate generated config.json against Sing-box 1.14.4 schema"
          >
            {lastCheckResult?.valid !== false ? (
              <CheckCircle2 size={13} />
            ) : (
              <XCircle size={13} />
            )}
            <span>
              {lastCheckResult
                ? lastCheckResult.valid
                  ? "1.14.4 Check: PASS"
                  : "1.14.4 Check: FAIL"
                : "Verify 1.14.4 Config"}
            </span>
          </button>

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
