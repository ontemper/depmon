import { C } from "./colors.ts";

export function timeAgo(dateStr: string): string {
  if (!dateStr || dateStr === "n/a") return "never";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function statusIcon(status: string, conclusion?: string): string {
  if (status === "in_progress" || status === "queued" || status === "waiting") return "◐";
  if (status === "completed" || status === "succeeded") {
    if (conclusion === "failure" || conclusion === "failed") return "✗";
    if (conclusion === "cancelled") return "◌";
    if (conclusion === "skipped") return "→";
    return "✓";
  }
  if (status === "failed") return "✗";
  return "?";
}

export function statusColor(status: string, conclusion?: string): string {
  if (status === "in_progress" || status === "queued" || status === "waiting") return C.blue;
  if (status === "completed" || status === "succeeded") {
    if (conclusion === "failure" || conclusion === "failed") return C.red;
    if (conclusion === "cancelled") return C.fgMuted;
    return C.green;
  }
  if (status === "failed") return C.red;
  return C.yellow;
}

export function truncate(str: string, len: number): string {
  if (!str) return "";
  if (str.length <= len) return str;
  return str.slice(0, len - 1) + "…";
}

export function pad(str: string, len: number): string {
  return (str ?? "").padEnd(len);
}

export function shortBranch(branch: string): string {
  return branch.replace("refs/heads/", "");
}

export function isCoreName(name: string): boolean {
  return ["prod", "stg", "dev"].includes(name);
}

import type { SortMode, StackInfo, StackHistory } from "./types.ts";

const CORE_ORDER = ["dev", "stg", "prod"];

export function sortStacks(
  stacks: StackInfo[],
  mode: SortMode = "name",
  history?: Map<string, StackHistory>,
): StackInfo[] {
  if (mode === "recent") {
    // All stacks sorted by most recent deploy, no pinning
    return [...stacks].sort((a, b) => {
      const aTime = history?.get(a.name)?.startTime;
      const bTime = history?.get(b.name)?.startTime;
      if (aTime && bTime) return new Date(bTime).getTime() - new Date(aTime).getTime();
      if (aTime) return -1;
      if (bTime) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  // Name mode: non-core alphabetical, then core pinned to bottom
  const core = stacks.filter((s) => CORE_ORDER.includes(s.name));
  const rest = stacks.filter((s) => !CORE_ORDER.includes(s.name));
  rest.sort((a, b) => a.name.localeCompare(b.name));
  core.sort((a, b) => CORE_ORDER.indexOf(a.name) - CORE_ORDER.indexOf(b.name));
  return [...rest, ...core];
}

export function extractStackName(runName: string): string {
  const separated = runName.match(/^Pulumi\s+[^·:–—-]+\s*[·:–—-]\s*([^·:]+?)(?:\s*[·:]\s*|$)/i);
  return separated?.[1]?.trim() || "unknown";
}
