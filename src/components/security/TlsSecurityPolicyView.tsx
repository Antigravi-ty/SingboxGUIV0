import React from 'react'
import {
  ShieldAlert,
  ShieldCheck,
  Layers,
  AlertTriangle,
} from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { TlsSecurityPolicyMode } from '../../types/singbox'

export const TlsSecurityPolicyView: React.FC = () => {
  const {
    securityPolicy,
    setSecurityPolicy,
    skipCertWarningAcknowledged,
    acknowledgeSkipCertWarning,
    directNodes,
    summaries,
  } = useWorkspaceStore()

  const totalSkipCert = directNodes.filter((n) => n.sourceSkipCertVerify).length
  const totalPinnedCert = directNodes.filter((n) => n.hasCertFingerprintPin).length
  const totalReality = directNodes.filter((n) => n.hasReality).length
  const totalEch = directNodes.filter((n) => n.hasEch).length

  const handleModeChange = (mode: TlsSecurityPolicyMode) => {
    setSecurityPolicy(mode)
  }

  return (
    <div className="view-container">
      {/* Top KPI Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        <div className="panel" style={{ padding: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginBottom: '4px' }}>
            Nodes Requesting skip-cert-verify: true
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span
              style={{
                fontSize: '20px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: totalSkipCert > 0 ? 'var(--warning-fg)' : 'var(--success-fg)',
              }}
            >
              {totalSkipCert}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
              across {summaries.length} subscriptions
            </span>
          </div>
        </div>

        <div className="panel" style={{ padding: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginBottom: '4px' }}>
            SHA256 Fingerprint Pinned (mTLS / Cert Pin)
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span
              style={{
                fontSize: '20px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-fg)',
              }}
            >
              {totalPinnedCert}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
              self-signed + pinned
            </span>
          </div>
        </div>

        <div className="panel" style={{ padding: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginBottom: '4px' }}>
            VLESS Reality (Curve25519 Authenticated)
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span
              style={{
                fontSize: '20px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: 'var(--success-fg)',
              }}
            >
              {totalReality}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
              public-key verified
            </span>
          </div>
        </div>

        <div className="panel" style={{ padding: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginBottom: '4px' }}>
            ECH (Encrypted Client Hello) Enabled
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span
              style={{
                fontSize: '20px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: 'var(--fg-default)',
              }}
            >
              {totalEch}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
              SNI encrypted
            </span>
          </div>
        </div>
      </div>

      {/* Policy Mode Selector & Toggle Switch Panel */}
      <div className="panel" style={{ padding: 'var(--space-4)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <ShieldAlert size={18} style={{ color: 'var(--warning-fg)', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 'var(--text-md)' }}>
              Sing-box 1.14.4 TLS Certificate Verification Policy (<code>tls.insecure</code>)
            </span>
          </div>

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: 'var(--text-xs)',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border-default)',
              background: skipCertWarningAcknowledged ? 'var(--success-subtle)' : 'var(--warning-subtle)',
            }}
          >
            <input
              type="checkbox"
              checked={skipCertWarningAcknowledged}
              onChange={(e) => acknowledgeSkipCertWarning(e.target.checked)}
            />
            <span style={{ fontWeight: 600 }}>
              Acknowledge Self-Signed Outer Tunnel Risk (<code>skip-cert-verify: true</code>)
            </span>
          </label>
        </div>

        {!skipCertWarningAcknowledged && securityPolicy !== 'enforce_strict_tls' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-3)',
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-3)',
              borderRadius: '6px',
              background: 'var(--warning-subtle)',
              border: '1px solid var(--warning-fg)',
              fontSize: 'var(--text-xs)',
            }}
          >
            <AlertTriangle size={18} style={{ color: 'var(--warning-fg)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--fg-default)', marginBottom: '4px' }}>
                Outer Tunnel Certificate Verification Bypassed on {totalSkipCert} Node(s)
              </div>
              <div style={{ color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                When <code>skip-cert-verify: true</code> (converted to Sing-box <code>"insecure": true</code>) is enabled,
                your end-to-end HTTPS websites remain encrypted by the inner browser TLS layer ("onion inner layer"), so an
                intermediary CANNOT read your HTTPS passwords or page bodies. However, without outer certificate verification,
                an active on-path attacker could impersonate the proxy server, capture the outer proxy password/UUID, and
                observe target destination hostnames (SNI/DNS) if not using ECH or Reality.
              </div>
            </div>
          </div>
        )}

        <div className="responsive-three-col-grid">
          <div
            onClick={() => handleModeChange('follow_source_with_warning')}
            style={{
              padding: 'var(--space-3)',
              borderRadius: '6px',
              border:
                securityPolicy === 'follow_source_with_warning'
                  ? '2px solid var(--accent-fg)'
                  : '1px solid var(--border-default)',
              background:
                securityPolicy === 'follow_source_with_warning'
                  ? 'var(--bg-subtle)'
                  : 'var(--bg-canvas)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                1. Follow Subscription Source (Recommended)
              </span>
              {securityPolicy === 'follow_source_with_warning' && (
                <span className="badge badge-accent">Active</span>
              )}
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', margin: 0, lineHeight: 1.5 }}>
              Preserves <code>skip-cert-verify: true</code> as Sing-box <code>"insecure": true</code> where specified by the
              provider (such as Hysteria2 / AnyTLS self-signed nodes). Guarantees 100% node connectivity while surfacing
              audit counts.
            </p>
          </div>

          <div
            onClick={() => handleModeChange('allow_quic_self_signed_only')}
            style={{
              padding: 'var(--space-3)',
              borderRadius: '6px',
              border:
                securityPolicy === 'allow_quic_self_signed_only'
                  ? '2px solid var(--accent-fg)'
                  : '1px solid var(--border-default)',
              background:
                securityPolicy === 'allow_quic_self_signed_only'
                  ? 'var(--bg-subtle)'
                  : 'var(--bg-canvas)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                2. Allow Self-Signed on QUIC / Pinned Only
              </span>
              {securityPolicy === 'allow_quic_self_signed_only' && (
                <span className="badge badge-accent">Active</span>
              )}
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', margin: 0, lineHeight: 1.5 }}>
              Allows <code>"insecure": true</code> only on Hysteria2, TUIC, Reality, or nodes with explicit SHA-256
              <code>fingerprint</code> / <code>certificate</code> pinning. Enforces strict CA verification on standard TCP
              VMess/Trojan/AnyTLS nodes.
            </p>
          </div>

          <div
            onClick={() => handleModeChange('enforce_strict_tls')}
            style={{
              padding: 'var(--space-3)',
              borderRadius: '6px',
              border:
                securityPolicy === 'enforce_strict_tls'
                  ? '2px solid var(--accent-fg)'
                  : '1px solid var(--border-default)',
              background:
                securityPolicy === 'enforce_strict_tls'
                  ? 'var(--bg-subtle)'
                  : 'var(--bg-canvas)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                3. Enforce Strict CA Verification (<code>insecure: false</code>)
              </span>
              {securityPolicy === 'enforce_strict_tls' && (
                <span className="badge badge-success">Strict</span>
              )}
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', margin: 0, lineHeight: 1.5 }}>
              Forces <code>"insecure": false</code> across every outbound regardless of subscription YAML settings. Warning:
              nodes using self-signed certificates or spoofed SNI (<code>bing.com</code>) without Reality will fail TLS handshake.
            </p>
          </div>
        </div>
      </div>

      {/* Deep-Dive Onion Encryption Architecture Comparison */}
      <div className="responsive-two-col-grid">
        <div className="panel" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-3)' }}>
            <Layers size={16} style={{ color: 'var(--accent-fg)', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
              Onion Layer Security Model: What <code>skip-cert-verify: true</code> Actually Means
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: 'var(--text-xs)', lineHeight: 1.55 }}>
            <div
              style={{
                padding: '10px',
                borderRadius: '6px',
                background: 'var(--bg-subtle)',
                borderLeft: '3px solid var(--success-fg)',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--fg-default)', marginBottom: '2px' }}>
                Inner Layer (Browser / App End-to-End TLS 1.3): SAFE
              </div>
              <div style={{ color: 'var(--fg-muted)' }}>
                When you visit <code>https://github.com</code> or bank websites, your browser performs an independent TLS
                handshake directly with the destination website. Even if the outer proxy peels off its tunnel encryption like
                an onion, the payload inside is still TLS-encrypted ciphertext verified by your OS root CA store.
              </div>
            </div>

            <div
              style={{
                padding: '10px',
                borderRadius: '6px',
                background: 'var(--bg-subtle)',
                borderLeft: '3px solid var(--warning-fg)',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--fg-default)', marginBottom: '2px' }}>
                Outer Layer (Sing-box Client to Proxy Node Tunnel): MITM Metadata &amp; Credential Risk
              </div>
              <div style={{ color: 'var(--fg-muted)' }}>
                Why do providers set <code>skip-cert-verify: true</code>? Usually because the node uses a self-signed cert
                (common on Hysteria2 UDP) or sets <code>sni: www.bing.com</code> for censorship circumvention without owning
                Microsoft&apos;s private key. However, if an active middlebox intercepts your connection before it reaches the proxy:
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  <li>It can capture the outer proxy credential (Trojan/AnyTLS/Hysteria2 password or VLESS UUID).</li>
                  <li>It can see the target domain/IP you asked the proxy to dial (CONNECT metadata).</li>
                  <li>It can intercept plain HTTP (<code>http://</code>) or unencrypted DNS traffic inside the tunnel.</li>
                </ul>
              </div>
            </div>

            <div
              style={{
                padding: '10px',
                borderRadius: '6px',
                background: 'var(--bg-subtle)',
                borderLeft: '3px solid var(--accent-fg)',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--fg-default)', marginBottom: '2px' }}>
                Why Chain Proxy (<code>LC -&gt; YY</code>) or Reality Mitigates This
              </div>
              <div style={{ color: 'var(--fg-muted)' }}>
                1. <strong>VLESS Reality</strong> uses Curve25519 <code>public-key</code> authentication instead of X.509 CA
                certificates, making it immune to self-signed MITM even when camouflaging SNI.<br />
                2. <strong>Certificate Fingerprint Pinning</strong> (seen in <code>exampleComplex.yaml</code>) pins the exact
                SHA-256 cert hash.<br />
                3. <strong>Chain Proxy (<code>detour</code>)</strong> wraps the exit node handshake inside an already-encrypted first-hop
                tunnel, protecting against local ISP MITM.
              </div>
            </div>
          </div>
        </div>

        {/* Subscription TLS Audit Breakdown Table */}
        <div className="panel" style={{ padding: 'var(--space-4)', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} style={{ color: 'var(--success-fg)', flexShrink: 0 }} />
              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
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
                    <td colSpan={7} style={{ textAlign: 'center', padding: '18px 12px', color: 'var(--fg-muted)' }}>
                      No subscriptions imported yet. Import a subscription to audit its TLS &amp; Reality security posture.
                    </td>
                  </tr>
                ) : (
                  summaries.map((s) => {
                    const subNodes = directNodes.filter((n) => n.providerPrefix === s.prefix)
                    const pinnedCount = subNodes.filter((n) => n.hasCertFingerprintPin).length
                    const realityCount = subNodes.filter((n) => n.hasReality).length
                    const echCount = subNodes.filter((n) => n.hasEch).length
                    return (
                      <tr key={s.subscriptionId}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.prefix}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{s.convertedCount}</td>
                        <td>
                          {s.insecureNodeCount > 0 ? (
                            <span className="badge badge-warning">{s.insecureNodeCount} insecure</span>
                          ) : (
                            <span className="badge badge-success">0</span>
                          )}
                        </td>
                        <td>
                          {pinnedCount > 0 ? (
                            <span className="badge badge-accent">{pinnedCount} pinned</span>
                          ) : (
                            <span style={{ color: 'var(--fg-muted)' }}>0</span>
                          )}
                        </td>
                        <td>
                          {realityCount > 0 ? (
                            <span className="badge badge-success">{realityCount} reality</span>
                          ) : (
                            <span style={{ color: 'var(--fg-muted)' }}>0</span>
                          )}
                        </td>
                        <td>
                          {echCount > 0 ? (
                            <span className="badge badge-accent">{echCount} ech</span>
                          ) : (
                            <span style={{ color: 'var(--fg-muted)' }}>0</span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                          {s.autoDetectedDoHServer ? (
                            <span className="badge badge-accent" title={s.autoDetectedDoHServer}>
                              {s.autoDetectedDnsTag || 'DoH'}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--fg-muted)' }}>Default</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
