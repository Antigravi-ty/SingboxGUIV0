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
  const singboxConfig = useWorkspaceStore((s) => s.singboxConfig);

  const [prefix, setPrefix] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [userAgentType, setUserAgentType] = useState<UserAgentType>(
    DEFAULT_USER_AGENT_TYPE
  );
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [jsonSearchKeyword, setJsonSearchKeyword] =
    useState<string>("domain_resolver");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFetchClick = async () => {
    await addOrFetchSubscription({
      prefix,
      url,
      userAgentType,
    });
    setPrefix("");
    setUrl("");
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
          .replace(/\.(yaml|yml|json)$/i, "")
          .slice(0, 6)
          .toUpperCase();
      await addOrFetchSubscription({
        prefix: guessedPrefix,
        name: file.name,
        url: `local://${file.name}`,
        userAgentType,
        rawContentOverride: content,
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const jsonPathMatches = searchJsonPaths(singboxConfig, jsonSearchKeyword, 30);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Add / Fetch Subscription Card */}
      <div className="primer-box">
        <div className="primer-box-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Subscription Downloader &amp; Local YAML/JSON Importer</span>
            <span className="primer-label primer-label-accent">
              Default UA: clash-verge/v2.4.7
            </span>
            <span className="primer-label primer-label-neutral">
              Default Auto-Update: 0 (Disabled)
            </span>
          </div>
          <button
            type="button"
            className="primer-btn primer-card-action-btn"
            onClick={resetDemoSubscriptions}
            title="Restore default LC, XF, YY, LT, SE sample subscriptions"
          >
            <RotateCcw size={12} />
            <span>Reset Built-in Samples</span>
          </button>
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
            >
              <div className="primer-banner-main">
                <div className="primer-banner-content">
                  <div className="primer-banner-title">
                    {subFeedback.message}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="primer-btn primer-card-action-btn"
                onClick={clearSubFeedback}
              >
                Dismiss
              </button>
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
              style={{ width: 110 }}
              maxLength={8}
              placeholder="Prefix (e.g. LC)"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
            />
            <span style={{ fontWeight: 700, color: "var(--fg-muted)" }}>-</span>
            <input
              className="primer-input"
              style={{ flex: 1, minWidth: 240 }}
              placeholder="https://provider.example/sub?token=... (or upload local .yaml)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <select
              className="primer-input"
              style={{ width: 245 }}
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
              <span>Import Local YAML</span>
            </button>
          </div>

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
