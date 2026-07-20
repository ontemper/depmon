import { useTerminalDimensions } from "@opentui/react";
import { C } from "../lib/colors.ts";
import type { StackState } from "../lib/deploy-state.ts";
import type { SortMode } from "../lib/types.ts";
import { StackRow } from "./stack-row.tsx";
import { StackDetail } from "./stack-detail.tsx";

export function StacksView({
  states,
  selectedIdx,
  sortMode,
  filterText,
}: {
  states: StackState[];
  selectedIdx: number;
  sortMode: SortMode;
  filterText: string;
}) {
  const { width, height } = useTerminalDimensions();
  const wide = width >= 112;
  const inspectorWidth = Math.min(48, Math.max(38, Math.floor(width * 0.32)));
  const listWidth = wide ? width - inspectorWidth - 1 : width;
  const listHeight = Math.max(4, height - (wide ? 9 : 14));
  const maxStart = Math.max(0, states.length - listHeight);
  const start = Math.min(maxStart, Math.max(0, selectedIdx - Math.floor(listHeight / 2)));
  const visible = states.slice(start, start + listHeight);
  const selected = states[selectedIdx];
  const queueLabel = sortMode === "attention"
    ? "ATTENTION QUEUE"
    : sortMode === "recent"
      ? "RECENT ACTIVITY"
      : "STACK DIRECTORY";

  if (states.length === 0) {
    return (
      <box justifyContent="center" alignItems="center" flexGrow={1}>
        <box flexDirection="column" alignItems="center">
          <text fg={C.fg}><strong>{filterText ? "NO MATCHING STACKS" : "NO STACKS FOUND"}</strong></text>
          <text fg={C.fgDark}>
            {filterText ? `Clear or change the filter “${filterText}”.` : "Check the Pulumi project in configuration."}
          </text>
        </box>
      </box>
    );
  }

  const list = (
    <box flexDirection="column" width={listWidth}>
      <box flexDirection="row" justifyContent="space-between" paddingX={2}>
        <text fg={C.fg}>
          <strong>{queueLabel}</strong>
          <span fg={C.fgDark}> · {String(states.length)} visible</span>
        </text>
        <text fg={C.fgDark}>
          {start > 0 ? `↑ ${String(start)} earlier  ` : ""}
          {start + visible.length < states.length ? `↓ ${String(states.length - start - visible.length)} more` : ""}
        </text>
      </box>
      <box flexDirection="row" paddingX={1}>
        <text fg={C.fgDark}>
          {listWidth < 72 ? "    STATUS     STACK          CHANGE" : "    STATUS     STACK          BRANCH"}
        </text>
        {listWidth >= 82 && <text fg={C.fgDark}>{"                   CHANGE"}</text>}
      </box>
      <box flexDirection="column" flexGrow={1}>
        {visible.map((state, offset) => (
          <StackRow
            key={state.stack.name}
            state={state}
            selected={start + offset === selectedIdx}
            width={listWidth}
          />
        ))}
      </box>
    </box>
  );

  if (wide && selected) {
    return (
      <box flexDirection="row" width="100%" flexGrow={1}>
        {list}
        <box width={1} backgroundColor={C.border} />
        <StackDetail state={selected} width={inspectorWidth} />
      </box>
    );
  }

  return (
    <box flexDirection="column" width="100%" flexGrow={1}>
      {list}
      {selected && <StackDetail state={selected} compact width={width} />}
    </box>
  );
}
