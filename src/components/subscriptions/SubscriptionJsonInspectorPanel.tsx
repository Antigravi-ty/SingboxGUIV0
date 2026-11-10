import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { searchJsonPaths } from "../../utils/subscriptionHelpers";

export const SubscriptionJsonInspectorPanel: React.FC = () => {
  const singboxConfig = useWorkspaceStore((s) => s.singboxConfig);
  const [jsonSearchKeyword, setJsonSearchKeyword] = useState<string>("");

  const jsonPathMatches = useMemo(
    () =>
      searchJsonPaths(
        singboxConfig,
        jsonSearchKeyword.trim() || "outbounds",
        30
      ),
    [singboxConfig, jsonSearchKeyword]
  );

  return (
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
            <span style={{ color: "var(--fg-muted)" }}>{m.valuePreview}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
