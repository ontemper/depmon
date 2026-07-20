import { useTerminalDimensions } from "@opentui/react";
import { C } from "../lib/colors.ts";
import { extractStackName, timeAgo, truncate } from "../lib/helpers.ts";
import { runHealth } from "../lib/deploy-state.ts";
import type { GHRun } from "../lib/types.ts";
import { DeployRow } from "./deploy-row.tsx";

const HEALTH_COLOR = {
  failed: C.red,
  deploying: C.cyan,
  healthy: C.green,
  unknown: C.yellow,
} as const;

function RunDetail({ run, compact, width }: { run: GHRun; compact: boolean; width: number }) {
  const health = runHealth(run);
  const color = HEALTH_COLOR[health];
  const titleStack = extractStackName(run.displayTitle);
  const stack = titleStack === "unknown" ? extractStackName(run.name) : titleStack;
  const label = health === "deploying" ? run.status : run.conclusion || run.status;

  if (compact) {
    return (
      <box flexDirection="column" paddingX={2}>
        <text fg={C.border}>{"─".repeat(Math.max(10, width - 4))}</text>
        <text>
          <span fg={color}><strong>{label.toUpperCase()}</strong></span>
          <span fg={C.fgDark}>  //  </span>
          <span fg={C.cyan}><strong>{stack}</strong></span>
          <span fg={C.fgDark}> · {timeAgo(run.startedAt)}</span>
        </text>
        <text fg={C.magenta}>{truncate(run.headBranch, Math.max(20, width - 4))}</text>
        <text fg={C.fgMuted}>{truncate(run.displayTitle, Math.max(20, width - 4))}</text>
      </box>
    );
  }

  return (
    <box flexDirection="column" width={width} paddingX={2}>
      <text fg={C.fgDark}>SELECTED RUN</text>
      <text fg={color}><strong>{label.toUpperCase()}</strong></text>
      <text fg={C.cyan}><strong>{stack}</strong></text>
      <text fg={C.border}>{"─".repeat(Math.max(10, width - 4))}</text>
      <text fg={C.fgDark}>BRANCH</text>
      <text fg={C.magenta}>{truncate(run.headBranch, width - 4)}</text>
      <box height={1} />
      <text fg={C.fgDark}>CHANGE</text>
      <text fg={C.fg}>{truncate(run.displayTitle, width - 4)}</text>
      <box height={1} />
      <text fg={C.fgDark}>TRIGGER</text>
      <text fg={C.fg}>{run.event === "workflow_dispatch" ? "Manual dispatch" : run.event}</text>
      <text fg={C.fgDark}>Started {timeAgo(run.startedAt)}</text>
      <box flexGrow={1} />
      <text fg={C.fgDark}>enter / g open in GitHub</text>
    </box>
  );
}

export function DeploysView({
  runs,
  selectedIdx,
}: {
  runs: GHRun[];
  selectedIdx: number;
}) {
  const { width, height } = useTerminalDimensions();
  const wide = width >= 112;
  const inspectorWidth = Math.min(48, Math.max(38, Math.floor(width * 0.32)));
  const listWidth = wide ? width - inspectorWidth - 1 : width;
  const listHeight = Math.max(4, height - (wide ? 9 : 13));
  const maxStart = Math.max(0, runs.length - listHeight);
  const start = Math.min(maxStart, Math.max(0, selectedIdx - Math.floor(listHeight / 2)));
  const visible = runs.slice(start, start + listHeight);
  const selected = runs[selectedIdx];
  const active = runs.filter((run) => runHealth(run) === "deploying").length;
  const failed = runs.filter((run) => runHealth(run) === "failed").length;

  if (runs.length === 0) {
    return (
      <box justifyContent="center" alignItems="center" flexGrow={1}>
        <box flexDirection="column" alignItems="center">
          <text fg={C.fg}><strong>NO WORKFLOW RUNS</strong></text>
          <text fg={C.fgDark}>No Pulumi workflows were returned by GitHub Actions.</text>
        </box>
      </box>
    );
  }

  const list = (
    <box flexDirection="column" width={listWidth}>
      <box flexDirection="row" justifyContent="space-between" paddingX={2}>
        <text fg={C.fg}>
          <strong>WORKFLOW RUNS</strong>
          <span fg={C.fgDark}> · {String(active)} live · {String(failed)} failed</span>
        </text>
        <text fg={C.fgDark}>{String(runs.length)} recent</text>
      </box>
      <box paddingX={1}>
        <text fg={C.fgDark}>
          {listWidth < 72 ? "    STATUS     STACK          CHANGE" : "    STATUS     STACK          BRANCH"}
        </text>
      </box>
      <box flexDirection="column">
        {visible.map((run, offset) => (
          <DeployRow
            key={run.url}
            run={run}
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
        <RunDetail run={selected} compact={false} width={inspectorWidth} />
      </box>
    );
  }

  return (
    <box flexDirection="column" width="100%" flexGrow={1}>
      {list}
      {selected && <RunDetail run={selected} compact width={width} />}
    </box>
  );
}
