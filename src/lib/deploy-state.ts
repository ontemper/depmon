import { extractStackName } from "./helpers.ts";
import type { DeployHealth, GHRun, StackHistory, StackInfo } from "./types.ts";

export interface StackState {
  stack: StackInfo;
  history?: StackHistory;
  ghRun?: GHRun;
  health: DeployHealth;
  statusLabel: string;
  sortTime: number;
}

export interface FleetSummary {
  total: number;
  failed: number;
  deploying: number;
  healthy: number;
  unknown: number;
}

const ACTIVE_RUN_STATES: Record<string, true> = {
  in_progress: true,
  queued: true,
  waiting: true,
  pending: true,
  requested: true,
};
const FAILED_CONCLUSIONS: Record<string, true> = {
  failure: true,
  failed: true,
  timed_out: true,
  action_required: true,
  startup_failure: true,
};

function timestamp(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function runHealth(run: GHRun | undefined): DeployHealth {
  if (!run) return "unknown";
  if (ACTIVE_RUN_STATES[run.status]) return "deploying";
  if (FAILED_CONCLUSIONS[run.conclusion]) return "failed";
  if (run.status === "completed" && run.conclusion === "success") return "healthy";
  return "unknown";
}

function stackHealth(stack: StackInfo, history: StackHistory | undefined, run: GHRun | undefined): DeployHealth {
  if (stack.updateInProgress || runHealth(run) === "deploying") return "deploying";
  if (runHealth(run) === "failed" || history?.status === "failed") return "failed";
  if (history?.status === "succeeded" || runHealth(run) === "healthy") return "healthy";
  return "unknown";
}

function labelFor(health: DeployHealth, run: GHRun | undefined, history: StackHistory | undefined): string {
  if (health === "deploying") return run?.status === "queued" ? "queued" : "deploying";
  if (health === "failed") return run?.conclusion === "timed_out" ? "timed out" : "failed";
  if (health === "healthy") return "healthy";
  return history ? history.status : "no signal";
}

function runStackCandidates(run: GHRun): string[] {
  return [extractStackName(run.name), extractStackName(run.displayTitle), run.headBranch]
    .filter(Boolean)
    .map((value) => value.toLowerCase());
}

export function mapRunsToStacks(runs: GHRun[], stacks: StackInfo[]): Map<string, GHRun> {
  const byName = new Map(stacks.map((stack) => [stack.name.toLowerCase(), stack.name]));
  const result = new Map<string, GHRun>();

  for (const run of runs) {
    for (const candidate of runStackCandidates(run)) {
      const exact = byName.get(candidate);
      if (exact && !result.has(exact)) {
        result.set(exact, run);
        break;
      }
    }
  }

  return result;
}

export function buildStackStates(
  stacks: StackInfo[],
  history: Map<string, StackHistory>,
  runs: GHRun[],
): StackState[] {
  const runsByStack = mapRunsToStacks(runs, stacks);
  return stacks.map((stack) => {
    const latest = history.get(stack.name);
    const run = runsByStack.get(stack.name);
    const health = stackHealth(stack, latest, run);
    return {
      stack,
      history: latest,
      ghRun: run,
      health,
      statusLabel: labelFor(health, run, latest),
      sortTime: Math.max(timestamp(latest?.startTime), timestamp(run?.startedAt), timestamp(stack.lastUpdate)),
    };
  });
}

const HEALTH_PRIORITY: Record<DeployHealth, number> = {
  failed: 0,
  deploying: 1,
  unknown: 2,
  healthy: 3,
};

export function sortStackStates(states: StackState[], mode: "attention" | "recent" | "name"): StackState[] {
  return [...states].sort((a, b) => {
    if (mode === "attention") {
      const healthDelta = HEALTH_PRIORITY[a.health] - HEALTH_PRIORITY[b.health];
      if (healthDelta !== 0) return healthDelta;
    }
    if (mode !== "name" && a.sortTime !== b.sortTime) return b.sortTime - a.sortTime;
    return a.stack.name.localeCompare(b.stack.name);
  });
}

export function sortRuns(runs: GHRun[]): GHRun[] {
  return [...runs].sort((a, b) => {
    const healthDelta = HEALTH_PRIORITY[runHealth(a)] - HEALTH_PRIORITY[runHealth(b)];
    if (healthDelta !== 0) return healthDelta;
    return timestamp(b.startedAt) - timestamp(a.startedAt);
  });
}

export function summarizeFleet(states: StackState[]): FleetSummary {
  const summary: FleetSummary = { total: states.length, failed: 0, deploying: 0, healthy: 0, unknown: 0 };
  for (const state of states) summary[state.health] += 1;
  return summary;
}
