import { C } from "../lib/colors.ts";
import { shortBranch, truncate } from "../lib/helpers.ts";
import type { StackState } from "../lib/deploy-state.ts";

const HEALTH_STYLE = {
  failed: { icon: "×", color: C.red },
  deploying: { icon: "◆", color: C.cyan },
  healthy: { icon: "●", color: C.green },
  unknown: { icon: "?", color: C.yellow },
} as const;

export function StackDetail({
  state,
  compact = false,
  width = 44,
}: {
  state: StackState;
  compact?: boolean;
  width?: number;
}) {
  const { stack, history, ghRun, health, statusLabel } = state;
  const style = HEALTH_STYLE[health];
  const ghLabel = ghRun
    ? ghRun.status === "completed" ? ghRun.conclusion || "completed" : ghRun.status
    : "not linked";
  const context = history
    ? `${shortBranch(history.branch)} · ${history.author} · ${history.message}`
    : "No deployment history is available for this stack.";

  if (compact) {
    return (
      <box flexDirection="column" paddingX={2}>
        <text fg={C.border}>{"─".repeat(Math.max(10, width - 4))}</text>
        <text>
          <span fg={style.color}><strong>{style.icon} {statusLabel.toUpperCase()}</strong></span>
          <span fg={C.fgDark}>  //  </span>
          <span fg={C.cyan}><strong>{stack.name}</strong></span>
          {history && <span fg={C.fgDark}>  v{String(history.version)} · {history.duration || "—"}</span>}
        </text>
        <text fg={C.fgMuted}>{truncate(context, Math.max(20, width - 4))}</text>
        <text fg={history?.resourceChanges ? C.yellow : C.fgDark}>
          {truncate(history?.resourceChanges || "No resource changes recorded", Math.max(20, width - 4))}
        </text>
        <text fg={C.fgDark}>enter history · p pulumi · g github</text>
      </box>
    );
  }

  return (
    <box flexDirection="column" width={width} paddingX={2}>
      <text fg={C.fgDark}>SELECTED STACK</text>
      <text>
        <span fg={style.color}><strong>{style.icon} {statusLabel.toUpperCase()}</strong></span>
        <span fg={C.fgDark}>  /  </span>
        <span fg={C.cyan}><strong>{stack.name}</strong></span>
      </text>
      <text fg={C.border}>{"─".repeat(Math.max(10, width - 4))}</text>
      <text fg={C.fgDark}>LATEST DEPLOYMENT</text>
      <text fg={C.fg}>
        {history ? `Pulumi v${history.version} · ${history.kind}` : "No Pulumi history"}
      </text>
      <text fg={ghRun ? C.fg : C.fgDark}>GitHub · {ghLabel}</text>
      <box height={1} />
      <text fg={C.fgDark}>CHANGE</text>
      <text fg={C.magenta}>{history ? truncate(shortBranch(history.branch), width - 4) : "—"}</text>
      <text fg={C.fg}>{history ? truncate(history.message, width - 4) : "No deployment recorded"}</text>
      <text fg={C.fgDark}>{history ? `${history.author} · ${history.duration || "duration unavailable"}` : ""}</text>
      <box height={1} />
      <text fg={C.fgDark}>RESOURCE DELTA</text>
      <text fg={history?.resourceChanges ? C.yellow : C.fgDark}>
        {history?.resourceChanges || "No changes recorded"}
      </text>
      <box flexGrow={1} />
      <text fg={C.fgDark}>enter history · p pulumi · g github</text>
    </box>
  );
}
