import { useTerminalDimensions } from "@opentui/react";
import { C } from "../lib/colors.ts";
import { pad, shortBranch, truncate, timeAgo } from "../lib/helpers.ts";
import type { StackState } from "../lib/deploy-state.ts";

const HEALTH_STYLE = {
  failed: { icon: "×", color: C.red },
  deploying: { icon: "◆", color: C.cyan },
  healthy: { icon: "●", color: C.green },
  unknown: { icon: "?", color: C.yellow },
} as const;

export function ActivityView({
  states,
  selectedIdx,
}: {
  states: StackState[];
  selectedIdx: number;
}) {
  const { width, height } = useTerminalDimensions();
  const visibleCount = Math.max(2, Math.floor((height - 8) / 2));
  const maxStart = Math.max(0, states.length - visibleCount);
  const start = Math.min(maxStart, Math.max(0, selectedIdx - Math.floor(visibleCount / 2)));
  const visible = states.slice(start, start + visibleCount);

  if (states.length === 0) {
    return (
      <box justifyContent="center" alignItems="center" flexGrow={1}>
        <box flexDirection="column" alignItems="center">
          <text fg={C.fg}><strong>NO DEPLOYMENT EVENTS</strong></text>
          <text fg={C.fgDark}>The timeline appears after the first Pulumi deployment.</text>
        </box>
      </box>
    );
  }

  return (
    <box flexDirection="column" width="100%" flexGrow={1}>
      <box flexDirection="row" justifyContent="space-between" paddingX={2}>
        <text fg={C.fg}>
          <strong>FLIGHT RECORDER</strong>
          <span fg={C.fgDark}>{width < 76 ? " · enter opens history" : " · latest deployment per stack"}</span>
        </text>
        {width >= 76 && <text fg={C.fgDark}>enter opens full history</text>}
      </box>
      <box flexDirection="column" flexGrow={1}>
        {visible.map((state, offset) => {
          const history = state.history!;
          const selected = start + offset === selectedIdx;
          const style = HEALTH_STYLE[state.health];
          const changeWidth = Math.max(8, width - 49);
          const messageWidth = Math.max(12, width - 50);
          const primary = `${selected ? "▌" : " "}  ${pad(timeAgo(history.startTime), 9)} ${style.icon} ${pad(truncate(state.stack.name, 15), 16)}${pad(`v${history.version}`, 7)}${pad(history.duration || "—", 8)}${truncate(history.resourceChanges || "no delta", changeWidth)}`;
          const secondary = `${selected ? "▌" : "│"}           ${pad(truncate(shortBranch(history.branch), 19), 20)} ← ${pad(history.author.split(" ")[0] || "—", 10)} · ${truncate(history.message, messageWidth)}`;
          return (
            <box
              key={state.stack.name}
              flexDirection="column"
              paddingX={1}
              backgroundColor={selected ? C.bgSelected : "transparent"}
            >
              <text fg={selected ? C.fg : style.color}>{truncate(primary, Math.max(20, width - 2))}</text>
              <text fg={selected ? C.fgMuted : C.fgDark}>{truncate(secondary, Math.max(20, width - 2))}</text>
            </box>
          );
        })}
      </box>
    </box>
  );
}
