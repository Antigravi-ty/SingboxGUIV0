import React from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { TlsSecurityPolicyMode } from "../../types/singbox";
import { TlsOnionModelAndAuditPanel } from "./TlsOnionModelAndAuditPanel";

export const TlsSecurityPolicyView: React.FC = () => {
  const {
    securityPolicy,
    setSecurityPolicy,
    skipCertWarningAcknowledged,
    acknowledgeSkipCertWarning,
    directNodes,
    summaries,
  } = useWorkspaceStore();

  const totalSkipCert = directNodes.filter((n) => n.sourceSkipCertVerify).length;
  const totalPinnedCert = directNodes.filter(
    (n) => n.hasCertFingerprintPin
  ).length;
  const totalReality = directNodes.filter((n) => n.hasReality).length;
  const totalEch = directNodes.filter((n) => n.hasEch).length;

  const handleModeChange = (mode: TlsSecurityPolicyMode) => {
    setSecurityPolicy(mode);
  };

  return (
    <div className="view-container">
      {/* Top KPI Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        <div className="panel" style={{ padding: "var(--space-3)" }}>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--fg-muted)",
              marginBottom: "4px",
            }}
          >
            Nodes Requesting skip-cert-verify: true
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                color:
                  totalSkipCert > 0 ? "var(--warning-fg)" : "var(--success-fg)",
              }}
            >
              {totalSkipCert}
            </span>
            <span
              style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}
            >
              across {summaries.length} subscriptions
            </span>
          </div>
        </div>

        <div className="panel" style={{ padding: "var(--space-3)" }}>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--fg-muted)",
              marginBottom: "4px",
            }}
          >
            SHA256 Fingerprint Pinned (mTLS / Cert Pin)
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                color: "var(--accent-fg)",
              }}
            >
              {totalPinnedCert}
            </span>
            <span
              style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}
            >
              self-signed + pinned
            </span>
          </div>
        </div>

        <div className="panel" style={{ padding: "var(--space-3)" }}>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--fg-muted)",
              marginBottom: "4px",
            }}
          >
            VLESS Reality (Curve25519 Authenticated)
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                color: "var(--success-fg)",
              }}
            >
              {totalReality}
            </span>
            <span
              style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}
            >
              public-key verified
            </span>
          </div>
        </div>

        <div className="panel" style={{ padding: "var(--space-3)" }}>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--fg-muted)",
              marginBottom: "4px",
            }}
          >
            ECH (Encrypted Client Hello) Enabled
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                color: "var(--fg-default)",
              }}
            >
              {totalEch}
            </span>
            <span
              style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}
            >
              SNI encrypted
            </span>
          </div>
        </div>
      </div>

      {/* Policy Mode Selector & Toggle Switch Panel */}
      <div className="panel" style={{ padding: "var(--space-4)" }}>
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}
          >
            <ShieldAlert
              size={18}
              style={{ color: "var(--warning-fg)", flexShrink: 0 }}
            />
            <span style={{ fontWeight: 600, fontSize: "var(--text-md)" }}>
              Sing-box 1.14.4 TLS Certificate Verification Policy (
              <code>tls.insecure</code>)
            </span>
          </div>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              fontSize: "var(--text-xs)",
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border-default)",
              background: skipCertWarningAcknowledged
                ? "var(--success-subtle)"
                : "var(--warning-subtle)",
            }}
          >
            <input
              type="checkbox"
              checked={skipCertWarningAcknowledged}
              onChange={(e) => acknowledgeSkipCertWarning(e.target.checked)}
            />
            <span style={{ fontWeight: 600 }}>
              Acknowledge Self-Signed Outer Tunnel Risk (
              <code>skip-cert-verify: true</code>)
            </span>
          </label>
        </div>

        {!skipCertWarningAcknowledged &&
          securityPolicy !== "enforce_strict_tls" && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--space-3)",
                padding: "var(--space-3)",
                marginBottom: "var(--space-3)",
                borderRadius: "6px",
                background: "var(--warning-subtle)",
                border: "1px solid var(--warning-fg)",
                fontSize: "var(--text-xs)",
              }}
            >
              <AlertTriangle
                size={18}
                style={{
                  color: "var(--warning-fg)",
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              />
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    color: "var(--fg-default)",
                    marginBottom: "4px",
                  }}
                >
                  Outer Tunnel Certificate Verification Bypassed on{" "}
                  {totalSkipCert} Node(s)
                </div>
                <div style={{ color: "var(--fg-muted)", lineHeight: 1.5 }}>
                  When <code>skip-cert-verify: true</code> (converted to
                  Sing-box <code>&quot;insecure&quot;: true</code>) is enabled,
                  your end-to-end HTTPS websites remain encrypted by the inner
                  browser TLS layer (&quot;onion inner layer&quot;), so an
                  intermediary CANNOT read your HTTPS passwords or page bodies.
                  However, without outer certificate verification, an active
                  on-path attacker could impersonate the proxy server, capture
                  the outer proxy password/UUID, and observe target destination
                  hostnames (SNI/DNS) if not using ECH or Reality.
                </div>
              </div>
            </div>
          )}

        <div className="responsive-three-col-grid">
          <div
            onClick={() => handleModeChange("follow_source_with_warning")}
            style={{
              padding: "var(--space-3)",
              borderRadius: "6px",
              border:
                securityPolicy === "follow_source_with_warning"
                  ? "2px solid var(--accent-fg)"
                  : "1px solid var(--border-default)",
              background:
                securityPolicy === "follow_source_with_warning"
                  ? "var(--bg-subtle)"
                  : "var(--bg-canvas)",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
                marginBottom: "6px",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                1. Follow Subscription Source (Recommended)
              </span>
              {securityPolicy === "follow_source_with_warning" && (
                <span className="badge badge-accent">Active</span>
              )}
            </div>
            <p
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--fg-muted)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Preserves <code>skip-cert-verify: true</code> as Sing-box{" "}
              <code>&quot;insecure&quot;: true</code> where specified by the
              provider (such as Hysteria2 / AnyTLS self-signed nodes).
              Guarantees 100% node connectivity while surfacing audit counts.
            </p>
          </div>

          <div
            onClick={() => handleModeChange("allow_quic_self_signed_only")}
            style={{
              padding: "var(--space-3)",
              borderRadius: "6px",
              border:
                securityPolicy === "allow_quic_self_signed_only"
                  ? "2px solid var(--accent-fg)"
                  : "1px solid var(--border-default)",
              background:
                securityPolicy === "allow_quic_self_signed_only"
                  ? "var(--bg-subtle)"
                  : "var(--bg-canvas)",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
                marginBottom: "6px",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                2. Allow Self-Signed on QUIC / Pinned Only
              </span>
              {securityPolicy === "allow_quic_self_signed_only" && (
                <span className="badge badge-accent">Active</span>
              )}
            </div>
            <p
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--fg-muted)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Allows <code>&quot;insecure&quot;: true</code> only on Hysteria2,
              TUIC, Reality, or nodes with explicit SHA-256{" "}
              <code>fingerprint</code> / <code>certificate</code> pinning.
              Enforces strict CA verification on standard TCP
              VMess/Trojan/AnyTLS nodes.
            </p>
          </div>

          <div
            onClick={() => handleModeChange("enforce_strict_tls")}
            style={{
              padding: "var(--space-3)",
              borderRadius: "6px",
              border:
                securityPolicy === "enforce_strict_tls"
                  ? "2px solid var(--accent-fg)"
                  : "1px solid var(--border-default)",
              background:
                securityPolicy === "enforce_strict_tls"
                  ? "var(--bg-subtle)"
                  : "var(--bg-canvas)",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
                marginBottom: "6px",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
                3. Enforce Strict CA Verification (<code>insecure: false</code>)
              </span>
              {securityPolicy === "enforce_strict_tls" && (
                <span className="badge badge-success">Strict</span>
              )}
            </div>
            <p
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--fg-muted)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Forces <code>&quot;insecure&quot;: false</code> across every
              outbound regardless of subscription YAML settings. Warning: nodes
              using self-signed certificates or spoofed SNI (
              <code>bing.com</code>) without Reality will fail TLS handshake.
            </p>
          </div>
        </div>
      </div>

      {/* Deep-Dive Onion Encryption Architecture Comparison & Audit Table */}
      <TlsOnionModelAndAuditPanel />
    </div>
  );
};
