import { describe, expect, test } from "bun:test";
import { buildStackAvailability } from "./availability.ts";
import type { StackState } from "./deploy-state.ts";
import type { PullRequestInfo } from "./types.ts";

const now = Date.parse("2026-07-20T12:00:00Z");

function stackState(name: string, branch?: string, deploying = false): StackState {
  return {
    stack: {
      name,
      lastUpdate: branch ? "2026-07-19T12:00:00Z" : "n/a",
      resourceCount: "10",
      url: `https://app.pulumi.com/${name}`,
      updateInProgress: deploying,
    },
    history: branch ? {
      version: 1,
      status: "succeeded",
      kind: "update",
      message: "Deploy branch",
      branch,
      author: "Engineer",
      duration: "1m",
      resourceChanges: "update:1",
      startTime: "2026-07-19T12:00:00Z",
      endTime: "2026-07-19T12:01:00Z",
      ghRunUrl: "",
      repo: "example/repo",
    } : undefined,
    health: deploying ? "deploying" : "healthy",
    statusLabel: deploying ? "deploying" : "healthy",
    sortTime: now,
  };
}

function pullRequest(
  number: number,
  branch: string,
  state: "OPEN" | "CLOSED" | "MERGED",
  updatedAt: string,
): PullRequestInfo {
  return {
    number,
    title: `Change ${number}`,
    state,
    isDraft: false,
    headRefName: branch,
    url: `https://github.com/example/repo/pull/${number}`,
    updatedAt,
    closedAt: state === "CLOSED" ? updatedAt : null,
    mergedAt: state === "MERGED" ? updatedAt : null,
    author: { login: "engineer" },
  };
}

describe("stack availability", () => {
  test("ranks unused and released stacks as safe deployment choices", () => {
    const result = buildStackAvailability(
      [
        stackState("unused"),
        stackState("released", "feature/done"),
        stackState("occupied", "feature/open"),
        stackState("prod", "main"),
      ],
      [
        pullRequest(1, "feature/done", "MERGED", "2026-07-18T12:00:00Z"),
        pullRequest(2, "feature/open", "OPEN", "2026-07-20T06:00:00Z"),
      ],
      now,
    );

    expect(result.map(({ state, status }) => [state.stack.name, status])).toEqual([
      ["unused", "available"],
      ["released", "available"],
      ["occupied", "in_use"],
    ]);
    expect(result[1]?.reason).toBe("Pull request merged");
  });

  test("separates stale, deploying, and uncorrelated stacks from free capacity", () => {
    const result = buildStackAvailability(
      [
        stackState("stale", "feature/stale"),
        stackState("deploying", "feature/live", true),
        stackState("unmatched", "feature/missing"),
      ],
      [pullRequest(3, "feature/stale", "OPEN", "2026-07-10T12:00:00Z")],
      now,
    );

    expect(result.map(({ state, status }) => [state.stack.name, status])).toEqual([
      ["stale", "stale"],
      ["deploying", "deploying"],
      ["unmatched", "unknown"],
    ]);
    expect(result[0]?.ageDays).toBe(10);
  });

  test("correlates PR via prNumber even when branch name is unknown", () => {
    const stateWithPrNum: StackState = {
      ...stackState("azure-nick-two", "unknown"),
      history: {
        version: 6,
        status: "succeeded",
        kind: "update",
        message: "feat(docs): refine changelog hierarchy (#2639)",
        branch: "unknown",
        author: "Arya",
        duration: "1m",
        resourceChanges: "update:1",
        startTime: "2026-07-18T12:00:00Z",
        endTime: "2026-07-18T12:01:00Z",
        ghRunUrl: "",
        repo: "example/repo",
        prNumber: 2639,
      },
    };
    const result = buildStackAvailability(
      [stateWithPrNum],
      [pullRequest(2639, "arya/docs-refine", "MERGED", "2026-07-18T12:00:00Z")],
      now,
    );
    expect(result[0]?.status).toBe("available");
    expect(result[0]?.pullRequest?.number).toBe(2639);
    expect(result[0]?.reason).toBe("Pull request merged");
  });
});
