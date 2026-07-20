import { afterEach, expect, test } from "bun:test";
import { createMockKeys } from "@opentui/core/testing";
import { testRender } from "@opentui/react/test-utils";
import { act, useState } from "react";
import { FilterBar } from "./filter-bar.tsx";

function FilterHarness() {
  const [value, setValue] = useState("");
  return <FilterBar value={value} onChange={setValue} />;
}

let destroyRenderer: (() => void) | undefined;
afterEach(async () => {
  await act(async () => {
    destroyRenderer?.();
  });
  destroyRenderer = undefined;
});

test("filters as text is typed instead of waiting for submit", async () => {
  const setup = await testRender(<FilterHarness />, { width: 60, height: 3 });
  destroyRenderer = () => setup.renderer.destroy();
  const keys = createMockKeys(setup.renderer);

  await act(async () => {
    keys.typeText("preview");
    await setup.renderOnce();
  });

  expect(setup.captureCharFrame()).toContain("/preview");
});
