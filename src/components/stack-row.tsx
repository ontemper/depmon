import { C } from "../lib/colors.ts";
import { shortBranch, truncate, pad, timeAgo } from "../lib/helpers.ts";
import type { StackState } from "../lib/deploy-state.ts";

const HEALTH_STYLE = {
  failed: { icon: "×", color: C.red },
  deploying: { icon: "◆", color: C.cyan },
  healthy: { icon: "●", color: C.green },
  unknown: { icon: "?", color: C.yellow },
} as const;

export function StackRow({
  state,
  selected,
  width,
}: {
  state: StackState;
  selected: boolean;
  width: number;
}) {
  const { stack, history, health, statusLabel } = state;
  const style = HEALTH_STYLE[health];
  const narrow = width < 72;
  const branchWidth = width >= 100 ? 22 : 16;
  const messageWidth = Math.max(8, width - (narrow ? 44 : branchWidth + 58));
  const branch = history ? shortBranch(history.branch) : "—";
  const message = history?.message || "No deployment history";
  const updated = stack.lastUpdate !== "n/a" ? timeAgo(stack.lastUpdate) : "never";

  return (
    <box
      flexDirection="row"
      width="100%"
      backgroundColor={selected ? C.bgSelected : "transparent"}
      paddingX={1}
      height={1}
    >
      <text fg={selected ? C.cyan : C.fgDark}>{selected ? "▌" : " "}</text>
      <text fg={style.color}>{pad(style.icon, 2)}</text>
      <text fg={style.color}>{pad(statusLabel.toUpperCase(), 11)}</text>
      <text fg={C.fg}><strong>{pad(truncate(stack.name, 14), 15)}</strong></text>
      {!narrow && <text fg={C.magenta}>{pad(truncate(branch, branchWidth - 1), branchWidth)}</text>}
      <text fg={C.fgMuted}>{pad(truncate(message, messageWidth - 1), messageWidth)}</text>
      <text fg={C.fgDark}>{pad(updated, 9)}</text>
      <text fg={C.fgDark}>{stack.resourceCount}</text>
    </box>
  );
}
