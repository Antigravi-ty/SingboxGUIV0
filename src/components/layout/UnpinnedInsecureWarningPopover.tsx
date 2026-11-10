import React, { useEffect, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { ConvertedNodeMetadata } from "../../types/singbox";

interface UnpinnedInsecureWarningPopoverProps {
  unpinnedInsecureNodes: ConvertedNodeMetadata[];
  pinnedInsecureCount: number;
  onForceStrictVerify: () => void;
  onInspectTlsPolicy: () => void;
}

export const UnpinnedInsecureWarningPopover: React.FC<
  UnpinnedInsecureWarningPopoverProps
> = ({
  unpinnedInsecureNodes,
  pinnedInsecureCount,
  onForceStrictVerify,
  onInspectTlsPolicy,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  if (unpinnedInsecureNodes.length === 0) return null;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="primer-btn primer-btn-status-attention"
        style={{ padding: "2px 8px", fontSize: 11 }}
        onClick={() => setOpen((v) => !v)}
        title="Nodes with skip-cert-verify: true and NO SHA-256 certificate pinning detected (vulnerable to MITM tampering)"
      >
        <ShieldAlert size={12} />
        <span>{unpinnedInsecureNodes.length} unpinned insecure TLS</span>
      </button>

      {open && (
        <div
          className="primer-select-panel-overlay"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: 360,
            zIndex: 1350,
            padding: 12,
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: 12,
              color: "var(--fg-attention)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
            }}
          >
            <ShieldAlert size={14} />
            <span>
              Unpinned Insecure TLS Nodes ({unpinnedInsecureNodes.length})
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--fg-muted)",
              lineHeight: 1.45,
              marginBottom: 8,
            }}
          >
            These nodes set <code>skip-cert-verify: true</code> without manual
            SHA-256 certificate fingerprint pinning, leaving TLS handshakes
            vulnerable to tampering.
            {pinnedInsecureCount > 0 && (
              <span>
                {" "}
                ({pinnedInsecureCount} other node(s) specify SHA-256 pinning and
                are excluded from this warning.)
              </span>
            )}
          </div>
          <div
            style={{
              maxHeight: 110,
              overflowY: "auto",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              padding: "6px 8px",
              borderRadius: 4,
              backgroundColor: "var(--bg-canvas-subtle)",
              border: "1px solid var(--border-default)",
              marginBottom: 8,
            }}
          >
            {unpinnedInsecureNodes.slice(0, 12).map((n) => (
              <div key={n.tag}>
                • {n.tag} ({n.protocol} @ {n.server}:{n.port})
              </div>
            ))}
            {unpinnedInsecureNodes.length > 12 && (
              <div style={{ color: "var(--fg-muted)" }}>
                ...and {unpinnedInsecureNodes.length - 12} more
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
            <button
              type="button"
              className="primer-btn primer-card-action-btn"
              onClick={() => {
                onForceStrictVerify();
                setOpen(false);
              }}
            >
              Force Strict TLS Verify
            </button>
            <button
              type="button"
              className="primer-btn primer-card-action-btn primer-btn-primary"
              onClick={() => {
                onInspectTlsPolicy();
                setOpen(false);
              }}
            >
              Inspect in TLS Policy
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
