import React, { useState } from "react";
import { Copy, Download, FolderOpen, GitBranch } from "lucide-react";
import { openAppConfigFolder } from "../../services/tauriGateway";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { triggerTextFileDownload } from "../../utils/subscriptionHelpers";
import { ChainRegexNamingTesterPanel } from "./ChainRegexNamingTesterPanel";
import { ChainRuleBuilderPanel } from "./ChainRuleBuilderPanel";
import { ChainTopologySvgCanvas } from "./ChainTopologySvgCanvas";
import { GeneratedSocksEndpointsTable } from "./GeneratedSocksEndpointsTable";

export const ChainTopologyView: React.FC = () => {
  const providerNodes = useWorkspaceStore((s) => s.providerNodes);
  const visualEdges = useWorkspaceStore((s) => s.visualEdges);
  const selectedChainRuleId = useWorkspaceStore((s) => s.selectedChainRuleId);
  const selectChainRule = useWorkspaceStore((s) => s.selectChainRule);
  const endpoints = useWorkspaceStore((s) => s.endpoints);
  const singboxConfig = useWorkspaceStore((s) => s.singboxConfig);
  const surgeConfigText = useWorkspaceStore((s) => s.surgeConfigText);
  const listenIp = useWorkspaceStore((s) => s.listenIp);
  const listenPort = useWorkspaceStore((s) => s.listenPort);
  const lastCheckResult = useWorkspaceStore((s) => s.lastCheckResult);
  const appendLog = useWorkspaceStore((s) => s.appendLog);

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const handleCopyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(`Copied ${label} to clipboard!`);
      setTimeout(() => setCopyFeedback(null), 2500);
    } catch {
      setCopyFeedback(`Failed to copy ${label}`);
    }
  };

  const handleOpenFolder = async () => {
    try {
      const summary = await openAppConfigFolder();
      setCopyFeedback(`Opened ${summary.config_dir}`);
      appendLog(
        `[INFO][ConfigDir] Opened Application Support folder: ${summary.config_dir}`
      );
      setTimeout(() => setCopyFeedback(null), 3000);
    } catch (err: any) {
      setCopyFeedback(`Failed to open folder: ${err?.message || String(err)}`);
    }
  };

  const activeConfigDir =
    lastCheckResult?.configDir ||
    "~/Library/Application Support/com.antigravity.singboxguiv0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Export Action Bar */}
      <div className="primer-banner primer-banner-info">
        <div className="primer-banner-main">
          <div className="primer-banner-icon">
            <GitBranch size={16} />
          </div>
          <div className="primer-banner-content">
            <div className="primer-banner-title">
              Universal Sing-box 1.14.4 SOCKS5 Bridge + Surge 5.10 Smart
              Transition Engine (Auto-Synced to Application Support)
            </div>
            <div className="primer-banner-description">
              <code>config.json</code> and <code>aSingbox127.conf</code> are
              dynamically written to{" "}
              <code>{activeConfigDir}</code> whenever subscriptions or chain
              rules change (
              <code>
                {listenIp}:{listenPort}
              </code>
              ,{" "}
              <code>
                {endpoints.length} active SOCKS5 endpoints
              </code>
              ).
              {copyFeedback && (
                <strong style={{ marginLeft: 10, color: "var(--fg-success)" }}>
                  {copyFeedback}
                </strong>
              )}
            </div>
          </div>
        </div>
        <div className="primer-banner-actions">
          <button
            type="button"
            className="primer-btn primer-btn-primary"
            onClick={handleOpenFolder}
            title={`Open ${activeConfigDir} in Finder / Explorer`}
          >
            <FolderOpen size={13} />
            <span>Open Config Folder</span>
          </button>
          <button
            type="button"
            className="primer-btn"
            onClick={() =>
              triggerTextFileDownload(
                JSON.stringify(singboxConfig, null, 2),
                "config.json",
                "application/json;charset=utf-8"
              )
            }
          >
            <Download size={13} />
            <span>Export config.json</span>
          </button>
          <button
            type="button"
            className="primer-btn primer-btn-status-accent"
            onClick={() =>
              triggerTextFileDownload(
                surgeConfigText,
                "aSingbox127.conf",
                "text/plain;charset=utf-8"
              )
            }
          >
            <Download size={13} />
            <span>Export aSingbox127.conf</span>
          </button>
          <button
            type="button"
            className="primer-btn"
            onClick={() => handleCopyText(surgeConfigText, "aSingbox127.conf")}
          >
            <Copy size={13} />
            <span>Copy Surge Conf</span>
          </button>
        </div>
      </div>

      {/* Interactive SVG Topology Graph */}
      <ChainTopologySvgCanvas
        providerNodes={providerNodes}
        visualEdges={visualEdges}
        selectedRuleId={selectedChainRuleId}
        onSelectRule={selectChainRule}
        listenIp={listenIp}
        listenPort={listenPort}
        totalEndpoints={endpoints.length}
      />

      {/* Split Grid: Dynamic Chain Builder (Left) + Regex Naming Scheme Optimizer (Right) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))",
          gap: 16,
        }}
      >
        <ChainRuleBuilderPanel />
        <ChainRegexNamingTesterPanel />
      </div>

      {/* Generated SOCKS5 Table */}
      <GeneratedSocksEndpointsTable />
    </div>
  );
};
