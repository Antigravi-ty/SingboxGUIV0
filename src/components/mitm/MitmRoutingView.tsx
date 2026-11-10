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
  Sparkles,
  RotateCcw,
} from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import {
  generateSelfSignedCaPem,
  sniffAvailableMitmPort,
  toggleMitmEngineListener,
  validateAndImportCaCertPem,
} from '../../services/tauriGateway'
import { evaluateUrlAgainstMitmRules } from '../../utils/ansiLogParser'
import { MitmRouteActionType, ValidationStep } from '../../types/mitm'

export const MitmRoutingView: React.FC = () => {
  const {
    mitmRules,
    addMitmRule,
    toggleMitmRule,
    deleteMitmRule,
    loadSampleMitmRules,
    endpoints,
    appendLog,
  } = useWorkspaceStore()

  const [mitmRunning, setMitmRunning] = useState(false)
  const [mitmPort, setMitmPort] = useState(8080)
  const [certPem, setCertPem] = useState('')
  const [keyPem, setKeyPem] = useState('')
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([])
  const [certError, setCertError] = useState<string | null>(null)
  const [certMetaSummary, setCertMetaSummary] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isGeneratingCa, setIsGeneratingCa] = useState(false)

  // New URL Regex Rule form state
  const [newRuleName, setNewRuleName] = useState('')
  const [newRulePattern, setNewRulePattern] = useState('')
  const [newRuleAction, setNewRuleAction] =
    useState<MitmRouteActionType>('route_outbound')
  const [newRuleTargetTag, setNewRuleTargetTag] = useState('')

  // Live URL Regex Tester
  const [testUrlInput, setTestUrlInput] = useState('')

  const urlEvaluation = useMemo(
    () =>
      testUrlInput.trim()
        ? evaluateUrlAgainstMitmRules(testUrlInput.trim(), 'GET', mitmRules)
        : null,
    [testUrlInput, mitmRules],
  )

  const handleToggleMitm = async () => {
    const nextState = !mitmRunning
    const res = await toggleMitmEngineListener(nextState, mitmPort)
    setMitmRunning(res.enabled)
    appendLog(`[INFO][MITM] ${res.message}`)
  }

  const handleSniffPort = async () => {
    const port = await sniffAvailableMitmPort(mitmPort)
    setMitmPort(port)
    appendLog(`[INFO][MITM] Sniffed available local TCP port: ${port}`)
  }

  const handleGenerateRootCa = async () => {
    setIsGeneratingCa(true)
    setCertError(null)
    try {
      const pair = await generateSelfSignedCaPem()
      setCertPem(pair.cert_pem)
      setKeyPem(pair.key_pem)
      const res = await validateAndImportCaCertPem(
        pair.cert_pem,
        pair.key_pem,
        false,
      )
      setValidationSteps(res.steps)
      setCertMetaSummary(
        `Subject: ${res.subject} | Key: ${res.key_algorithm} | Valid until: ${res.not_after}`,
      )
      appendLog(
        `[INFO][MITM] Generated & verified self-signed Root CA (${res.subject})`,
      )
    } catch (err: any) {
      const msg = err?.message || String(err)
      setCertError(msg)
      appendLog(`[ERROR][MITM] Failed to generate Root CA: ${msg}`)
    } finally {
      setIsGeneratingCa(false)
    }
  }

  const handleRunCertValidation = async () => {
    if (!certPem.trim() || !keyPem.trim()) {
      setCertError(
        'Please paste both a Certificate PEM and a Private Key PEM (or click "Generate Self-Signed CA" first).',
      )
      return
    }
    setIsValidating(true)
    setCertError(null)
    try {
      const res = await validateAndImportCaCertPem(certPem, keyPem, false)
      setValidationSteps(res.steps)
      setCertMetaSummary(
        `Subject: ${res.subject} | Key: ${res.key_algorithm} | Valid until: ${res.not_after}`,
      )
      appendLog(
        `[INFO][MITM] Verified Root CA Certificate (${res.subject}, ${res.key_algorithm})`,
      )
    } catch (err: any) {
      const msg = err?.message || String(err)
      setCertError(msg)
      setValidationSteps([])
      appendLog(`[ERROR][MITM] Root CA validation error: ${msg}`)
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
    setNewRuleTargetTag('')
  }

  const availablePrefixSuggestions = useMemo(() => {
    const prefixes = new Set<string>(['DIRECT', 'REJECT'])
    for (const ep of endpoints.slice(0, 30)) {
      prefixes.add(ep.finalTag)
    }
    return Array.from(prefixes)
  }, [endpoints])

  return (
    <div className="view-container">
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
            <Route size={18} style={{ color: 'var(--accent-fg)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-md)' }}>
                MITM Engine &amp; Native URL Regex Routing (Surge Decoupling Layer)
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
                Combines <code>sbagrepo</code> TLS SNI/HTTP sniffing and Root CA MITM inspection with regex-based outbound
                dispatch so URL regex rules can gradually transition off Surge 5.10.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
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
              type="button"
              className="btn btn-sm"
              onClick={handleSniffPort}
              title="Find an available local TCP port"
            >
              Auto-Sniff Port
            </button>
            <button
              type="button"
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
      <div className="topology-two-col-grid">
        {/* Left: URL Regex Routing Rules & Live Tester */}
        <div
          className="panel"
          style={{
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
              URL Regex Routing Rules ({mitmRules.length})
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={loadSampleMitmRules}
                title="Load built-in sample URL regex rules for testing"
              >
                <RotateCcw size={12} />
                Load Sample Rules
              </button>
              <span className="badge badge-accent">HTTP/HTTPS Host + Path Regex</span>
            </div>
          </div>

          {/* Live URL Matcher Box */}
          <div
            style={{
              padding: 'var(--space-3)',
              borderRadius: '6px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-default)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Search size={14} style={{ color: 'var(--accent-fg)', flexShrink: 0 }} />
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
              placeholder="Enter full URL to test routing match (e.g. https://api.openai.com/v1/chat/completions)..."
            />
            <div style={{ fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--fg-muted)' }}>Matched Dispatch:</span>
              {!urlEvaluation ? (
                <span className="badge badge-neutral">Enter a URL above to simulate rule evaluation</span>
              ) : urlEvaluation.matched && urlEvaluation.matchedRule ? (
                <span className="badge badge-success" style={{ fontFamily: 'var(--font-mono)' }}>
                  {urlEvaluation.matchedRule.name} -&gt; {urlEvaluation.actionSummary}
                </span>
              ) : (
                <span className="badge">{urlEvaluation.actionSummary}</span>
              )}
            </div>
          </div>

          {/* Add New URL Regex Rule */}
          <div className="responsive-form-grid">
            <input
              type="text"
              className="text-input"
              placeholder="Rule Name (e.g. OpenAI API)"
              value={newRuleName}
              onChange={(e) => setNewRuleName(e.target.value)}
            />
            <input
              type="text"
              className="text-input"
              style={{ fontFamily: 'var(--font-mono)' }}
              placeholder="^https?://([a-z0-9-]+\.)?openai\.com/"
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
              placeholder="Target Prefix/Tag (e.g. YY-)"
              value={newRuleTargetTag}
              onChange={(e) => setNewRuleTargetTag(e.target.value)}
            />
            <datalist id="mitm-outbound-suggestions">
              {availablePrefixSuggestions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <button type="button" className="btn btn-sm btn-primary" onClick={handleCreateRule}>
              <Plus size={14} />
              Add Rule
            </button>
          </div>

          <div className="primer-datatable-scroll">
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
                {mitmRules.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '18px 12px', color: 'var(--fg-muted)' }}>
                      No MITM URL regex rules configured yet. Add a rule above or click <strong>Load Sample Rules</strong>.
                    </td>
                  </tr>
                ) : (
                  mitmRules.map((rule) => (
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
                          type="button"
                          className="btn btn-sm"
                          onClick={() => deleteMitmRule(rule.id)}
                          title="Delete rule"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: 4-Step MITM Root CA Certificate Validator */}
        <div
          className="panel"
          style={{
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound size={16} style={{ color: 'var(--accent-fg)', flexShrink: 0 }} />
              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                4-Step MITM Root CA Certificate Validator
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleGenerateRootCa}
                disabled={isGeneratingCa}
                title="Generate a real self-signed EC P-256 Root CA certificate & private key via OpenSSL"
              >
                <Sparkles size={13} />
                {isGeneratingCa ? 'Generating...' : 'Generate Self-Signed CA'}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleRunCertValidation}
                disabled={isValidating}
              >
                <Shield size={14} />
                {isValidating ? 'Verifying...' : 'Run 4-Step Check'}
              </button>
            </div>
          </div>

          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
            Validates PEM structure, X.509 BasicConstraints CA flag, validity window, and cryptographic public/private key pairing before mounting into the MITM engine.
          </div>

          {certError && (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: 'var(--danger-subtle)',
                border: '1px solid var(--danger-fg)',
                color: 'var(--danger-fg)',
                fontSize: 'var(--text-xs)',
              }}
            >
              {certError}
            </div>
          )}

          {certMetaSummary && (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: 'var(--success-subtle)',
                border: '1px solid var(--success-fg)',
                color: 'var(--fg-default)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {certMetaSummary}
            </div>
          )}

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Root CA Certificate PEM (<code>cert.pem</code>)
            </label>
            <textarea
              className="text-input"
              style={{
                width: '100%',
                height: '95px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
              }}
              placeholder="-----BEGIN CERTIFICATE----- ... (or click 'Generate Self-Signed CA' above)"
              value={certPem}
              onChange={(e) => setCertPem(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Root CA Private Key PEM (<code>key.pem</code>)
            </label>
            <textarea
              className="text-input"
              style={{
                width: '100%',
                height: '95px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
              }}
              placeholder="-----BEGIN PRIVATE KEY----- ... (or click 'Generate Self-Signed CA' above)"
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
                    flexWrap: 'wrap',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-muted)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {step.passed ? (
                      <CheckCircle2 size={14} style={{ color: 'var(--success-fg)', flexShrink: 0 }} />
                    ) : (
                      <XCircle size={14} style={{ color: 'var(--danger-fg)', flexShrink: 0 }} />
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

