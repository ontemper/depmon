import { isCoreName } from "./helpers.ts";
import type { StackState } from "./deploy-state.ts";
import type { PullRequestInfo } from "./types.ts";

export type AvailabilityStatus = "available" | "deploying" | "in_use" | "stale" | "unknown";

export interface StackAvailability {
  state: StackState;
  pullRequest?: PullRequestInfo;
  status: AvailabilityStatus;
  ageDays: number | null;
  reason: string;
}

const STALE_AFTER_DAYS = 7;
const STATUS_PRIORITY: Record<AvailabilityStatus, number> = {
  available: 0,
  stale: 1,
  deploying: 2,
  in_use: 3,
  unknown: 4,
};

function daysSince(date: string | null | undefined, now: number): number | null {
  if (!date) return null;
  const timestamp = Date.parse(date);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((now - timestamp) / 86_400_000));
}

function branchKey(branch: string): string {
  return branch.replace(/^refs\/heads\//, "").toLowerCase();
}

export function buildStackAvailability(
  states: StackState[],
  pullRequests: PullRequestInfo[],
  now = Date.now(),
): StackAvailability[] {
  const pullRequestByBranch = new Map<string, PullRequestInfo>();
  for (const pullRequest of pullRequests) {
    const key = branchKey(pullRequest.headRefName);
    const current = pullRequestByBranch.get(key);
    if (!current || Date.parse(pullRequest.updatedAt) > Date.parse(current.updatedAt)) {
      pullRequestByBranch.set(key, pullRequest);
    }
  }

  const availability = states
    .filter(({ stack }) => !isCoreName(stack.name))
    .map((state): StackAvailability => {
      if (state.stack.updateInProgress || state.health === "deploying") {
        return {
          state,
          status: "deploying",
          ageDays: null,
          reason: "Deployment in progress",
        };
      }

      if (!state.history) {
        return {
          state,
          status: "available",
          ageDays: null,
          reason: "Never deployed",
        };
      }

      const branch = branchKey(state.history.branch);
      if (!branch || branch === "unknown") {
        return {
          state,
          status: "unknown",
          ageDays: daysSince(state.history.startTime, now),
          reason: "Deployment branch is unknown",
        };
      }

      const pullRequest = pullRequestByBranch.get(branch);
      if (!pullRequest) {
        return {
          state,
          status: "unknown",
          ageDays: daysSince(state.history.startTime, now),
          reason: `No pull request found for ${state.history.branch}`,
        };
      }

      if (pullRequest.state.toUpperCase() === "OPEN") {
        const ageDays = daysSince(pullRequest.updatedAt, now);
        const stale = ageDays !== null && ageDays >= STALE_AFTER_DAYS;
        return {
          state,
          pullRequest,
          status: stale ? "stale" : "in_use",
          ageDays,
          reason: pullRequest.isDraft ? "Draft pull request is open" : "Pull request is open",
        };
      }

      const releasedAt = pullRequest.mergedAt || pullRequest.closedAt || pullRequest.updatedAt;
      return {
        state,
        pullRequest,
        status: "available",
        ageDays: daysSince(releasedAt, now),
        reason: pullRequest.mergedAt ? "Pull request merged" : "Pull request closed",
      };
    });

  return availability.sort((a, b) => {
    const statusDelta = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (statusDelta !== 0) return statusDelta;
    const ageDelta = (b.ageDays ?? Number.MAX_SAFE_INTEGER) - (a.ageDays ?? Number.MAX_SAFE_INTEGER);
    if (ageDelta !== 0) return ageDelta;
    return a.state.stack.name.localeCompare(b.state.stack.name);
  });
}
