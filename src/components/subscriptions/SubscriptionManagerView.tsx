import React, { useRef, useState } from "react";
import {
  Clock,
  Download,
  FileCode,
  FolderUp,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import {
  DEFAULT_USER_AGENT_TYPE,
  USER_AGENT_PRESETS,
} from "../../config/defaultSubscriptions";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { UserAgentType } from "../../types/subscription";
import {
  formatBytes,
  formatExpireDate,
  searchJsonPaths,
} from "../../utils/subscriptionHelpers";

export const SubscriptionManagerView: React.FC = () => {
  const subscriptions = useWorkspaceStore((s) => s.subscriptions);
  const summaries = useWorkspaceStore((s) => s.summaries);
  const isFetchingSub = useWorkspaceStore((s) => s.isFetchingSub);
  const subFeedback = useWorkspaceStore((s) => s.subFeedback);
  const clearSubFeedback = useWorkspaceStore((s) => s.clearSubFeedback);
  const addOrFetchSubscription = useWorkspaceStore(
    (s) => s.addOrFetchSubscription
  );
  const toggleSubscriptionEnabled = useWorkspaceStore(
    (s) => s.toggleSubscriptionEnabled
  );
  const updateSubscriptionItem = useWorkspaceStore(
    (s) => s.updateSubscriptionItem
  );
  const deleteSubscriptionItem = useWorkspaceStore(
    (s) => s.deleteSubscriptionItem
  );
  const resetDemoSubscriptions = useWorkspaceStore(
    (s) => s.resetDemoSubscriptions
  );
  const lastFailedRawResponse = useWorkspaceStore(
    (s) => s.lastFailedRawResponse
  );
  const clearAllSubscriptions = useWorkspaceStore(
    (s) => s.clearAllSubscriptions
  );
  const singboxConfig = useWorkspaceStore((s) => s.singboxConfig);

  const [prefix, setPrefix] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [userAgentType, setUserAgentType] = useState<UserAgentType>(
    DEFAULT_USER_AGENT_TYPE
  );
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [jsonSearchKeyword, setJsonSearchKeyword] = useState<string>("");
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
  const [pastedRawText, setPastedRawText] = useState<string>("");
  const [showFailedRawModal, setShowFailedRawModal] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFetchClick = async () => {
    const ok = await addOrFetchSubscription({
      prefix,
      url,
      userAgentType,
    });
    if (ok) {
      setPrefix("");
      setUrl("");
    }
  };

  const handlePasteImport = async () => {
    const guessedPrefix = prefix.trim() || "LOCAL";
    const ok = await addOrFetchSubscription({
      prefix: guessedPrefix,
      name: `${guessedPrefix} (Pasted)`,
      url: `local://${guessedPrefix}.yaml`,
      userAgentType,
      rawContentOverride: pastedRawText,
    });
    if (ok) {
      setPastedRawText("");
      setPrefix("");
      setShowPasteModal(false);
    }
  };

  const handleUploadLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const content = String(reader.result || "");
      const guessedPrefix =
        prefix.trim() ||
        file.name
          .replace(/\.(yaml|yml|json|txt)$/i, "")
          .slice(0, 6)
          .toUpperCase();
      const ok = await addOrFetchSubscription({
        prefix: guessedPrefix,
        name: file.name,
        url: `local://${file.name}`,
        userAgentType,
        rawContentOverride: content,
      });
      if (ok) {
        setPrefix("");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const jsonPathMatches = searchJsonPaths(
    singboxConfig,
    jsonSearchKeyword.trim() || "outbounds",
    30
  );

  return (
    <div className="view-container">
      {/* Add / Fetch Subscription Card */}
      <div className="primer-box">
        <div className="primer-box-header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span>Subscription Downloader &amp; Local YAML/JSON Importer</span>
            <span className="primer-label primer-label-accent">
              Default UA: clash-verge/v2.4.7
            </span>
            <span className="primer-label primer-label-neutral">
              Default Auto-Update: 0 (Disabled)
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              className="primer-btn primer-card-action-btn"
              onClick={resetDemoSubscriptions}
              title="Load built-in LC, XF, YY sample subscriptions for testing"
            >
              <RotateCcw size={12} />
              <span>Load Sample Subscriptions</span>
            </button>
            {subscriptions.length > 0 && (
              <button
                type="button"
                className="primer-btn primer-card-action-btn primer-btn-danger"
                onClick={clearAllSubscriptions}
                title="Remove all subscriptions and chain rules"
              >
                <Trash2 size={12} />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        <div
          className="primer-box-body"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          {subFeedback && (
            <div
              className={`primer-banner ${
                subFeedback.type === "danger"
                  ? "primer-banner-warning"
                  : "primer-banner-info"
              }`}
              style={{ flexWrap: "wrap" }}
            >
              <div className="primer-banner-main">
                <div className="primer-banner-content">
                  <div className="primer-banner-title">
                    {subFeedback.message}
                  </div>
                </div>
              </div>
              <div className="primer-banner-actions">
                {lastFailedRawResponse && (
                  <button
                    type="button"
                    className="primer-btn primer-card-action-btn"
                    onClick={() => setShowFailedRawModal(true)}
                  >
                    <FileCode size={12} />
                    <span>Inspect Raw Response</span>
                  </button>
                )}
                <button
                  type="button"
                  className="primer-btn primer-card-action-btn"
                  onClick={clearSubFeedback}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <input
              className="primer-input"
              style={{ width: 120, flex: "0 0 120px" }}
              maxLength={8}
              placeholder="Prefix (e.g. LC)"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
            />
            <span style={{ fontWeight: 700, color: "var(--fg-muted)" }}>-</span>
            <input
              className="primer-input"
              style={{ flex: "1 1 240px", minWidth: 200 }}
              placeholder="https://provider.example/sub?token=... (Mihomo YAML / JSON / Base64)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <select
              className="primer-input"
              style={{ width: "auto", minWidth: 210, flex: "0 1 245px" }}
              value={userAgentType}
              onChange={(e) =>
                setUserAgentType(e.target.value as UserAgentType)
              }
            >
              {USER_AGENT_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="primer-btn primer-btn-primary"
              disabled={isFetchingSub}
              onClick={handleFetchClick}
            >
              <Download size={13} />
              <span>{isFetchingSub ? "Fetching..." : "Fetch & Convert"}</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".yaml,.yml,.json,.txt"
              style={{ display: "none" }}
              onChange={handleUploadLocalFile}
            />
            <button
              type="button"
              className="primer-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <FolderUp size={13} />
              <span>Import Local File</span>
            </button>
            <button
              type="button"
              className="primer-btn"
              onClick={() => setShowPasteModal((v) => !v)}
            >
              <FileCode size={13} />
              <span>{showPasteModal ? "Close Paste Box" : "Paste YAML / Base64"}</span>
            </button>
          </div>

          {showPasteModal && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 12,
                borderRadius: 6,
                backgroundColor: "var(--bg-canvas-subtle)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 12 }}>
                  Paste Raw Mihomo YAML, Sing-box JSON, or Base64/URI Share Links
                </span>
                <button
                  type="button"
                  className="primer-btn primer-btn-primary"
                  disabled={!pastedRawText.trim()}
                  onClick={handlePasteImport}
                >
                  Convert &amp; Save Pasted Content
                </button>
              </div>
              <textarea
                className="primer-textarea"
                rows={7}
                placeholder="Paste proxies: [...] YAML, Sing-box outbounds JSON, or vless:// / hysteria2:// / trojan:// / ss:// links..."
                value={pastedRawText}
                onChange={(e) => setPastedRawText(e.target.value)}
              />
            </div>
          )}

          {showFailedRawModal && lastFailedRawResponse && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 12,
                borderRadius: 6,
                backgroundColor: "var(--bg-canvas-subtle)",
                border: "1px solid var(--fg-attention)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 12 }}>
                  Raw Server Response for [{lastFailedRawResponse.prefix}] (
                  {lastFailedRawResponse.url})
                </span>
                <button
                  type="button"
                  className="primer-btn primer-card-action-btn"
                  onClick={() => setShowFailedRawModal(false)}
                >
                  Close
                </button>
              </div>
              <pre className="code-block" style={{ maxHeight: 200 }}>
                {lastFailedRawResponse.rawBody.slice(0, 4000)}
              </pre>
            </div>
          )}

          <div style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>
            Active User-Agent header:{" "}
            <code>
              {
                USER_AGENT_PRESETS.find((u) => u.id === userAgentType)
                  ?.uaString
              }
            </code>{" "}
            — All Mihomo YAML subscriptions default to{" "}
            <code>autoUpdateIntervalMinutes = 0</code> (manual update only) and
            automatically extract private authenticated DoH{" "}
            <code>proxy-server-nameserver</code> entries into Sing-box 1.14.4{" "}
            <code>dns.servers</code>.
          </div>
        </div>
      </div>

      {/* Subscription Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {subscriptions.length === 0 && (
          <div
            className="primer-box"
            style={{
              padding: "24px 18px",
              textAlign: "center",
              color: "var(--fg-muted)",
            }}
          >
            No subscriptions imported yet. Enter a Prefix (e.g.{" "}
            <code>LC</code>) and remote URL above, import a local YAML/JSON
            file, or click <strong>Load Sample Subscriptions</strong> to test
            with sample Mihomo configurations.
          </div>
        )}
        {subscriptions.map((sub) => {
          const sum = summaries.find((s) => s.subscriptionId === sub.id);
          const total = sub.userInfo?.total || 0;
          const up = sub.userInfo?.upload || 0;
          const down = sub.userInfo?.download || 0;
          const usedPct =
            total > 0 ? Math.min(100, Math.round(((up + down) / total) * 100)) : 0;
          const isEditing = editingSubId === sub.id;

          return (
            <div key={sub.id} className="primer-box">
              <div className="primer-box-header">
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
                    role="switch"
                    aria-checked={sub.enabled}
                    className="primer-toggle-switch-btn"
                    onClick={() => toggleSubscriptionEnabled(sub.id)}
                  >
                    <span className="primer-toggle-switch-knob" />
                  </button>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--fg-accent)",
                    }}
                  >
                    [{sub.prefix}]
                  </span>
                  <span>{sub.name}</span>
                  <span className="primer-label primer-label-accent">
                    UA: {sub.userAgentString}
                  </span>
                  <span className="primer-label primer-label-neutral">
                    <Clock size={10} />
                    <span>
                      Auto-Update: {sub.autoUpdateIntervalMinutes}m (Off)
                    </span>
                  </span>
                  {sum?.autoDetectedDnsTag && (
                    <span className="primer-label primer-label-done">
                      Auto DoH: {sum.autoDetectedDnsTag} (
                      {sum.autoDetectedDoHServer?.slice(0, 32)}...)
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="primer-label primer-label-success">
                    {sum?.convertedCount || 0} / {sum?.totalRawProxies || 0}{" "}
                    nodes converted
                  </span>
                  <button
                    type="button"
                    className="primer-btn primer-card-action-btn"
                    onClick={() =>
                      setEditingSubId(isEditing ? null : sub.id)
                    }
                  >
                    <FileCode size={12} />
                    <span>{isEditing ? "Hide YAML" : "Edit Raw YAML"}</span>
                  </button>
                  <button
                    type="button"
                    className="primer-btn primer-btn-icon-only primer-btn-danger"
                    onClick={() => deleteSubscriptionItem(sub.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div
                className="primer-box-body"
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {sub.userInfo && total > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11.5,
                        color: "var(--fg-muted)",
                      }}
                    >
                      <span>
                        Upload: <strong>{formatBytes(up)}</strong> | Download:{" "}
                        <strong>{formatBytes(down)}</strong> | Remaining:{" "}
                        <strong>
                          {formatBytes(Math.max(0, total - up - down))}
                        </strong>{" "}
                        / {formatBytes(total)} ({usedPct}%)
                      </span>
                      <span>
                        Expires:{" "}
                        <strong>{formatExpireDate(sub.userInfo.expire)}</strong>
                      </span>
                    </div>
                    <div className="primer-quota-meter">
                      <div
                        className="primer-quota-meter-fill"
                        style={{
                          width: `${usedPct}%`,
                          backgroundColor: "var(--fg-accent)",
                        }}
                      />
                    </div>
                  </div>
                )}

                {isEditing && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 11.5,
                      }}
                    >
                      <span>Auto-Update Interval (minutes, 0 = disabled):</span>
                      <input
                        type="number"
                        className="primer-input"
                        style={{ width: 90 }}
                        min={0}
                        value={sub.autoUpdateIntervalMinutes}
                        onChange={(e) =>
                          updateSubscriptionItem(sub.id, {
                            autoUpdateIntervalMinutes: Math.max(
                              0,
                              Number(e.target.value) || 0
                            ),
                          })
                        }
                      />
                    </div>
                    <textarea
                      className="primer-textarea"
                      rows={10}
                      value={sub.rawContent}
                      onChange={(e) =>
                        updateSubscriptionItem(sub.id, {
                          rawContent: e.target.value,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* JSONPath Inspector on Compiled Sing-box 1.14.4 Config */}
      <div className="primer-box">
        <div className="primer-box-header">
          <span>Compiled Sing-box 1.14.4 JSONPath Inspector</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Search size={13} />
            <input
              className="primer-input"
              style={{ width: 220 }}
              value={jsonSearchKeyword}
              onChange={(e) => setJsonSearchKeyword(e.target.value)}
              placeholder="Search JSON key or value (e.g. detour)"
            />
          </div>
        </div>
        <div
          className="primer-box-body"
          style={{ maxHeight: 220, overflowY: "auto" }}
        >
          {jsonPathMatches.map((m) => (
            <div
              key={m.path}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "4px 0",
                borderBottom: "1px dashed var(--border-muted)",
                fontSize: 11.5,
              }}
            >
              <code>{m.path}</code>
              <span style={{ color: "var(--fg-muted)" }}>
                {m.valuePreview}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
