import { afterEach, describe, expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import { Header } from "./header.tsx";

const summary = { total: 16, failed: 2, deploying: 0, healthy: 13, unknown: 1 };
let destroyRenderer: (() => void) | undefined;

afterEach(async () => {
  await act(async () => {
    destroyRenderer?.();
  });
  destroyRenderer = undefined;
});

async function renderHeader(width: number) {
  const setup = await testRender(
    <Header
      activeTab="stacks"
      loading={false}
      lastRefresh={new Date("2026-07-19T12:00:00Z")}
      fromCache={false}
      summary={summary}
      warnings={[]}
      error={null}
    />,
    { width, height: 8 },
  );
  destroyRenderer = () => setup.renderer.destroy();
  await act(async () => {
    await setup.renderOnce();
  });
  return setup.captureCharFrame();
}

describe("depmon wordmark", () => {
  test("shows the block logo when the terminal has room", async () => {
    const frame = await renderHeader(80);
    expect(frame).toContain("█▀▄ █▀▀ █▀█ █▀▄▀█ █▀█ █▄ █");
    expect(frame).toContain("DEPLOY CONTROL");
  });

  test("keeps a compact wordmark on narrow terminals", async () => {
    const frame = await renderHeader(60);
    expect(frame).toContain("DEPMON // CONTROL");
    expect(frame).not.toContain("█▀▄ █▀▀");
  });
});
