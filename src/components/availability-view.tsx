import { useTerminalDimensions } from "@opentui/react";
import { C } from "../lib/colors.ts";
import { pad, shortBranch, truncate } from "../lib/helpers.ts";
import type { AvailabilityStatus, StackAvailability } from "../lib/availability.ts";

const STATUS_STYLE: Record<AvailabilityStatus, { icon: string; label: string; color: string }> = {
  available: { icon: "✓", label: "FREE", color: C.green },
  deploying: { icon: "◆", label: "DEPLOYING", color: C.cyan },
  in_use: { icon: "●", label: "IN USE", color: C.magenta },
  stale: { icon: "!", label: "STALE", color: C.yellow },
  unknown: { icon: "?", label: "CHECK", color: C.fgMuted },
};

function ageLabel(item: StackAvailability): string {
  if (item.ageDays === null) return item.status === "available" ? "unused" : "—";
  if (item.status === "available") return `free ${item.ageDays}d`;
  if (item.status === "stale") return `${item.ageDays}d stale`;
  if (item.status === "in_use") return `${item.ageDays}d active`;
  return `${item.ageDays}d ago`;
}

export function AvailabilityView({
  items,
  selectedIdx,
}: {
  items: StackAvailability[];
  selectedIdx: number;
}) {
  const { width, height } = useTerminalDimensions();
  const compact = width < 90;
  const listHeight = Math.max(4, height - 15);
  const maxStart = Math.max(0, items.length - listHeight);
  const start = Math.min(maxStart, Math.max(0, selectedIdx - Math.floor(listHeight / 2)));
  const visible = items.slice(start, start + listHeight);
  const selected = items[selectedIdx];
  const free = items.filter((item) => item.status === "available").length;
  const stale = items.filter((item) => item.status === "stale").length;
  const busy = items.filter((item) => item.status === "in_use" || item.status === "deploying").length;
  const check = items.filter((item) => item.status === "unknown").length;

  if (items.length === 0) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text fg={C.fgMuted}>No non-production stacks found</text>
      </box>
    );
  }

  return (
    <box flexDirection="column" width="100%" flexGrow={1}>
      <box flexDirection="row" justifyContent="space-between" paddingX={2}>
        <text fg={C.fg}><strong>WHERE CAN I DEPLOY?</strong></text>
        <text fg={free > 0 ? C.green : C.yellow}><strong>{free} FREE</strong></text>
      </box>
      <box flexDirection="row" gap={3} paddingX={2}>
        <text fg={C.green}>{free} ready</text>
        <text fg={C.magenta}>{busy} in use</text>
        {stale > 0 && <text fg={C.yellow}>{stale} stale</text>}
        {check > 0 && <text fg={C.fgMuted}>{check} check</text>}
      </box>
      <box paddingX={1}>
        <text fg={C.fgDark}>{compact ? "  STATUS      STACK          PR / AGE" : "  STATUS      STACK          PR        OWNER       AGE          DEPLOYED BRANCH"}</text>
      </box>
      <box flexDirection="column" flexGrow={1}>
        {visible.map((item, offset) => {
          const index = start + offset;
          const isSelected = index === selectedIdx;
          const style = STATUS_STYLE[item.status];
          const pullRequest = item.pullRequest;
          const pullRequestLabel = pullRequest
            ? `#${pullRequest.number} ${pullRequest.state.toLowerCase()}`
            : item.status === "available" ? "empty" : "no PR";
          const owner = pullRequest?.author?.name || pullRequest?.author?.login || "—";
          const branch = item.state.history?.branch || "—";

          return (
            <box
              key={item.state.stack.name}
              flexDirection="row"
              width="100%"
              paddingX={1}
              backgroundColor={isSelected ? C.bgSelected : "transparent"}
            >
              <text fg={isSelected ? C.cyan : C.fgDark}>{isSelected ? "▌" : " "}</text>
              <text fg={style.color}>{pad(`${style.icon} ${style.label}`, 12)}</text>
              <text fg={C.fg}><strong>{pad(truncate(item.state.stack.name, 13), 15)}</strong></text>
              <text fg={C.fgDark}>{pad(truncate(pullRequestLabel, compact ? 12 : 14), compact ? 14 : 16)}</text>
              {!compact && <text fg={C.fgMuted}>{pad(truncate(owner, 10), 12)}</text>}
              <text fg={item.status === "stale" ? C.yellow : C.fgDark}>{pad(ageLabel(item), compact ? 11 : 13)}</text>
              {!compact && <text fg={C.fgMuted}>{truncate(shortBranch(branch), Math.max(8, width - 72))}</text>}
            </box>
          );
        })}
      </box>

      {selected && (
        <box flexDirection="column" paddingX={2}>
          <text fg={C.border}>{"─".repeat(Math.max(10, width - 4))}</text>
          <text>
            <span fg={STATUS_STYLE[selected.status].color}><strong>{selected.status === "available" ? "BEST NEXT" : "CHECK FIRST"}</strong></span>
            <span fg={C.fgDark}> // </span>
            <span fg={C.cyan}><strong>{selected.state.stack.name}</strong></span>
          </text>
          <text fg={C.fg}>{truncate(selected.reason + (selected.pullRequest ? ` · PR #${selected.pullRequest.number} ${selected.pullRequest.title}` : ""), Math.max(20, width - 4))}</text>
          <text fg={C.fgMuted}>
            {truncate(`${selected.state.statusLabel} · ${selected.state.history?.branch || "no deployment"} · ${ageLabel(selected)}`, Math.max(20, width - 4))}
          </text>
        </box>
      )}
    </box>
  );
}
