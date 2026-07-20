import { describe, expect, test } from "bun:test";
import {
  buildStackStates,
  mapRunsToStacks,
  runHealth,
  sortRuns,
  sortStackStates,
  summarizeFleet,
} from "./deploy-state.ts";
import { extractStackName } from "./helpers.ts";
import type { GHRun, StackHistory, StackInfo } from "./types.ts";

const stacks: StackInfo[] = [
  { name: "prod", lastUpdate: "2026-07-19T12:00:00Z", resourceCount: "42", url: "https://app.pulumi.com/prod", updateInProgress: false },
  { name: "preview", lastUpdate: "2026-07-19T13:00:00Z", resourceCount: "12", url: "https://app.pulumi.com/preview", updateInProgress: false },
  { name: "dev", lastUpdate: "n/a", resourceCount: "0", url: "", updateInProgress: true },
];

const successfulHistory: StackHistory = {
  version: 8,
  status: "succeeded",
  kind: "update",
  message: "Ship the control plane",
  branch: "main",
  author: "Engineer",
  duration: "1m20s",
  resourceChanges: "update:2",
  startTime: "2026-07-19T12:00:00Z",
  endTime: "2026-07-19T12:01:20Z",
  ghRunUrl: "",
  repo: "example/repo",
};

const failedHistory: StackHistory = {
  ...successfulHistory,
  version: 9,
  status: "failed",
  message: "Preview deploy failed",
  branch: "preview/canary",
  startTime: "2026-07-19T13:00:00Z",
};

const successfulRun: GHRun = {
  name: "Pulumi Deploy",
  status: "completed",
  conclusion: "success",
  startedAt: "2026-07-19T12:00:00Z",
  updatedAt: "2026-07-19T12:02:00Z",
  headBranch: "main",
  displayTitle: "Pulumi Deploy · prod · @engineer",
  url: "https://github.com/example/repo/actions/runs/1",
  workflowName: "Pulumi Deploy",
  event: "push",
};

const failedRun: GHRun = {
  ...successfulRun,
  conclusion: "failure",
  startedAt: "2026-07-19T13:00:00Z",
  headBranch: "preview/canary",
  displayTitle: "Pulumi Deploy - preview",
  url: "https://github.com/example/repo/actions/runs/2",
};

describe("deployment status model", () => {
  test("recognizes supported workflow title separators", () => {
    expect(extractStackName("Pulumi Deploy · stg · @engineer")).toBe("stg");
    expect(extractStackName("Pulumi Deploy - preview")).toBe("preview");
  });

  test("links recent runs to exact stack names", () => {
    const linked = mapRunsToStacks([successfulRun, failedRun], stacks);
    expect(linked.get("prod")?.url).toBe(successfulRun.url);
    expect(linked.get("preview")?.url).toBe(failedRun.url);
  });

  test("prioritizes failures, active deploys, then healthy stacks", () => {
    const history = new Map<string, StackHistory>([
      ["prod", successfulHistory],
      ["preview", failedHistory],
    ]);
    const states = buildStackStates(stacks, history, [successfulRun, failedRun]);
    const ordered = sortStackStates(states, "attention");

    expect(ordered.map((state) => [state.stack.name, state.health])).toEqual([
      ["preview", "failed"],
      ["dev", "deploying"],
      ["prod", "healthy"],
    ]);
    expect(summarizeFleet(states)).toEqual({ total: 3, failed: 1, deploying: 1, healthy: 1, unknown: 0 });
  });

  test("orders workflow runs by attention before recency", () => {
    const runningRun: GHRun = { ...successfulRun, status: "in_progress", conclusion: "", startedAt: "2026-07-19T14:00:00Z" };
    expect(runHealth(runningRun)).toBe("deploying");
    expect(sortRuns([successfulRun, runningRun, failedRun]).map(runHealth)).toEqual([
      "failed",
      "deploying",
      "healthy",
    ]);
  });
});
