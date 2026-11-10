import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";

const execFileAsync = promisify(execFile);

export function getCandidateBinaryPaths(projectRoot: string): string[] {
  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";

  const names = isWin
    ? [
        "sing-box.exe",
        "sing-box-x86_64-pc-windows-msvc.exe",
        "sing-box-aarch64-pc-windows-msvc.exe",
      ]
    : isMac
    ? [
        "sing-box",
        "sing-box-aarch64-apple-darwin",
        "sing-box-x86_64-apple-darwin",
      ]
    : [
        "sing-box",
        "sing-box-x86_64-unknown-linux-gnu",
        "sing-box-aarch64-unknown-linux-gnu",
      ];

  const candidates: string[] = [];
  for (const name of names) {
    candidates.push(path.join(projectRoot, "bin", name));
    candidates.push(path.join(projectRoot, "src-tauri", "binaries", name));
    candidates.push(path.join(projectRoot, name));
    candidates.push(path.join(projectRoot, "src-tauri", name));
  }

  candidates.push("/opt/homebrew/bin/sing-box");
  candidates.push("/usr/local/bin/sing-box");
  candidates.push("/usr/bin/sing-box");
  return candidates;
}

export async function resolveSingboxBinaryPath(projectRoot: string): Promise<{
  found: boolean;
  binaryPath: string;
  searchedPaths: string[];
}> {
  const searchedPaths = getCandidateBinaryPaths(projectRoot);
  for (const candidate of searchedPaths) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return { found: true, binaryPath: candidate, searchedPaths };
      }
    } catch {}
  }

  try {
    const { stdout } = await execFileAsync("which", ["sing-box"]);
    const resolved = stdout.trim().split(/\r?\n/)[0];
    if (resolved && fs.existsSync(resolved)) {
      return { found: true, binaryPath: resolved, searchedPaths };
    }
  } catch {}

  return {
    found: false,
    binaryPath: path.join(projectRoot, "bin", "sing-box"),
    searchedPaths,
  };
}
