import React, { useState } from "react";
import { Clock, FileCode, Trash2 } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { SubscriptionItem } from "../../types/subscription";
import {
  formatBytes,
  formatExpireDate,
} from "../../utils/subscriptionHelpers";

export const SubscriptionItemCard: React.FC<{ sub: SubscriptionItem }> = ({
  sub,
}) => {
  const summaries = useWorkspaceStore((s) => s.summaries);
  const toggleSubscriptionEnabled = useWorkspaceStore(
    (s) => s.toggleSubscriptionEnabled
  );
  const updateSubscriptionItem = useWorkspaceStore(
    (s) => s.updateSubscriptionItem
  );
  const deleteSubscriptionItem = useWorkspaceStore(
    (s) => s.deleteSubscriptionItem
  );

  const [isEditing, setIsEditing] = useState(false);

  const sum = summaries.find((s) => s.subscriptionId === sub.id);
  const total = sub.userInfo?.total || 0;
  const up = sub.userInfo?.upload || 0;
  const down = sub.userInfo?.download || 0;
  const usedPct =
    total > 0 ? Math.min(100, Math.round(((up + down) / total) * 100)) : 0;

  return (
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
            <span>Auto-Update: {sub.autoUpdateIntervalMinutes}m (Off)</span>
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
            {sum?.convertedCount || 0} / {sum?.totalRawProxies || 0} nodes
            converted
          </span>
          <button
            type="button"
            className="primer-btn primer-card-action-btn"
            onClick={() => setIsEditing((v) => !v)}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
                <strong>{formatBytes(Math.max(0, total - up - down))}</strong> /{" "}
                {formatBytes(total)} ({usedPct}%)
              </span>
              <span>
                Expires: <strong>{formatExpireDate(sub.userInfo.expire)}</strong>
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
};
