import { MitmUrlRegexRule, MitmUrlTestEvaluation } from "../types/mitm";
import { ParsedLogEntry } from "../types/singbox";

const ANSI_ESCAPE_REGEX = /\x1b\[[0-9;]*m/g;

export function stripAnsiCodes(raw: string): string {
  return (raw || "").replace(ANSI_ESCAPE_REGEX, "");
}

export function parseRawLogLine(raw: string, indexSeed: number): ParsedLogEntry {
  const clean = stripAnsiCodes(raw).trim();
  let level: ParsedLogEntry["level"] = "INFO";
  if (/\b(FATAL|PANIC)\b/i.test(clean)) {
    level = "FATAL";
  } else if (/\b(ERROR|ERR|FAIL)\b/i.test(clean)) {
    level = "ERROR";
  } else if (/\b(WARN|WARNING)\b/i.test(clean)) {
    level = "WARN";
  } else if (/\b(DEBUG|TRACE)\b/i.test(clean)) {
    level = "DEBUG";
  }

  let source = "sing-box";
  if (clean.includes("[MITM]")) {
    source = "mitm-engine";
  } else if (clean.includes("[Converter]")) {
    source = "converter";
  }

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const timestamp = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
    now.getSeconds()
  )}`;

  return {
    id: `log_${Date.now()}_${indexSeed}`,
    timestamp,
    level,
    source,
    message: clean,
    raw,
  };
}

export function evaluateUrlAgainstMitmRules(
  testUrl: string,
  method: string,
  rules: MitmUrlRegexRule[]
): MitmUrlTestEvaluation {
  const trimmedUrl = testUrl.trim();
  const upperMethod = method.trim().toUpperCase() || "GET";

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (
      rule.methods.length > 0 &&
      !rule.methods.includes("*") &&
      !rule.methods.map((m) => m.toUpperCase()).includes(upperMethod)
    ) {
      continue;
    }

    try {
      const regex = new RegExp(rule.urlRegex, "i");
      const match = trimmedUrl.match(regex);
      if (match) {
        const capturedGroups = match.slice(1).map((g) => g ?? "");
        let actionSummary = `Route via outbound matching ${rule.targetOutboundOrGroup}`;
        if (rule.actionType === "inject_header") {
          actionSummary = `Inject Header ${rule.headerKey || "x-mitm"}: ${
            rule.headerValue || "1"
          } & route via ${rule.targetOutboundOrGroup}`;
        } else if (rule.actionType === "rewrite_url") {
          actionSummary = `Rewrite URL -> ${
            rule.rewriteReplacement || "$0"
          } & route via ${rule.targetOutboundOrGroup}`;
        } else if (rule.actionType === "mock_response") {
          actionSummary = `Return local HTTP ${rule.statusCode || 200} mock response`;
        } else if (rule.actionType === "reject_request") {
          actionSummary = `Reject request (HTTP 403/RST)`;
        }

        return {
          matched: true,
          matchedRule: rule,
          capturedGroups,
          effectiveOutbound: rule.targetOutboundOrGroup,
          actionSummary,
        };
      }
    } catch {
      continue;
    }
  }

  return {
    matched: false,
    capturedGroups: [],
    effectiveOutbound: "direct (FINAL)",
    actionSummary: "No MITM URL regex rule matched; falls through to default route.",
  };
}
