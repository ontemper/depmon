import { afterEach, expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import type { StackAvailability } from "../lib/availability.ts";
import { AvailabilityView } from "./availability-view.tsx";

const items: StackAvailability[] = [
  {
    state: {
      stack: { name: "nick-two", lastUpdate: "2026-07-18T12:00:00Z", resourceCount: "20", url: "https://app.pulumi.com/nick-two", updateInProgress: false },
      history: { version: 3, status: "succeeded", kind: "update", message: "Finished work", branch: "nick/finished", author: "Nick", duration: "1m", resourceChanges: "update:1", startTime: "2026-07-18T12:00:00Z", endTime: "2026-07-18T12:01:00Z", ghRunUrl: "", repo: "example/repo" },
      health: "healthy",
      statusLabel: "healthy",
      sortTime: 1,
    },
    pullRequest: { number: 42, title: "Finished work", state: "MERGED", isDraft: false, headRefName: "nick/finished", url: "https://github.com/example/repo/pull/42", updatedAt: "2026-07-18T12:00:00Z", closedAt: null, mergedAt: "2026-07-18T12:00:00Z", author: { login: "nick" } },
    status: "available",
    ageDays: 2,
    reason: "Pull request merged",
  },
  {
    state: {
      stack: { name: "leo-two", lastUpdate: "2026-07-19T12:00:00Z", resourceCount: "20", url: "https://app.pulumi.com/leo-two", updateInProgress: false },
      health: "healthy",
      statusLabel: "healthy",
      sortTime: 2,
    },
    status: "unknown",
    ageDays: 1,
    reason: "No pull request found",
  },
];

let destroyRenderer: (() => void) | undefined;
afterEach(async () => {
  await act(async () => {
    destroyRenderer?.();
  });
  destroyRenderer = undefined;
});

test("answers where to deploy and explains why", async () => {
  const setup = await testRender(<AvailabilityView items={items} selectedIdx={0} />, { width: 80, height: 24 });
  destroyRenderer = () => setup.renderer.destroy();
  await act(async () => {
    await setup.renderOnce();
  });
  const frame = setup.captureCharFrame();

  expect(frame).toContain("WHERE CAN I DEPLOY?");
  expect(frame).toContain("1 FREE");
  expect(frame).toContain("nick-two");
  expect(frame).toContain("#42 merged");
  expect(frame).toContain("BEST NEXT");
  expect(frame).toContain("Pull request merged");
});
