import React, { useState } from 'react'
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Top Runtime Settings & Binary Validator */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-4)',
        }}
      >
        {/* Left: Sing-box 1.14.4 Core Validator */}
        <div className="panel" style={{ padding: 'var(--space-4)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={18} style={{ color: 'var(--accent-fg)' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                  Sing-box 1.14.4 Stable Schema & Binary Verifier
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
                  Validates <code>route.default_domain_resolver</code>, <code>domain_resolver</code> per outbound,
                  Hysteria2 <code>server_ports</code> (<code>61000:62000</code>), Reality uTLS, and AnyTLS schema.
                </div>
              </div>
            </div>

            <button
              className="btn btn-sm btn-primary"
              onClick={handleRunSingboxCheck}
              disabled={isChecking}
            >
              <Play size={14} />
              {isChecking ? 'Checking...' : 'Run sing-box check'}
            </button>
          </div>

          {lastCheckResult && (
            <div
              style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
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
              <div>
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
        <div className="panel" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-3)' }}>
            <Settings size={16} style={{ color: 'var(--accent-fg)' }} />
            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
              Local SOCKS5 Multiplexer & Surge 5.10 Smart Bridge
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 120px auto',
              gap: '8px',
              alignItems: 'end',
              marginBottom: 'var(--space-3)',
            }}
          >
            <div>
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
            <div>
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
            <button className="btn btn-sm btn-primary" onClick={handleApplyEndpoint}>
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
      <div className="panel" style={{ padding: 'var(--space-4)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={16} style={{ color: 'var(--accent-fg)' }} />
            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
              Sing-box 1.14.4 & Converter Telemetry Console ({logs.length} entries)
            </span>
          </div>
          <button className="btn btn-sm" onClick={clearLogs}>
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
          {logs.map((entry) => {
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
          })}
        </div>
      </div>
    </div>
  )
}
