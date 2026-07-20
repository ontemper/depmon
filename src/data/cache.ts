import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { StackInfo, StackHistory, GHRun, PullRequestInfo } from "../lib/types.ts";

const CACHE_DIR = join(homedir(), ".cache", "depmon");
const CACHE_FILE = join(CACHE_DIR, "state.json");
const CACHE_TTL_MS = 120_000; // 2 minutes

interface CachedState {
  timestamp: number;
  stacks: StackInfo[];
  history: Record<string, StackHistory>;
  ghRuns: GHRun[];
  pullRequests?: PullRequestInfo[];
}

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

export function readCache(): {
  stacks: StackInfo[];
  history: Map<string, StackHistory>;
  ghRuns: GHRun[];
  pullRequests: PullRequestInfo[];
  age: number;
} | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const raw = readFileSync(CACHE_FILE, "utf-8");
    const cached: CachedState = JSON.parse(raw);
    const age = Date.now() - cached.timestamp;
    return {
      stacks: cached.stacks,
      history: new Map(Object.entries(cached.history)),
      ghRuns: cached.ghRuns,
      pullRequests: cached.pullRequests ?? [],
      age,
    };
  } catch {
    return null;
  }
}

export function writeCache(
  stacks: StackInfo[],
  history: Map<string, StackHistory>,
  ghRuns: GHRun[],
  pullRequests: PullRequestInfo[],
) {
  try {
    ensureCacheDir();
    const state: CachedState = {
      timestamp: Date.now(),
      stacks,
      history: Object.fromEntries(history),
      ghRuns,
      pullRequests,
    };
    writeFileSync(CACHE_FILE, JSON.stringify(state));
  } catch {
    // Silently fail - cache is best-effort
  }
}

export function isCacheStale(age: number): boolean {
  return age > CACHE_TTL_MS;
}
