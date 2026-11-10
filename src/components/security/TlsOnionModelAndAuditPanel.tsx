import React from "react";
import { Layers, ShieldCheck } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspaceStore";

export const TlsOnionModelAndAuditPanel: React.FC = () => {
  const { directNodes, summaries } = useWorkspaceStore();

  return (
    <div className="responsive-two-col-grid">
      <div className="panel" style={{ padding: "var(--space-4)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "var(--space-3)",
          }}
        >
          <Layers
            size={16}
            style={{ color: "var(--accent-fg)", flexShrink: 0 }}
          />
          <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
            Onion Layer Security Model: What{" "}
            <code>skip-cert-verify: true</code> Actually Means
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            fontSize: "var(--text-xs)",
            lineHeight: 1.55,
          }}
        >
          <div
            style={{
              padding: "10px",
              borderRadius: "6px",
              background: "var(--bg-subtle)",
              borderLeft: "3px solid var(--success-fg)",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: "var(--fg-default)",
                marginBottom: "2px",
              }}
            >
              Inner Layer (Browser / App End-to-End TLS 1.3): SAFE
            </div>
            <div style={{ color: "var(--fg-muted)" }}>
              When you visit <code>https://github.com</code> or bank websites,
              your browser performs an independent TLS handshake directly with
              the destination website. Even if the outer proxy peels off its
              tunnel encryption like an onion, the payload inside is still
              TLS-encrypted ciphertext verified by your OS root CA store.
            </div>
          </div>

          <div
            style={{
              padding: "10px",
              borderRadius: "6px",
              background: "var(--bg-subtle)",
              borderLeft: "3px solid var(--warning-fg)",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: "var(--fg-default)",
                marginBottom: "2px",
              }}
            >
              Outer Layer (Sing-box Client to Proxy Node Tunnel): MITM Metadata
              &amp; Credential Risk
            </div>
            <div style={{ color: "var(--fg-muted)" }}>
              Why do providers set <code>skip-cert-verify: true</code>? Usually
              because the node uses a self-signed cert (common on Hysteria2 UDP)
              or sets <code>sni: www.bing.com</code> for censorship
              circumvention without owning Microsoft&apos;s private key.
              However, if an active middlebox intercepts your connection before
              it reaches the proxy:
              <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                <li>
                  It can capture the outer proxy credential
                  (Trojan/AnyTLS/Hysteria2 password or VLESS UUID).
                </li>
                <li>
                  It can see the target domain/IP you asked the proxy to dial
                  (CONNECT metadata).
                </li>
                <li>
                  It can intercept plain HTTP (<code>http://</code>) or
                  unencrypted DNS traffic inside the tunnel.
                </li>
              </ul>
            </div>
          </div>

          <div
            style={{
              padding: "10px",
              borderRadius: "6px",
              background: "var(--bg-subtle)",
              borderLeft: "3px solid var(--accent-fg)",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: "var(--fg-default)",
                marginBottom: "2px",
              }}
            >
              Why Chain Proxy (<code>LC -&gt; YY</code>) or Reality Mitigates
              This
            </div>
            <div style={{ color: "var(--fg-muted)" }}>
              1. <strong>VLESS Reality</strong> uses Curve25519{" "}
              <code>public-key</code> authentication instead of X.509 CA
              certificates, making it immune to self-signed MITM even when
              camouflaging SNI.
              <br />
              2. <strong>Certificate Fingerprint Pinning</strong> (seen in{" "}
              <code>exampleComplex.yaml</code>) pins the exact SHA-256 cert
              hash.
              <br />
              3.{" "}
              <strong>
                Chain Proxy (<code>detour</code>)
              </strong>{" "}
              wraps the exit node handshake inside an already-encrypted
              first-hop tunnel, protecting against local ISP MITM.
            </div>
          </div>
        </div>
      </div>

      {/* Subscription TLS Audit Breakdown Table */}
      <div className="panel" style={{ padding: "var(--space-4)", minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: "var(--space-3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ShieldCheck
              size={16}
              style={{ color: "var(--success-fg)", flexShrink: 0 }}
            />
            <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
              Per-Subscription TLS &amp; Cryptographic Audit
            </span>
          </div>
          <span className="badge">{summaries.length} Providers Audited</span>
        </div>

        <div className="primer-datatable-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Prefix</th>
                <th>Nodes</th>
                <th>skip-cert-verify</th>
                <th>SHA256 Pinned</th>
                <th>Reality</th>
                <th>ECH</th>
                <th>Private DoH</th>
              </tr>
            </thead>
            <tbody>
              {summaries.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      padding: "18px 12px",
                      color: "var(--fg-muted)",
                    }}
                  >
                    No subscriptions imported yet. Import a subscription to
                    audit its TLS &amp; Reality security posture.
                  </td>
                </tr>
              ) : (
                summaries.map((s) => {
                  const subNodes = directNodes.filter(
                    (n) => n.providerPrefix === s.prefix
                  );
                  const pinnedCount = subNodes.filter(
                    (n) => n.hasCertFingerprintPin
                  ).length;
                  const realityCount = subNodes.filter(
                    (n) => n.hasReality
                  ).length;
                  const echCount = subNodes.filter((n) => n.hasEch).length;
                  return (
                    <tr key={s.subscriptionId}>
                      <td
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                        }}
                      >
                        {s.prefix}
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>
                        {s.convertedCount}
                      </td>
                      <td>
                        {s.insecureNodeCount > 0 ? (
                          <span className="badge badge-warning">
                            {s.insecureNodeCount} insecure
                          </span>
                        ) : (
                          <span className="badge badge-success">0</span>
                        )}
                      </td>
                      <td>
                        {pinnedCount > 0 ? (
                          <span className="badge badge-accent">
                            {pinnedCount} pinned
                          </span>
                        ) : (
                          <span style={{ color: "var(--fg-muted)" }}>0</span>
                        )}
                      </td>
                      <td>
                        {realityCount > 0 ? (
                          <span className="badge badge-success">
                            {realityCount} reality
                          </span>
                        ) : (
                          <span style={{ color: "var(--fg-muted)" }}>0</span>
                        )}
                      </td>
                      <td>
                        {echCount > 0 ? (
                          <span className="badge badge-accent">
                            {echCount} ech
                          </span>
                        ) : (
                          <span style={{ color: "var(--fg-muted)" }}>0</span>
                        )}
                      </td>
                      <td
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                        }}
                      >
                        {s.autoDetectedDoHServer ? (
                          <span
                            className="badge badge-accent"
                            title={s.autoDetectedDoHServer}
                          >
                            {s.autoDetectedDnsTag || "DoH"}
                          </span>
                        ) : (
                          <span style={{ color: "var(--fg-muted)" }}>
                            Default
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
