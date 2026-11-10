function tryDecodeBase64Utf8(input: string): string | null {
  const cleaned = input.replace(/\s+/g, "");
  if (cleaned.length < 16 || !/^[A-Za-z0-9+/=_-]+$/.test(cleaned)) {
    return null;
  }
  try {
    const normalized = cleaned.replace(/-/g, "+").replace(/_/g, "/");
    const padded =
      normalized.length % 4 === 0
        ? normalized
        : normalized + "=".repeat(4 - (normalized.length % 4));
    const binStr = atob(padded);
    const bytes = Uint8Array.from(binStr, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

export { tryDecodeBase64Utf8 };

export function parseShareUriLine(
  line: string,
  index: number
): Record<string, any> | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//"))
    return null;

  if (trimmed.startsWith("vmess://")) {
    const b64 = trimmed.slice("vmess://".length).split("#")[0];
    const decoded = tryDecodeBase64Utf8(b64);
    if (decoded) {
      try {
        const obj = JSON.parse(decoded);
        return {
          name: String(obj.ps || obj.remarks || `VMess-${index + 1}`),
          type: "vmess",
          server: String(obj.add || obj.host || ""),
          port: Number(obj.port || 443),
          uuid: String(obj.id || ""),
          alterId: Number(obj.aid || 0),
          cipher: String(obj.scy || "auto"),
          tls: obj.tls === "tls" || obj.tls === true,
          servername: String(obj.sni || obj.host || ""),
          network: String(obj.net || "tcp"),
          "ws-opts":
            obj.net === "ws"
              ? {
                  path: String(obj.path || "/"),
                  headers: obj.host ? { Host: String(obj.host) } : undefined,
                }
              : undefined,
        };
      } catch {
        return null;
      }
    }
  }

  const schemeMatch = trimmed.match(
    /^(vless|trojan|ss|hysteria2|hy2|tuic|anytls|socks5):\/\/(.+)$/i
  );
  if (!schemeMatch) return null;

  try {
    const urlObj = new URL(trimmed);
    const proto = schemeMatch[1].toLowerCase();
    const name =
      decodeURIComponent(urlObj.hash.replace(/^#/, "")) ||
      `${proto.toUpperCase()}-${index + 1}`;
    const server = urlObj.hostname.replace(/^\[|\]$/g, "");
    const port = Number(urlObj.port || 443);
    const params = urlObj.searchParams;
    const sni = params.get("sni") || params.get("peer") || server;
    const insecure =
      params.get("allowInsecure") === "1" ||
      params.get("allowInsecure") === "true" ||
      params.get("insecure") === "1" ||
      params.get("insecure") === "true";
    const pinSha256 =
      params.get("pinSHA256") ||
      params.get("fingerprint") ||
      params.get("cert-sha256") ||
      undefined;

    if (proto === "vless") {
      return {
        name,
        type: "vless",
        server,
        port,
        uuid: decodeURIComponent(urlObj.username),
        tls:
          params.get("security") === "tls" ||
          params.get("security") === "reality",
        servername: sni,
        flow: params.get("flow") || undefined,
        network: params.get("type") || "tcp",
        "skip-cert-verify": insecure,
        fingerprint: pinSha256,
        "client-fingerprint": params.get("fp") || "chrome",
        "reality-opts":
          params.get("security") === "reality"
            ? {
                "public-key": params.get("pbk") || "",
                "short-id": params.get("sid") || "",
              }
            : undefined,
      };
    }

    if (proto === "trojan") {
      return {
        name,
        type: "trojan",
        server,
        port,
        password: decodeURIComponent(urlObj.username),
        sni,
        "skip-cert-verify": insecure,
        fingerprint: pinSha256,
        network: params.get("type") || "tcp",
      };
    }

    if (proto === "hysteria2" || proto === "hy2") {
      return {
        name,
        type: "hysteria2",
        server,
        port,
        password: decodeURIComponent(
          urlObj.username + (urlObj.password ? `:${urlObj.password}` : "")
        ),
        sni,
        "skip-cert-verify": insecure,
        fingerprint: pinSha256,
        ports: params.get("mport") || undefined,
        obfs: params.get("obfs") || undefined,
        "obfs-password": params.get("obfs-password") || undefined,
      };
    }

    if (proto === "tuic") {
      return {
        name,
        type: "tuic",
        server,
        port,
        uuid: decodeURIComponent(urlObj.username),
        password: decodeURIComponent(urlObj.password || ""),
        sni,
        "skip-cert-verify": insecure,
        fingerprint: pinSha256,
        "congestion-controller": params.get("congestion_control") || "bbr",
      };
    }

    if (proto === "anytls") {
      return {
        name,
        type: "anytls",
        server,
        port,
        password: decodeURIComponent(urlObj.username),
        sni,
        "skip-cert-verify": insecure,
        fingerprint: pinSha256,
      };
    }

    if (proto === "ss") {
      let method = "aes-256-gcm";
      let password = "";
      const userPart = decodeURIComponent(urlObj.username);
      const decodedUser = tryDecodeBase64Utf8(userPart);
      const credStr =
        decodedUser && decodedUser.includes(":")
          ? decodedUser
          : urlObj.password
          ? `${userPart}:${decodeURIComponent(urlObj.password)}`
          : userPart;
      const colonIdx = credStr.indexOf(":");
      if (colonIdx > 0) {
        method = credStr.slice(0, colonIdx);
        password = credStr.slice(colonIdx + 1);
      }
      return {
        name,
        type: "ss",
        server,
        port,
        cipher: method,
        password,
      };
    }

    if (proto === "socks5") {
      return {
        name,
        type: "socks5",
        server,
        port,
        username: decodeURIComponent(urlObj.username || ""),
        password: decodeURIComponent(urlObj.password || ""),
      };
    }
  } catch {
    return null;
  }
  return null;
}
