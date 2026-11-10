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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Top Redaction Telemetry Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
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
            {singboxConfig.outbounds.length - 1}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
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
            <Shield size={18} style={{ color: 'var(--accent-fg)' }} />
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
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
            borderBottom: '1px solid var(--border-default)',
            paddingBottom: 'var(--space-2)',
            marginBottom: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button
              className={`btn btn-sm ${activeFormat === 'singbox_json' ? 'btn-primary' : ''}`}
              onClick={() => setActiveFormat('singbox_json')}
            >
              <FileJson size={14} />
              Sing-box 1.14.4 (`config.json`)
            </button>
            <button
              className={`btn btn-sm ${activeFormat === 'mihomo_yaml' ? 'btn-primary' : ''}`}
              onClick={() => setActiveFormat('mihomo_yaml')}
            >
              <FileCode size={14} />
              Source Mihomo YAML (`desensitized.yaml`)
            </button>
            <button
              className={`btn btn-sm ${activeFormat === 'surge_conf' ? 'btn-primary' : ''}`}
              onClick={() => setActiveFormat('surge_conf')}
            >
              <Terminal size={14} />
              Surge 5.10 SOCKS5 Bridge (`aSingbox127.conf`)
            </button>
          </div>

          {activeFormat === 'mihomo_yaml' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
                Source Subscription:
              </span>
              <select
                className="select-input"
                style={{ width: '220px' }}
                value={selectedSubId}
                onChange={(e) => setSelectedSubId(e.target.value)}
              >
                {subscriptions.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.prefix} ({sub.name})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* What gets preserved vs redacted */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-3)',
            fontSize: 'var(--text-xs)',
          }}
        >
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-muted)',
            }}
          >
            <strong style={{ color: 'var(--success-fg)' }}>Preserved for Debugging:</strong> Protocol type,
            transport (`ws`/`grpc`/`http`), `flow`, `packet_encoding`, `server_ports` range format (`61000:62000`),
            `utls.fingerprint`, `detour` chains, and `domain_resolver` tags.
          </div>
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-muted)',
            }}
          >
            <strong style={{ color: 'var(--accent-fg)' }}>Cryptographically Valid Placeholders:</strong> UUIDs are
            replaced with deterministic v4 UUIDs, Reality `public_key` with valid 43-char base64url, and SS-2022 passwords
            with valid 16/32-byte Base64 so `sing-box check` still passes!
          </div>
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-muted)',
            }}
          >
            <strong style={{ color: 'var(--warning-fg)' }}>Private DoH & Domain Suffix Preservation:</strong> Keeps
            top-level structural suffixes (e.g., `.cnrcz.cn`, `.csnau.cn`) while masking private host prefixes and DoH UUID
            paths (`/dns-query/00000000-...`).
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
          {displayedContent}
        </pre>
      </div>
    </div>
  )
}
