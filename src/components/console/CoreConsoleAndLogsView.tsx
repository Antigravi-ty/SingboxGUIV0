import React, { useEffect, useState } from 'react'
import {
  Terminal,
  CheckCircle2,
  AlertCircle,
  Play,
  Trash2,
  Settings,
  Cpu,
} from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { checkCoreBinaryStatus } from '../../services/tauriGateway'
import { BinaryStatusInfo } from '../../types/singbox'

export const CoreConsoleAndLogsView: React.FC = () => {
  const {
    listenIp,
    listenPort,
    includeSurgeProxyGroups,
    setNetworkParams,
    lastCheckResult,
    runSingboxCheck,
    logs,
    appendLog,
    clearLogs,
  } = useWorkspaceStore()

  const [ipInput, setIpInput] = useState(listenIp)
  const [portInput, setPortInput] = useState(String(listenPort))
  const [isChecking, setIsChecking] = useState(false)
  const [binaryStatus, setBinaryStatus] = useState<BinaryStatusInfo | null>(null)

  useEffect(() => {
    checkCoreBinaryStatus()
      .then((info) => setBinaryStatus(info))
      .catch(() => {})
  }, [])

  const handleApplyEndpoint = () => {
    const parsedPort = Number(portInput) || 11400
    setNetworkParams({
      listenIp: ipInput.trim() || '127.0.0.1',
      listenPort: parsedPort,
    })
  }

  const handleRunSingboxCheck = async () => {
    setIsChecking(true)
    try {
      await runSingboxCheck()
      const latest = useWorkspaceStore.getState().lastCheckResult
      if (latest) {
        appendLog(
          latest.valid
            ? `[INFO][sing-box] ${latest.version} — ${latest.commandOutput}`
            : `[ERROR][sing-box] ${latest.commandOutput}`,
        )
      }
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="view-container">
      {/* Top Runtime Settings & Binary Validator */}
      <div className="responsive-two-col-grid">
        {/* Left: Sing-box 1.14.4 Core Validator */}
        <div className="panel" style={{ padding: 'var(--space-4)', minWidth: 0 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={18} style={{ color: 'var(--accent-fg)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                  Sing-box 1.14.4 Stable Schema &amp; Binary Verifier
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
                  Validates <code>route.default_domain_resolver</code>, <code>domain_resolver</code> per outbound,
                  Hysteria2 <code>server_ports</code> (<code>61000:62000</code>), Reality uTLS, and AnyTLS schema.
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleRunSingboxCheck}
              disabled={isChecking}
            >
              <Play size={14} />
              {isChecking ? 'Checking...' : 'Run sing-box check'}
            </button>
          </div>

          {binaryStatus && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 'var(--space-3)',
                fontSize: '11px',
              }}
            >
              <span className={`badge ${binaryStatus.imported ? 'badge-success' : 'badge-warning'}`}>
                {binaryStatus.imported
                  ? `Binary Ready: sing-box ${binaryStatus.version || '1.14.4'}`
                  : 'Binary Not Found (Using Schema Validator)'}
              </span>
              {binaryStatus.binary_path && (
                <code style={{ color: 'var(--fg-muted)' }}>{binaryStatus.binary_path}</code>
              )}
            </div>
          )}

          {lastCheckResult && (
            <div
              style={{
                padding: 'var(--space-3)',
                borderRadius: '6px',
                background: lastCheckResult.valid
                  ? 'var(--success-subtle)'
                  : 'var(--danger-subtle)',
                border: `1px solid ${
                  lastCheckResult.valid ? 'var(--success-fg)' : 'var(--danger-fg)'
                }`,
                fontSize: 'var(--text-xs)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              {lastCheckResult.valid ? (
                <CheckCircle2 size={16} style={{ color: 'var(--success-fg)', flexShrink: 0, marginTop: '2px' }} />
              ) : (
                <AlertCircle size={16} style={{ color: 'var(--danger-fg)', flexShrink: 0, marginTop: '2px' }} />
              )}
              <div style={{ minWidth: 0, wordBreak: 'break-word' }}>
                <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {lastCheckResult.version} ({lastCheckResult.checkedAt})
                </div>
                <div style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {lastCheckResult.commandOutput}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Local SOCKS5 Bridge & Surge 5.10 Export Settings */}
        <div className="panel" style={{ padding: 'var(--space-4)', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-3)' }}>
            <Settings size={16} style={{ color: 'var(--accent-fg)', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
              Local SOCKS5 Multiplexer &amp; Surge 5.10 Smart Bridge
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignItems: 'flex-end',
              marginBottom: 'var(--space-3)',
            }}
          >
            <div style={{ flex: '1 1 160px', minWidth: 140 }}>
              <label style={{ fontSize: '11px', color: 'var(--fg-muted)', display: 'block', marginBottom: '4px' }}>
                SOCKS5 Bind IP
              </label>
              <input
                type="text"
                className="text-input"
                style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
              />
            </div>
            <div style={{ flex: '0 1 120px', minWidth: 100 }}>
              <label style={{ fontSize: '11px', color: 'var(--fg-muted)', display: 'block', marginBottom: '4px' }}>
                Listen Port
              </label>
              <input
                type="number"
                className="text-input"
                style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                value={portInput}
                onChange={(e) => setPortInput(e.target.value)}
              />
            </div>
            <button type="button" className="btn btn-sm btn-primary" onClick={handleApplyEndpoint}>
              Apply Endpoint
            </button>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={includeSurgeProxyGroups}
              onChange={(e) =>
                setNetworkParams({ includeSurgeProxyGroups: e.target.checked })
              }
            />
            <span>
              Include <code>[Proxy Group]</code> Smart regex groups (<code>policy-regex-filter</code>) in generated{' '}
              <code>aSingbox127.conf</code>
            </span>
          </label>
        </div>
      </div>

      {/* Console Log Stream */}
      <div className="panel" style={{ padding: 'var(--space-4)', minWidth: 0 }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={16} style={{ color: 'var(--accent-fg)', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
              Sing-box 1.14.4 &amp; Converter Telemetry Console ({logs.length} entries)
            </span>
          </div>
          <button type="button" className="btn btn-sm" onClick={clearLogs}>
            <Trash2 size={12} />
            Clear Console
          </button>
        </div>

        <div
          className="code-block"
          style={{
            maxHeight: '360px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: 'var(--fg-muted)' }}>No console logs recorded.</div>
          ) : (
            logs.map((entry) => {
              const levelColor =
                entry.level === 'ERROR' || entry.level === 'FATAL'
                  ? 'var(--danger-fg)'
                  : entry.level === 'WARN'
                    ? 'var(--warning-fg)'
                    : entry.level === 'DEBUG'
                      ? 'var(--fg-muted)'
                      : 'var(--success-fg)'
              return (
                <div key={entry.id} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                  <span style={{ color: 'var(--fg-muted)' }}>[{entry.timestamp}] </span>
                  <span style={{ color: levelColor, fontWeight: 600 }}>
                    [{entry.level}]
                  </span>{' '}
                  <span style={{ color: 'var(--accent-fg)' }}>[{entry.source}]</span>{' '}
                  <span>{entry.message}</span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

