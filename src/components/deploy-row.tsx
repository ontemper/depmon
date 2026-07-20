import { C } from "../lib/colors.ts";
import { truncate, pad, timeAgo, extractStackName } from "../lib/helpers.ts";
import { runHealth } from "../lib/deploy-state.ts";
import type { GHRun } from "../lib/types.ts";

const HEALTH_STYLE = {
  failed: { icon: "×", color: C.red },
  deploying: { icon: "◆", color: C.cyan },
  healthy: { icon: "●", color: C.green },
  unknown: { icon: "?", color: C.yellow },
} as const;

export function DeployRow({
  run,
  selected,
  width,
}: {
  run: GHRun;
  selected: boolean;
  width: number;
}) {
  const health = runHealth(run);
  const style = HEALTH_STYLE[health];
  const narrow = width < 72;
  const titleStack = extractStackName(run.displayTitle);
  const stackName = titleStack === "unknown" ? extractStackName(run.name) : titleStack;
  const branchWidth = width >= 100 ? 24 : 17;
  const titleWidth = Math.max(14, width - branchWidth - 56);
  const label = health === "deploying"
    ? run.status === "queued" ? "queued" : "running"
    : run.conclusion || run.status;
  const trigger = run.event === "workflow_dispatch" ? "manual" : run.event;

  return (
    <box flexDirection="row" width="100%" backgroundColor={selected ? C.bgSelected : "transparent"} paddingX={1} height={1}>
      <text fg={selected ? C.cyan : C.fgDark}>{selected ? "▌" : " "}</text>
      <text fg={style.color}>{pad(style.icon, 2)}</text>
      <text fg={style.color}>{pad(label.toUpperCase(), 11)}</text>
      <text fg={C.fg}><strong>{pad(truncate(stackName, 14), 15)}</strong></text>
      {!narrow && <text fg={C.magenta}>{pad(truncate(run.headBranch, branchWidth - 1), branchWidth)}</text>}
      <text fg={C.fgMuted}>{pad(truncate(run.displayTitle, titleWidth - 1), titleWidth)}</text>
      {!narrow && <text fg={C.fgDark}>{pad(truncate(trigger, 9), 10)}</text>}
      <text fg={C.fgDark}>{timeAgo(run.startedAt)}</text>
    </box>
  );
}
