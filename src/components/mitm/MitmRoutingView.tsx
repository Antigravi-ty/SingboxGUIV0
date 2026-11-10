import React, { useMemo, useState } from 'react'
import {
  Shield,
  CheckCircle2,
  XCircle,
  Play,
  Plus,
  Trash2,
  Search,
  KeyRound,
  Route,
} from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import {
  toggleMitmEngineListener,
  validateAndImportCaCertPem,
} from '../../services/tauriGateway'
import { evaluateUrlAgainstMitmRules } from '../../utils/ansiLogParser'
import { MitmRouteActionType, ValidationStep } from '../../types/mitm'

const DEFAULT_CERT_SAMPLE = `-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
-----END CERTIFICATE-----`

const DEFAULT_KEY_SAMPLE = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj
MzEfYyjiWA4R4/M2bS1+fWIcPm15A6I3uvd1c0gnB4Xz2w4f4fE9V1e8lO8aG1C2
-----END PRIVATE KEY-----`

export const MitmRoutingView: React.FC = () => {
  const {
    mitmRules,
    addMitmRule,
    toggleMitmRule,
    deleteMitmRule,
    endpoints,
    appendLog,
  } = useWorkspaceStore()

  const [mitmRunning, setMitmRunning] = useState(false)
  const [mitmPort, setMitmPort] = useState(8080)
  const [certPem, setCertPem] = useState(DEFAULT_CERT_SAMPLE)
  const [keyPem, setKeyPem] = useState(DEFAULT_KEY_SAMPLE)
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([])
  const [isValidating, setIsValidating] = useState(false)

  // New URL Regex Rule form state
  const [newRuleName, setNewRuleName] = useState('')
  const [newRulePattern, setNewRulePattern] = useState('')
  const [newRuleAction, setNewRuleAction] =
    useState<MitmRouteActionType>('route_outbound')
  const [newRuleTargetTag, setNewRuleTargetTag] = useState('YY-')

  // Live URL Regex Tester
  const [testUrlInput, setTestUrlInput] = useState(
    'https://api.openai.com/v1/chat/completions',
  )

  const urlEvaluation = useMemo(
    () => evaluateUrlAgainstMitmRules(testUrlInput, 'GET', mitmRules),
    [testUrlInput, mitmRules],
  )

  const handleToggleMitm = async () => {
    const nextState = !mitmRunning
    const res = await toggleMitmEngineListener(nextState, mitmPort)
    setMitmRunning(res.enabled)
    appendLog(`[INFO][MITM] ${res.message}`)
  }

  const handleRunCertValidation = async () => {
    setIsValidating(true)
    try {
      const res = await validateAndImportCaCertPem(certPem, keyPem, false)
      setValidationSteps(res.steps)
      appendLog(
        `[INFO][MITM] Verified Root CA Certificate (${res.subject}, ${res.key_algorithm})`,
      )
    } catch (err: any) {
      appendLog(
        `[ERROR][MITM] Root CA validation error: ${err?.message || String(err)}`,
      )
    } finally {
      setIsValidating(false)
    }
  }

  const handleCreateRule = () => {
    if (!newRuleName.trim() || !newRulePattern.trim()) return
    addMitmRule({
      name: newRuleName.trim(),
      urlRegex: newRulePattern.trim(),
      methods: ['*'],
      actionType: newRuleAction,
      targetOutboundOrGroup: newRuleTargetTag.trim() || 'DIRECT',
      enabled: true,
      note: 'Custom URL Regex routing rule',
    })
    setNewRuleName('')
    setNewRulePattern('')
  }

  const availablePrefixSuggestions = useMemo(() => {
    const prefixes = new Set<string>(['DIRECT', 'REJECT'])
    for (const ep of endpoints.slice(0, 30)) {
      prefixes.add(ep.finalTag)
    }
    return Array.from(prefixes)
  }, [endpoints])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* MITM Engine Header & Port Controls */}
      <div className="panel" style={{ padding: 'var(--space-4)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Route size={18} style={{ color: 'var(--accent-fg)' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-md)' }}>
                MITM Engine & Native URL Regex Routing (Surge Decoupling Layer)
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
                Combines <code>sbagrepo</code> TLS SNI/HTTP sniffing and Root CA MITM inspection with regex-based outbound
                dispatch so URL regex rules can gradually transition off Surge 5.10.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
              MITM Listen Port:
            </span>
            <input
              type="number"
              className="text-input"
              style={{ width: '90px', fontFamily: 'var(--font-mono)' }}
              value={mitmPort}
              onChange={(e) => setMitmPort(Number(e.target.value) || 8080)}
            />
            <button
              className={`btn btn-sm ${mitmRunning ? 'btn-danger' : 'btn-primary'}`}
              onClick={handleToggleMitm}
            >
              <Play size={14} />
              {mitmRunning ? 'Stop MITM Sniffer' : 'Start MITM Sniffer'}
            </button>
          </div>
        </div>
      </div>

      {/* Two-Column Layout: URL Regex Routing Table + 4-Step CA Validator */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.35fr 1fr',
          gap: 'var(--space-4)',
        }}
      >
        {/* Left: URL Regex Routing Rules & Live Tester */}
        <div className="panel" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
              URL Regex Routing Rules ({mitmRules.length})
            </span>
            <span className="badge badge-accent">HTTP/HTTPS Host + Path Regex</span>
          </div>

          {/* Live URL Matcher Box */}
          <div
            style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-default)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Search size={14} style={{ color: 'var(--accent-fg)' }} />
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                Live URL Regex Routing Simulator
              </span>
            </div>
            <input
              type="text"
              className="text-input"
              style={{ width: '100%', fontFamily: 'var(--font-mono)', marginBottom: '8px' }}
              value={testUrlInput}
              onChange={(e) => setTestUrlInput(e.target.value)}
              placeholder="Enter full URL to test routing match..."
            />
            <div style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--fg-muted)' }}>Matched Dispatch:</span>
              {urlEvaluation.matched && urlEvaluation.matchedRule ? (
                <span className="badge badge-success" style={{ fontFamily: 'var(--font-mono)' }}>
                  {urlEvaluation.matchedRule.name} -&gt; {urlEvaluation.actionSummary}
                </span>
              ) : (
                <span className="badge">{urlEvaluation.actionSummary}</span>
              )}
            </div>
          </div>

          {/* Add New URL Regex Rule */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1.4fr 0.9fr 0.9fr auto',
              gap: '6px',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              className="text-input"
              placeholder="Rule Name"
              value={newRuleName}
              onChange={(e) => setNewRuleName(e.target.value)}
            />
            <input
              type="text"
              className="text-input"
              style={{ fontFamily: 'var(--font-mono)' }}
              placeholder="^https?://([a-z0-9-]+\.)?example\.com/"
              value={newRulePattern}
              onChange={(e) => setNewRulePattern(e.target.value)}
            />
            <select
              className="select-input"
              value={newRuleAction}
              onChange={(e) =>
                setNewRuleAction(e.target.value as MitmRouteActionType)
              }
            >
              <option value="route_outbound">Route Outbound</option>
              <option value="inject_header">Inject Header</option>
              <option value="rewrite_url">Rewrite URL</option>
              <option value="mock_response">Mock Response</option>
              <option value="reject_request">Reject Request</option>
            </select>
            <input
              type="text"
              className="text-input"
              list="mitm-outbound-suggestions"
              style={{ fontFamily: 'var(--font-mono)' }}
              placeholder="Target Prefix/Tag"
              value={newRuleTargetTag}
              onChange={(e) => setNewRuleTargetTag(e.target.value)}
            />
            <datalist id="mitm-outbound-suggestions">
              {availablePrefixSuggestions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <button className="btn btn-sm btn-primary" onClick={handleCreateRule}>
              <Plus size={14} />
              Add
            </button>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>On</th>
                <th>Name</th>
                <th>URL Regex Pattern</th>
                <th>Action</th>
                <th>Target Outbound / Group</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mitmRules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => toggleMitmRule(rule.id)}
                    />
                  </td>
                  <td style={{ fontWeight: 600 }}>{rule.name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                    {rule.urlRegex}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        rule.actionType === 'route_outbound'
                          ? 'badge-accent'
                          : rule.actionType === 'reject_request'
                            ? 'badge-danger'
                            : 'badge-success'
                      }`}
                    >
                      {rule.actionType}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {rule.targetOutboundOrGroup}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm"
                      onClick={() => deleteMitmRule(rule.id)}
                      title="Delete rule"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right: 4-Step MITM Root CA Certificate Validator */}
        <div className="panel" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound size={16} style={{ color: 'var(--accent-fg)' }} />
              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                4-Step MITM Root CA Certificate Validator
              </span>
            </div>
            <button
              className="btn btn-sm btn-primary"
              onClick={handleRunCertValidation}
              disabled={isValidating}
            >
              <Shield size={14} />
              {isValidating ? 'Verifying...' : 'Run 4-Step Check'}
            </button>
          </div>

          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
            Validates PEM structure, X.509 BasicConstraints CA flag, validity window, and private key pairing before
            mounting into the MITM engine.
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Root CA Certificate PEM (`cert.pem`)
            </label>
            <textarea
              className="text-input"
              style={{
                width: '100%',
                height: '95px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
              }}
              value={certPem}
              onChange={(e) => setCertPem(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Root CA Private Key PEM (`key.pem`)
            </label>
            <textarea
              className="text-input"
              style={{
                width: '100%',
                height: '95px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
              }}
              value={keyPem}
              onChange={(e) => setKeyPem(e.target.value)}
            />
          </div>

          {validationSteps.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {validationSteps.map((step) => (
                <div
                  key={step.step_number}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-muted)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {step.passed ? (
                      <CheckCircle2 size={14} style={{ color: 'var(--success-fg)' }} />
                    ) : (
                      <XCircle size={14} style={{ color: 'var(--danger-fg)' }} />
                    )}
                    <span style={{ fontWeight: 600 }}>
                      Step {step.step_number}: {step.name}
                    </span>
                  </div>
                  <span style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                    {step.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
