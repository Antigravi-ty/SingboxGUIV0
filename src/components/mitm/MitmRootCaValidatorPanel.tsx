import React, { useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Shield,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  generateSelfSignedCaPem,
  validateAndImportCaCertPem,
} from "../../services/tauriGateway";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { ValidationStep } from "../../types/mitm";

export const MitmRootCaValidatorPanel: React.FC = () => {
  const { appendLog } = useWorkspaceStore();

  const [certPem, setCertPem] = useState("");
  const [keyPem, setKeyPem] = useState("");
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([]);
  const [certError, setCertError] = useState<string | null>(null);
  const [certMetaSummary, setCertMetaSummary] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isGeneratingCa, setIsGeneratingCa] = useState(false);

  const handleGenerateRootCa = async () => {
    setIsGeneratingCa(true);
    setCertError(null);
    try {
      const pair = await generateSelfSignedCaPem();
      setCertPem(pair.cert_pem);
      setKeyPem(pair.key_pem);
      const res = await validateAndImportCaCertPem(
        pair.cert_pem,
        pair.key_pem,
        false
      );
      setValidationSteps(res.steps);
      setCertMetaSummary(
        `Subject: ${res.subject} | Key: ${res.key_algorithm} | Valid until: ${res.not_after}`
      );
      appendLog(
        `[INFO][MITM] Generated & verified self-signed Root CA (${res.subject})`
      );
    } catch (err: any) {
      const msg = err?.message || String(err);
      setCertError(msg);
      appendLog(`[ERROR][MITM] Failed to generate Root CA: ${msg}`);
    } finally {
      setIsGeneratingCa(false);
    }
  };

  const handleRunCertValidation = async () => {
    if (!certPem.trim() || !keyPem.trim()) {
      setCertError(
        'Please paste both a Certificate PEM and a Private Key PEM (or click "Generate Self-Signed CA" first).'
      );
      return;
    }
    setIsValidating(true);
    setCertError(null);
    try {
      const res = await validateAndImportCaCertPem(certPem, keyPem, false);
      setValidationSteps(res.steps);
      setCertMetaSummary(
        `Subject: ${res.subject} | Key: ${res.key_algorithm} | Valid until: ${res.not_after}`
      );
      appendLog(
        `[INFO][MITM] Verified Root CA Certificate (${res.subject}, ${res.key_algorithm})`
      );
    } catch (err: any) {
      const msg = err?.message || String(err);
      setCertError(msg);
      setValidationSteps([]);
      appendLog(`[ERROR][MITM] Root CA validation error: ${msg}`);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div
      className="panel"
      style={{
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <KeyRound
            size={16}
            style={{ color: "var(--accent-fg)", flexShrink: 0 }}
          />
          <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>
            4-Step MITM Root CA Certificate Validator
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleGenerateRootCa}
            disabled={isGeneratingCa}
            title="Generate a real self-signed EC P-256 Root CA certificate & private key via OpenSSL"
          >
            <Sparkles size={13} />
            {isGeneratingCa ? "Generating..." : "Generate Self-Signed CA"}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleRunCertValidation}
            disabled={isValidating}
          >
            <Shield size={14} />
            {isValidating ? "Verifying..." : "Run 4-Step Check"}
          </button>
        </div>
      </div>

      <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-muted)" }}>
        Validates PEM structure, X.509 BasicConstraints CA flag, validity
        window, and cryptographic public/private key pairing before mounting
        into the MITM engine.
      </div>

      {certError && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            background: "var(--danger-subtle)",
            border: "1px solid var(--danger-fg)",
            color: "var(--danger-fg)",
            fontSize: "var(--text-xs)",
          }}
        >
          {certError}
        </div>
      )}

      {certMetaSummary && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            background: "var(--success-subtle)",
            border: "1px solid var(--success-fg)",
            color: "var(--fg-default)",
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
          }}
        >
          {certMetaSummary}
        </div>
      )}

      <div>
        <label
          style={{
            fontSize: "11px",
            fontWeight: 600,
            display: "block",
            marginBottom: "4px",
          }}
        >
          Root CA Certificate PEM (<code>cert.pem</code>)
        </label>
        <textarea
          className="text-input"
          style={{
            width: "100%",
            height: "95px",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
          }}
          placeholder="-----BEGIN CERTIFICATE----- ... (or click 'Generate Self-Signed CA' above)"
          value={certPem}
          onChange={(e) => setCertPem(e.target.value)}
        />
      </div>

      <div>
        <label
          style={{
            fontSize: "11px",
            fontWeight: 600,
            display: "block",
            marginBottom: "4px",
          }}
        >
          Root CA Private Key PEM (<code>key.pem</code>)
        </label>
        <textarea
          className="text-input"
          style={{
            width: "100%",
            height: "95px",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
          }}
          placeholder="-----BEGIN PRIVATE KEY----- ... (or click 'Generate Self-Signed CA' above)"
          value={keyPem}
          onChange={(e) => setKeyPem(e.target.value)}
        />
      </div>

      {validationSteps.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {validationSteps.map((step) => (
            <div
              key={step.step_number}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "6px",
                padding: "8px 10px",
                borderRadius: "6px",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border-muted)",
                fontSize: "var(--text-xs)",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                {step.passed ? (
                  <CheckCircle2
                    size={14}
                    style={{ color: "var(--success-fg)", flexShrink: 0 }}
                  />
                ) : (
                  <XCircle
                    size={14}
                    style={{ color: "var(--danger-fg)", flexShrink: 0 }}
                  />
                )}
                <span style={{ fontWeight: 600 }}>
                  Step {step.step_number}: {step.name}
                </span>
              </div>
              <span
                style={{
                  color: "var(--fg-muted)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                }}
              >
                {step.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
