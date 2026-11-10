import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Cpu,
  FolderOpen,
  Play,
  RefreshCw,
  Upload,
} from "lucide-react";
import {
  checkCoreBinaryStatus,
  importSingboxBinary,
  openAppConfigFolder,
} from "../../services/tauriGateway";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { BinaryStatusInfo } from "../../types/singbox";

export const CoreBinaryValidatorPanel: React.FC = () => {
  const { lastCheckResult, runSingboxCheck, appendLog } = useWorkspaceStore();
  const [isChecking, setIsChecking] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [binaryStatus, setBinaryStatus] = useState<BinaryStatusInfo | null>(
    null
  );
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshBinaryStatus = () => {
    checkCoreBinaryStatus()
      .then((info) => setBinaryStatus(info))
      .catch(() => {});
  };

  useEffect(() => {
    refreshBinaryStatus();
    runSingboxCheck();
  }, [runSingboxCheck]);

  const handleRunSingboxCheck = async () => {
    setIsChecking(true);
    try {
      refreshBinaryStatus();
      await runSingboxCheck();
      const latest = useWorkspaceStore.getState().lastCheckResult;
      if (latest) {
        appendLog(
          latest.valid
            ? latest.emptyWorkspace
              ? `[WARN][sing-box] ${latest.commandOutput}`
              : `[INFO][sing-box] ${latest.version} — ${latest.commandOutput}`
            : `[ERROR][sing-box] ${latest.commandOutput}`
        );
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleOpenConfigFolder = async () => {
    try {
      const summary = await openAppConfigFolder();
      appendLog(
        `[INFO][ConfigDir] Opened Application Support folder: ${summary.config_dir} (config.json: ${summary.proxy_outbound_count} proxy outbounds, ${summary.socks_user_count} SOCKS5 users)`
      );
    } catch (err: any) {
      appendLog(
        `[ERROR][ConfigDir] Failed to open config folder: ${
          err?.message || String(err)
        }`
      );
    }
  };

  const handleCopyPath = async (pathText: string, label: string) => {
    try {
      await navigator.clipboard.writeText(pathText);
      setCopyNote(`Copied ${label}`);
      setTimeout(() => setCopyNote(null), 2000);
    } catch {}
  };

  const handleFileUploadImport = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binaryStr = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binaryStr += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const base64Data = btoa(binaryStr);
      const updated = await importSingboxBinary({ base64Data });
      setBinaryStatus(updated);
      appendLog(
        `[INFO][sing-box] Imported sing-box binary (${updated.version || "1.14.4"}) to Application Support: ${updated.binary_path}`
      );
      await runSingboxCheck();
    } catch (err: any) {
      appendLog(
        `[ERROR][sing-box] Binary import failed: ${err?.message || String(err)}`
      );
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const effectiveConfigDir =
    lastCheckResult?.configDir ||
    binaryStatus?.config_dir ||
    "~/Library/Application Support/com.antigravity.singboxguiv0";
  const effectiveSingboxCfgPath =
    lastCheckResult?.singboxConfigPath ||
    binaryStatus?.singbox_config_path ||
    `${effectiveConfigDir}/config.json`;
  const effectiveSurgeCfgPath =
    lastCheckResult?.surgeConfigPath ||
    binaryStatus?.surge_config_path ||
    `${effectiveConfigDir}/aSingbox127.conf`;
  const summary = lastCheckResult?.summary;

  return (
    <div className="panel" style={{ padding: "var(--space-4)", minWidth: 0 }}>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleFileUploadImport}
      />

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
          <Cpu size={18} style={{ color: "var(--accent-fg)", flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
              Application Support Config Folder &amp; Sing-box 1.14.4 Binary
              Manager
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>
              Auto-syncs <code>config.json</code> &amp;{" "}
              <code>aSingbox127.conf</code> and stores <code>sing-box</code>{" "}
              inside Tauri&apos;s Application Support directory.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleOpenConfigFolder}
            title={`Open ${effectiveConfigDir} in Finder / File Explorer`}
          >
            <FolderOpen size={13} />
            Open Config Folder
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            title="Upload / Import sing-box executable directly into Application Support directory"
          >
            <Upload size={13} />
            {isImporting ? "Importing..." : "Import Binary"}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={refreshBinaryStatus}
            title="Refresh binary & config directory status"
          >
            <RefreshCw size={13} />
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleRunSingboxCheck}
            disabled={isChecking}
          >
            <Play size={14} />
            {isChecking ? "Syncing & Checking..." : "Sync & Verify Config"}
          </button>
        </div>
      </div>

      {/* Persistent Application Support Paths Card */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "9px 11px",
          borderRadius: 6,
          backgroundColor: "var(--bg-canvas-subtle)",
          border: "1px solid var(--border-default)",
          marginBottom: "var(--space-3)",
          fontSize: 11.5,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              className={`badge ${
                binaryStatus?.imported ? "badge-success" : "badge-warning"
              }`}
            >
              {binaryStatus?.imported
                ? `Binary Ready: sing-box ${binaryStatus.version || "1.14.4"}`
                : "Binary Not Imported Yet (Click 'Import Binary')"}
            </span>
            {summary && (
              <span
                className={`badge ${
                  summary.empty_workspace ? "badge-warning" : "badge-success"
                }`}
              >
                {summary.empty_workspace
                  ? "config.json: 0 Proxy Nodes (Only direct)"
                  : `config.json: ${summary.proxy_outbound_count} Proxy Outbounds | ${summary.socks_user_count} SOCKS5 Users | ${summary.urltest_pool_count} Dynamic Pools`}
              </span>
            )}
          </div>
          {copyNote && (
            <span style={{ color: "var(--success-fg)", fontWeight: 600 }}>
              {copyNote}
            </span>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: "4px 8px",
            alignItems: "center",
            fontSize: 11,
            color: "var(--fg-muted)",
          }}
        >
          <strong>App Support Dir:</strong>
          <code style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {effectiveConfigDir}
          </code>
          <button
            type="button"
            className="btn btn-sm"
            style={{ padding: "1px 6px", fontSize: 10.5 }}
            onClick={() => handleCopyPath(effectiveConfigDir, "Folder Path")}
          >
            <Copy size={10} /> Copy
          </button>

          <strong>Sing-box Config:</strong>
          <code style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {effectiveSingboxCfgPath}
          </code>
          <button
            type="button"
            className="btn btn-sm"
            style={{ padding: "1px 6px", fontSize: 10.5 }}
            onClick={() =>
              handleCopyPath(effectiveSingboxCfgPath, "config.json Path")
            }
          >
            <Copy size={10} /> Copy
          </button>

          <strong>Surge 5.10 Conf:</strong>
          <code style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {effectiveSurgeCfgPath}
          </code>
          <button
            type="button"
            className="btn btn-sm"
            style={{ padding: "1px 6px", fontSize: 10.5 }}
            onClick={() =>
              handleCopyPath(effectiveSurgeCfgPath, "aSingbox127.conf Path")
            }
          >
            <Copy size={10} /> Copy
          </button>

          <strong>Active Binary:</strong>
          <code style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {binaryStatus?.binary_path || `${effectiveConfigDir}/sing-box`}
          </code>
          <button
            type="button"
            className="btn btn-sm"
            style={{ padding: "1px 6px", fontSize: 10.5 }}
            onClick={() =>
              handleCopyPath(
                binaryStatus?.binary_path || `${effectiveConfigDir}/sing-box`,
                "Binary Path"
              )
            }
          >
            <Copy size={10} /> Copy
          </button>
        </div>
      </div>

      {lastCheckResult && (
        <div
          style={{
            padding: "var(--space-3)",
            borderRadius: "6px",
            background: !lastCheckResult.valid
              ? "var(--danger-subtle)"
              : lastCheckResult.emptyWorkspace
              ? "var(--warning-subtle)"
              : "var(--success-subtle)",
            border: `1px solid ${
              !lastCheckResult.valid
                ? "var(--danger-fg)"
                : lastCheckResult.emptyWorkspace
                ? "var(--warning-fg)"
                : "var(--success-fg)"
            }`,
            fontSize: "var(--text-xs)",
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
          }}
        >
          {!lastCheckResult.valid ? (
            <AlertCircle
              size={16}
              style={{
                color: "var(--danger-fg)",
                flexShrink: 0,
                marginTop: "2px",
              }}
            />
          ) : lastCheckResult.emptyWorkspace ? (
            <AlertTriangle
              size={16}
              style={{
                color: "var(--warning-fg)",
                flexShrink: 0,
                marginTop: "2px",
              }}
            />
          ) : (
            <CheckCircle2
              size={16}
              style={{
                color: "var(--success-fg)",
                flexShrink: 0,
                marginTop: "2px",
              }}
            />
          )}
          <div style={{ minWidth: 0, wordBreak: "break-word" }}>
            <div style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>
              {lastCheckResult.version} ({lastCheckResult.checkedAt})
            </div>
            <div
              style={{
                color: "var(--fg-muted)",
                fontFamily: "var(--font-mono)",
                marginTop: "2px",
              }}
            >
              {lastCheckResult.commandOutput}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
