import { JsonPathMatch, SubscriptionUserInfo } from "../types/subscription";

export function parseSubscriptionUserInfo(
  headerValue: string | null | undefined
): SubscriptionUserInfo | null {
  if (!headerValue || typeof headerValue !== "string") {
    return null;
  }

  const parts = headerValue.split(";").map((p) => p.trim());
  let upload: number | undefined;
  let download: number | undefined;
  let total: number | undefined;
  let expire: number | null = null;
  let hasAnyField = false;

  for (const part of parts) {
    if (!part) continue;
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;

    const key = part.slice(0, eqIdx).trim().toLowerCase();
    const val = part.slice(eqIdx + 1).trim();

    if (key === "upload") {
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
        upload = num;
        hasAnyField = true;
      }
    } else if (key === "download") {
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
        download = num;
        hasAnyField = true;
      }
    } else if (key === "total") {
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
        total = num;
        hasAnyField = true;
      }
    } else if (key === "expire") {
      if (!val) {
        expire = null;
        hasAnyField = true;
      } else {
        const num = parseInt(val, 10);
        expire = !isNaN(num) && num > 0 ? num : null;
        hasAnyField = true;
      }
    }
  }

  if (!hasAnyField) {
    return null;
  }

  return { upload, download, total, expire };
}

export function formatBytes(bytes: number | undefined | null): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) {
    return "0 B";
  }
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${val} ${sizes[i] || "B"}`;
}

export function formatExpireDate(
  expire: number | string | null | undefined
): string {
  if (!expire) return "Unlimited (No Expiry)";
  const timestamp =
    typeof expire === "string" ? parseInt(expire, 10) : expire;
  if (isNaN(timestamp) || timestamp <= 0) return "Unlimited (No Expiry)";

  const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return "Unlimited (No Expiry)";

  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getCurrentFormattedTime(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function searchJsonPaths(
  data: unknown,
  keyword: string,
  maxResults = 60
): JsonPathMatch[] {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  const results: JsonPathMatch[] = [];
  const lowerKeyword = trimmed.toLowerCase();
  const visitedPaths = new Set<string>();

  function recordMatch(
    path: string,
    key: string,
    val: unknown,
    type: JsonPathMatch["type"]
  ) {
    if (visitedPaths.has(path)) return;
    visitedPaths.add(path);

    let preview = "";
    if (val === null) {
      preview = "null";
    } else if (Array.isArray(val)) {
      preview = `Array(${val.length})`;
    } else if (typeof val === "object") {
      const keys = Object.keys(val as Record<string, unknown>);
      preview = `Object({${keys.slice(0, 3).join(", ")}${
        keys.length > 3 ? "..." : ""
      }})`;
    } else {
      preview = String(val);
      if (preview.length > 60) {
        preview = preview.slice(0, 60) + "...";
      }
    }

    results.push({
      path,
      key,
      value: val,
      valuePreview: preview,
      type,
    });
  }

  function traverse(node: unknown, currentPath: string, currentKey: string) {
    if (results.length >= maxResults) return;

    const nodeType: JsonPathMatch["type"] =
      node === null
        ? "null"
        : Array.isArray(node)
        ? "array"
        : typeof node === "object"
        ? "object"
        : typeof node === "string"
        ? "string"
        : typeof node === "number"
        ? "number"
        : typeof node === "boolean"
        ? "boolean"
        : "null";

    if (currentKey && currentKey.toLowerCase().includes(lowerKeyword)) {
      recordMatch(currentPath, currentKey, node, nodeType);
    }

    if (
      (nodeType === "string" || nodeType === "number") &&
      String(node).toLowerCase().includes(lowerKeyword)
    ) {
      recordMatch(currentPath, currentKey || "$", node, nodeType);
    }

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        if (results.length >= maxResults) break;
        traverse(node[i], `${currentPath}[${i}]`, `[${i}]`);
      }
    } else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (results.length >= maxResults) break;
        traverse(v, `${currentPath}.${k}`, k);
      }
    }
  }

  traverse(data, "$", "");
  return results;
}

export function triggerTextFileDownload(
  content: string,
  filename: string,
  mimeType = "text/plain;charset=utf-8"
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
