const KNOWN_PRIVATE_DOH_SUFFIXES = [".cnrcz.cn", ".csnau.cn"];

export function isIpLiteral(host: string): boolean {
  if (!host) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(":")) return true;
  return false;
}

export function isKnownPrivateDohDomain(serverAddr: string): boolean {
  return KNOWN_PRIVATE_DOH_SUFFIXES.some((suffix) =>
    serverAddr.endsWith(suffix)
  );
}

export function normalizeUuidForSingbox(rawUuid: string): {
  uuid: string;
  wasNormalized: boolean;
} {
  const trimmed = String(rawUuid || "").trim();
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) {
    return { uuid: trimmed, wasNormalized: false };
  }
  const hexChars = trimmed.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  const padded = (hexChars + "00000000000040008000000000000000").slice(0, 32);
  const formatted = `${padded.slice(0, 8)}-${padded.slice(8, 12)}-4${padded.slice(
    13,
    16
  )}-8${padded.slice(17, 20)}-${padded.slice(20, 32)}`;
  return { uuid: formatted, wasNormalized: true };
}

export function normalizeRealityPublicKey(rawKey: string): {
  publicKey: string;
  wasNormalized: boolean;
} {
  const cleaned = String(rawKey || "")
    .trim()
    .replace(/^['"]+|['"]+$/g, "");
  const base64UrlRegex = /^[A-Za-z0-9_-]{43}=?$/;
  if (base64UrlRegex.test(cleaned) && !cleaned.startsWith("hided_")) {
    return { publicKey: cleaned.replace(/=+$/, ""), wasNormalized: false };
  }
  const safeSeed = cleaned.replace(/[^A-Za-z0-9_-]/g, "A");
  const filler = "sIu4WeffywLBY_0Ay6MaoP3l6Hw_sIu4WeffywLBYAA";
  const combined = (safeSeed + filler).slice(0, 42) + "A";
  return { publicKey: combined, wasNormalized: true };
}

export function normalizeRealityShortId(rawShortId: unknown): string {
  const cleaned = String(rawShortId ?? "")
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/[^0-9a-fA-F]/g, "")
    .toLowerCase();
  return cleaned.slice(0, 16);
}

export function convertMihomoPortHopRangeToSingbox(
  rawPorts: unknown
): string[] {
  if (!rawPorts) return [];
  const text = String(rawPorts).trim();
  if (!text) return [];

  const parts = text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const result: string[] = [];

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-").map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
        result.push(`${start}:${end}`);
      }
    } else if (part.includes(":")) {
      result.push(part);
    } else {
      const single = parseInt(part, 10);
      if (!isNaN(single) && single > 0) {
        result.push(`${single}:${single}`);
      }
    }
  }
  return result;
}

export function parseMbpsValue(val: unknown): number | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "number" && !isNaN(val) && val > 0) return val;
  const match = String(val).match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    return num > 0 ? num : undefined;
  }
  return undefined;
}
