import { afterEach, describe, expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import type { StackState } from "../lib/deploy-state.ts";
import { StacksView } from "./stacks-view.tsx";

const states: StackState[] = [
  {
    stack: {
      name: "preview",
      lastUpdate: "2026-07-19T13:00:00Z",
      resourceCount: "12",
      url: "https://app.pulumi.com/preview",
      updateInProgress: false,
    },
    history: {
      version: 9,
      status: "failed",
      kind: "update",
      message: "Preview deployment failed while provisioning the gateway",
      branch: "preview/canary",
      author: "Engineer",
      duration: "42s",
      resourceChanges: "create:2 update:1",
      startTime: "2026-07-19T13:00:00Z",
      endTime: "2026-07-19T13:00:42Z",
      ghRunUrl: "https://github.com/example/repo/actions/runs/2",
      repo: "example/repo",
    },
    health: "failed",
    statusLabel: "failed",
    sortTime: Date.parse("2026-07-19T13:00:00Z"),
  },
  {
    stack: {
      name: "prod",
      lastUpdate: "2026-07-19T12:00:00Z",
      resourceCount: "42",
      url: "https://app.pulumi.com/prod",
      updateInProgress: false,
    },
    history: {
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
    },
    health: "healthy",
    statusLabel: "healthy",
    sortTime: Date.parse("2026-07-19T12:00:00Z"),
  },
];

let destroyRenderer: (() => void) | undefined;
afterEach(async () => {
  await act(async () => {
    destroyRenderer?.();
  });
  destroyRenderer = undefined;
});

describe("fleet cockpit rendering", () => {
  test("keeps the attention queue and inspector usable at 60 columns", async () => {
    const setup = await testRender(
      <StacksView states={states} selectedIdx={0} sortMode="attention" filterText="" />,
      { width: 60, height: 20 },
    );
    destroyRenderer = () => setup.renderer.destroy();
    await act(async () => {
      await setup.renderOnce();
    });
    const frame = setup.captureCharFrame();

    expect(frame).toContain("ATTENTION QUEUE");
    expect(frame).toContain("FAILED");
    expect(frame).toContain("preview");
    expect(frame).toContain("enter history · p pulumi · g github");
  });

  test("adds a persistent selected-stack inspector on wide terminals", async () => {
    const setup = await testRender(
      <StacksView states={states} selectedIdx={0} sortMode="attention" filterText="" />,
      { width: 140, height: 30 },
    );
    destroyRenderer = () => setup.renderer.destroy();
    await act(async () => {
      await setup.renderOnce();
    });
    const frame = setup.captureCharFrame();

    expect(frame).toContain("SELECTED STACK");
    expect(frame).toContain("LATEST DEPLOYMENT");
    expect(frame).toContain("RESOURCE DELTA");
    expect(frame).toContain("create:2 update:1");
  });
});
