import yaml from "js-yaml";

function deterministicHashHex(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${hex1}${hex2}`;
}

export function maskHostPreservingStructure(rawHost: string): string {
  const trimmed = String(rawHost || "").trim();
  if (!trimmed || trimmed === "127.0.0.1" || trimmed === "223.5.5.5" || trimmed === "1.1.1.1" || trimmed === "8.8.8.8") {
    return trimmed;
  }
  const digest = deterministicHashHex(trimmed).slice(0, 6);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) {
    const octets = trimmed.split(".");
    return `hided-${digest}.${octets[2]}.${octets[3]}`;
  }
  const labels = trimmed.split(".");
  if (labels.length >= 2) {
    const tld = labels.slice(-2).join(".");
    return `hided-${digest}.${tld}`;
  }
  return `hided-${digest}.example.com`;
}

export function maskUuidPreservingFormat(rawUuid: string): string {
  const digest = deterministicHashHex(String(rawUuid || "uuid"));
  return `${digest.slice(0, 8)}-0000-4000-8000-hided${digest.slice(8, 15)}`;
}

export function maskValidSingboxUuid(rawUuid: string): string {
  const digest = deterministicHashHex(String(rawUuid || "uuid"));
  return `${digest.slice(0, 8)}-0000-4000-8000-${digest.slice(0, 12)}`;
}

export function maskRealityPublicKeyPreservingLength(rawKey: string): string {
  const digest = deterministicHashHex(String(rawKey || "pubkey"));
  return `hided_${digest}_0Ay6MaoP3l6Hw_sIu4WeffA`.slice(0, 43);
}

export function maskPasswordToken(rawPassword: string): string {
  const str = String(rawPassword || "");
  if (!str || str === "0") return str;
  const digest = deterministicHashHex(str).slice(0, 6);
  return `3e3-hided-${digest}`;
}

export function maskDoHUrlPreservingStructure(rawUrl: string): string {
  const str = String(rawUrl || "").trim();
  if (!str.startsWith("https://")) return str;
  try {
    const parsed = new URL(str);
    const digest = deterministicHashHex(str).slice(0, 8);
    const portPart = parsed.port ? `:${parsed.port}` : "";
    return `https://${maskHostPreservingStructure(parsed.hostname)}${portPart}/dns-query/hided-${digest}-0000-4000-8000-redacted`;
  } catch {
    return "https://hided-doh.example.com/dns-query/redacted";
  }
}

export function desensitizeMihomoYamlContent(rawYaml: string): string {
  try {
    const doc = yaml.load(rawYaml) as Record<string, any>;
    if (!doc || typeof doc !== "object") {
      return rawYaml;
    }
    const cloned = JSON.parse(JSON.stringify(doc));

    if (cloned.dns && Array.isArray(cloned.dns["proxy-server-nameserver"])) {
      cloned.dns["proxy-server-nameserver"] = cloned.dns[
        "proxy-server-nameserver"
      ].map((ns: unknown) => {
        const s = String(ns);
        return s.startsWith("https://") ? maskDoHUrlPreservingStructure(s) : s;
      });
    }

    if (Array.isArray(cloned.proxies)) {
      cloned.proxies = cloned.proxies.map((p: Record<string, any>) => {
        if (!p || typeof p !== "object") return p;
        const next = { ...p };
        if (next.server) {
          next.server = maskHostPreservingStructure(String(next.server));
        }
        if (next.password) {
          next.password = maskPasswordToken(String(next.password));
        }
        if (next.uuid) {
          next.uuid = maskUuidPreservingFormat(String(next.uuid));
        }
        if (next.fingerprint) {
          next.fingerprint = "1234567890abcd1234567890";
        }
        if (next["reality-opts"] && typeof next["reality-opts"] === "object") {
          next["reality-opts"] = {
            ...next["reality-opts"],
            "public-key": maskRealityPublicKeyPreservingLength(
              String(next["reality-opts"]["public-key"] || "")
            ),
          };
        }
        if (next["ws-opts"]?.headers?.Host) {
          next["ws-opts"] = {
            ...next["ws-opts"],
            headers: {
              ...next["ws-opts"].headers,
              Host: maskHostPreservingStructure(
                String(next["ws-opts"].headers.Host)
              ),
            },
          };
        }
        return next;
      });
    }

    return yaml.dump(cloned, { lineWidth: 140, noRefs: true });
  } catch {
    return rawYaml;
  }
}

export function desensitizeSingboxConfigJson(
  configObj: unknown
): Record<string, any> {
  if (!configObj || typeof configObj !== "object") {
    return {};
  }
  const cloned = JSON.parse(JSON.stringify(configObj));

  if (Array.isArray(cloned.dns?.servers)) {
    cloned.dns.servers = cloned.dns.servers.map((srv: Record<string, any>) => {
      if (srv.type === "https" && srv.server) {
        const digest = deterministicHashHex(String(srv.path || "")).slice(0, 8);
        return {
          ...srv,
          server: maskHostPreservingStructure(String(srv.server)),
          path: `/dns-query/${digest}-0000-4000-8000-000000000000`,
        };
      }
      return srv;
    });
  }

  if (Array.isArray(cloned.outbounds)) {
    cloned.outbounds = cloned.outbounds.map((ob: Record<string, any>) => {
      if (!ob || typeof ob !== "object" || ob.type === "direct") return ob;
      const next = { ...ob };
      if (next.server) {
        next.server = maskHostPreservingStructure(String(next.server));
      }
      if (next.password) {
        if (
          next.type === "shadowsocks" &&
          String(next.method || "").startsWith("2022-blake3-")
        ) {
          next.password = String(next.method).includes("128")
            ? "aGlkZWRfc3MyMDIyX2tleQ=="
            : "aGlkZWRfc3MyMDIyX2tleV8zMmJ5dGVzX3JlZGFjdGVk=";
        } else {
          next.password = maskPasswordToken(String(next.password));
        }
      }
      if (next.uuid) {
        next.uuid = maskValidSingboxUuid(String(next.uuid));
      }
      if (next.tls?.reality?.public_key) {
        next.tls = {
          ...next.tls,
          reality: {
            ...next.tls.reality,
            public_key: maskRealityPublicKeyPreservingLength(
              String(next.tls.reality.public_key)
            ),
          },
        };
      }
      if (next.obfs?.password) {
        next.obfs = {
          ...next.obfs,
          password: maskPasswordToken(String(next.obfs.password)),
        };
      }
      return next;
    });
  }

  return cloned;
}
