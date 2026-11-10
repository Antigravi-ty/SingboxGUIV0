import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ToggleSwitch } from "@primer/react";
import { ArrowDownUp, Terminal, Trash2 } from "lucide-react";
import {
  getSingboxServiceStatus,
  isTauriRuntime,
} from "../../services/tauriGateway";
import { useWorkspaceStore } from "../../stores/workspaceStore";

export const ConsoleRealtimeLogPanel: React.FC = () => {
  const logs = useWorkspaceStore((s) => s.logs);
  const clearLogs = useWorkspaceStore((s) => s.clearLogs);
  const appendLogsBatch = useWorkspaceStore((s) => s.appendLogsBatch);
  const runningMode = useWorkspaceStore((s) => s.runningMode);
  const setRunningMode = useWorkspaceStore((s) => s.setRunningMode);

  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [bottomUpOrder, setBottomUpOrder] = useState<boolean>(false);

  const logScrollRef = useRef<HTMLDivElement | null>(null);
  const seenServiceLinesRef = useRef<Set<string>>(new Set());

  // Subscribe to batched Tauri IPC log stream ("singbox-log-batch") + lightweight status delta poll
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;
    let cancelled = false;

    if (isTauriRuntime()) {
      import("@tauri-apps/api/event")
        .then(({ listen }) =>
          listen<string[]>("singbox-log-batch", (event) => {
            if (cancelled || !Array.isArray(event.payload)) return;
            const fresh: string[] = [];
            for (const raw of event.payload) {
              if (!seenServiceLinesRef.current.has(raw)) {
                seenServiceLinesRef.current.add(raw);
                fresh.push(`[INFO][sing-box] ${raw}`);
              }
            }
            if (fresh.length > 0) {
              appendLogsBatch(fresh);
            }
          })
        )
        .then((unlisten) => {
          if (cancelled) {
            unlisten();
          } else {
            unlistenFn = unlisten;
          }
        })
        .catch(() => {});
    }

    const pollServiceLogs = async () => {
      try {
        const st = await getSingboxServiceStatus();
        if (cancelled) return;
        setRunningMode(st.running ? "normal" : "stopped");
        if (!st.running) {
          seenServiceLinesRef.current.clear();
          return;
        }
        const batch: string[] = [];
        for (const line of st.recent_logs || []) {
          if (!seenServiceLinesRef.current.has(line)) {
            seenServiceLinesRef.current.add(line);
            batch.push(`[INFO][sing-box] ${line}`);
          }
        }
        if (batch.length > 0) {
          appendLogsBatch(batch);
        }
      } catch {
        // ignore
      }
    };

    void pollServiceLogs();
    const intervalMs = runningMode !== "stopped" ? 1000 : 3000;
    const timer = setInterval(pollServiceLogs, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [appendLogsBatch, runningMode, setRunningMode]);

  // Keep only the latest 250 log entries in DOM for instant rendering
  const visibleLogs = useMemo(() => {
    const slice = logs.slice(-250);
    return bottomUpOrder ? [...slice].reverse() : slice;
  }, [logs, bottomUpOrder]);

  // Auto-scroll when new logs arrive
  useLayoutEffect(() => {
    if (!autoScroll || !logScrollRef.current) return;
    const el = logScrollRef.current;
    if (bottomUpOrder) {
      el.scrollTop = 0;
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [visibleLogs, autoScroll, bottomUpOrder]);

  return (
    <div className="panel" style={{ padding: "var(--space-4)", minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "var(--space-3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Terminal
            size={16}
            style={{ color: "var(--accent-fg)", flexShrink: 0 }}
          />
          <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
            Sing-box 1.14.4 Live Console Stream ({logs.length} entries)
          </span>
          {runningMode !== "stopped" && (
            <span className="primer-label primer-label-success">
              IPC Batch Stream Active
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11.5,
            }}
          >
            <span
              id="console-autoscroll-label"
              style={{ color: "var(--fg-muted)", fontWeight: 500 }}
            >
              Auto-Scroll
            </span>
            <ToggleSwitch
              size="small"
              statusLabelPosition="end"
              aria-labelledby="console-autoscroll-label"
              checked={autoScroll}
              onChange={(checked: boolean) => setAutoScroll(checked)}
            />
          </div>

          <button
            type="button"
            className={`btn btn-sm ${
              bottomUpOrder ? "primer-btn-status-accent" : ""
            }`}
            onClick={() => setBottomUpOrder((v) => !v)}
            title="Toggle between chronological (follow bottom) and bottom-up (newest log lines at top)"
          >
            <ArrowDownUp size={12} />
            <span>
              {bottomUpOrder
                ? "Order: Newest First (Bottom-Up)"
                : "Order: Follow Bottom"}
            </span>
          </button>

          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              seenServiceLinesRef.current.clear();
              clearLogs();
            }}
          >
            <Trash2 size={12} />
            Clear Console
          </button>
        </div>
      </div>

      <div
        ref={logScrollRef}
        className="code-block"
        style={{
          maxHeight: "380px",
          minHeight: "220px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          scrollBehavior: "auto",
        }}
      >
        {visibleLogs.length === 0 ? (
          <div style={{ color: "var(--fg-muted)" }}>
            No console logs recorded.
          </div>
        ) : (
          visibleLogs.map((entry) => {
            const levelColor =
              entry.level === "ERROR" || entry.level === "FATAL"
                ? "var(--danger-fg)"
                : entry.level === "WARN"
                ? "var(--warning-fg)"
                : entry.level === "DEBUG"
                ? "var(--fg-muted)"
                : "var(--success-fg)";
            return (
              <div
                key={entry.id}
                style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}
              >
                <span style={{ color: "var(--fg-muted)" }}>
                  [{entry.timestamp}]{" "}
                </span>
                <span style={{ color: levelColor, fontWeight: 600 }}>
                  [{entry.level}]
                </span>{" "}
                <span style={{ color: "var(--accent-fg)" }}>
                  [{entry.source}]
                </span>{" "}
                <span>{entry.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
