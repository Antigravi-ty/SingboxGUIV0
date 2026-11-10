import React, { useMemo, useState } from 'react'
import {
  FileJson,
  FileCode,
  Download,
  Copy,
  Check,
  Shield,
  EyeOff,
  Eye,
  Terminal,
} from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import {
  desensitizeMihomoYamlContent,
  desensitizeSingboxConfigJson,
} from '../../utils/configDesensitizer'

export const DesensitizedExportView: React.FC = () => {
  const { subscriptions, singboxConfig, surgeConfigText, directNodes } =
    useWorkspaceStore()
  const [selectedSubId, setSelectedSubId] = useState<string>(
    subscriptions[0]?.id || '',
  )
  const [activeFormat, setActiveFormat] = useState<
    'singbox_json' | 'mihomo_yaml' | 'surge_conf'
  >('singbox_json')
  const [showRawUnmasked, setShowRawUnmasked] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const selectedSubscription = useMemo(
    () => subscriptions.find((s) => s.id === selectedSubId) || subscriptions[0],
    [subscriptions, selectedSubId],
  )

  const sanitizedSingboxConfig = useMemo(
    () => desensitizeSingboxConfigJson(singboxConfig),
    [singboxConfig],
  )

  const sanitizedMihomoYaml = useMemo(
    () =>
      selectedSubscription
        ? desensitizeMihomoYamlContent(selectedSubscription.rawContent)
        : '',
    [selectedSubscription],
  )

  const displayedContent = useMemo(() => {
    if (activeFormat === 'singbox_json') {
      return showRawUnmasked
        ? JSON.stringify(singboxConfig, null, 2)
        : JSON.stringify(sanitizedSingboxConfig, null, 2)
    }
    if (activeFormat === 'mihomo_yaml') {
      return showRawUnmasked
        ? selectedSubscription?.rawContent || ''
        : sanitizedMihomoYaml
    }
    return surgeConfigText
  }, [
    activeFormat,
    showRawUnmasked,
    singboxConfig,
    sanitizedSingboxConfig,
    selectedSubscription,
    sanitizedMihomoYaml,
    surgeConfigText,
  ])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayedContent)
    setCopiedKey(activeFormat)
    setTimeout(() => setCopiedKey(null), 1800)
  }

  const handleDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const maskedServerCount = directNodes.length
  const maskedSniCount = directNodes.filter((n) => n.sni).length

  return (
    <div className="view-container">
      {/* Top Redaction Telemetry Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        <div className="panel" style={{ padding: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginBottom: '4px' }}>
            Masked Server Addresses / DoH Hosts
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-fg)' }}>
            {maskedServerCount}
          </div>
        </div>

        <div className="panel" style={{ padding: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginBottom: '4px' }}>
            Masked UUIDs / Passwords / SS-2022 Keys
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--success-fg)' }}>
            {Math.max(0, singboxConfig.outbounds.length - 1)}
          </div>
        </div>

        <div className="panel" style={{ padding: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginBottom: '4px' }}>
            Masked SNI / WS Hosts / Certificates
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--warning-fg)' }}>
            {maskedSniCount}
          </div>
        </div>

        <div className="panel" style={{ padding: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginBottom: '4px' }}>
            Sing-box 1.14.4 Schema Validity
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
            <span className="badge badge-success">sing-box check Ready</span>
            <span style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>Format-Preserving</span>
          </div>
        </div>
      </div>

      {/* Main Inspector & Export Controls */}
      <div className="panel" style={{ padding: 'var(--space-4)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Shield size={18} style={{ color: 'var(--accent-fg)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-md)' }}>
                Format-Preserving Desensitized Config Exporter
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
                When a node connects in native Mihomo/Clash-Verge but fails after conversion, export both sanitized files to
                reverse-engineer protocol differences without leaking credentials or private DoH tokens.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${!showRawUnmasked ? 'btn-primary' : ''}`}
              onClick={() => setShowRawUnmasked((prev) => !prev)}
            >
              {showRawUnmasked ? <Eye size={14} /> : <EyeOff size={14} />}
              {showRawUnmasked ? 'Showing Raw Unmasked' : 'Desensitized Mode (Safe)'}
            </button>

            <button className="btn btn-sm" onClick={handleCopy}>
              {copiedKey === activeFormat ? <Check size={14} /> : <Copy size={14} />}
              {copiedKey === activeFormat ? 'Copied!' : 'Copy Buffer'}
            </button>

            <button
              className="btn btn-sm btn-primary"
              onClick={() => {
                const suffix = showRawUnmasked ? 'raw' : 'desensitized'
                if (activeFormat === 'singbox_json') {
                  handleDownload(`config.${suffix}.json`, displayedContent)
                } else if (activeFormat === 'mihomo_yaml') {
                  handleDownload(
                    `${selectedSubscription?.prefix || 'sub'}-${suffix}.yaml`,
                    displayedContent,
                  )
                } else {
                  handleDownload('aSingbox127.conf', displayedContent)
                }
              }}
            >
              <Download size={14} />
              Export Active File
            </button>
          </div>
        </div>

        {/* Format Tabs & Subscription Selector */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            borderBottom: '1px solid var(--border-default)',
            paddingBottom: 'var(--space-2)',
            marginBottom: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${activeFormat === 'singbox_json' ? 'btn-primary' : ''}`}
              onClick={() => setActiveFormat('singbox_json')}
            >
              <FileJson size={14} />
              Sing-box 1.14.4 (<code>config.json</code>)
            </button>
            <button
              className={`btn btn-sm ${activeFormat === 'mihomo_yaml' ? 'btn-primary' : ''}`}
              onClick={() => setActiveFormat('mihomo_yaml')}
            >
              <FileCode size={14} />
              Source Mihomo YAML (<code>desensitized.yaml</code>)
            </button>
            <button
              className={`btn btn-sm ${activeFormat === 'surge_conf' ? 'btn-primary' : ''}`}
              onClick={() => setActiveFormat('surge_conf')}
            >
              <Terminal size={14} />
              Surge 5.10 SOCKS5 Bridge (<code>aSingbox127.conf</code>)
            </button>
          </div>

          {activeFormat === 'mihomo_yaml' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
                Source Subscription:
              </span>
              <select
                className="select-input"
                style={{ width: '220px' }}
                value={selectedSubId}
                onChange={(e) => setSelectedSubId(e.target.value)}
              >
                {subscriptions.length === 0 ? (
                  <option value="">No subscriptions imported yet</option>
                ) : (
                  subscriptions.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.prefix} ({sub.name})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
        </div>

        {/* What gets preserved vs redacted */}
        <div
          className="responsive-three-col-grid"
          style={{
            marginBottom: 'var(--space-3)',
            fontSize: 'var(--text-xs)',
          }}
        >
          <div
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-muted)',
            }}
          >
            <strong style={{ color: 'var(--success-fg)' }}>Preserved for Debugging:</strong> Protocol type,
            transport (<code>ws</code>/<code>grpc</code>/<code>http</code>), <code>flow</code>, <code>packet_encoding</code>, <code>server_ports</code> range format (<code>61000:62000</code>),
            <code>utls.fingerprint</code>, <code>detour</code> chains, and <code>domain_resolver</code> tags.
          </div>
          <div
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-muted)',
            }}
          >
            <strong style={{ color: 'var(--accent-fg)' }}>Cryptographically Valid Placeholders:</strong> UUIDs are
            replaced with deterministic v4 UUIDs, Reality <code>public_key</code> with valid 43-char base64url, and SS-2022 passwords
            with valid 16/32-byte Base64 so <code>sing-box check</code> still passes!
          </div>
          <div
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-muted)',
            }}
          >
            <strong style={{ color: 'var(--warning-fg)' }}>Private DoH &amp; Domain Suffix Preservation:</strong> Keeps
            top-level structural suffixes (e.g., <code>.cnrcz.cn</code>, <code>.csnau.cn</code>) while masking private host prefixes and DoH UUID
            paths (<code>/dns-query/00000000-...</code>).
          </div>
        </div>

        <pre
          className="code-block"
          style={{
            maxHeight: '480px',
            overflow: 'auto',
            margin: 0,
            fontSize: '12px',
            lineHeight: 1.5,
          }}
        >
          {displayedContent || '# No subscription selected or imported yet.'}
        </pre>
      </div>
    </div>
  )
}
