import { useState, useEffect } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { C } from "../lib/colors.ts";
import { statusIcon, statusColor, shortBranch, truncate, pad, timeAgo } from "../lib/helpers.ts";
import type { StackInfo, StackHistory } from "../lib/types.ts";
import { fetchStackHistory, fetchGHRunLogs } from "../data/fetchers.ts";

export function StackHistoryView({
  stack,
  selectedIdx,
  inspecting,
  refreshKey,
  onEntriesLoaded,
}: {
  stack: StackInfo;
  selectedIdx: number;
  inspecting: boolean;
  refreshKey: number;
  onEntriesLoaded?: (entries: StackHistory[]) => void;
}) {
  const { width, height } = useTerminalDimensions();
  const [entries, setEntries] = useState<StackHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspectText, setInspectText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchStackHistory(stack.name, 20, true)
      .then((history) => {
        if (cancelled) return;
        setEntries(history);
        onEntriesLoaded?.(history);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        const message = reason instanceof Error ? reason.message : "Could not load deployment history";
        setError(message);
        setEntries([]);
        onEntriesLoaded?.([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stack.name, refreshKey, onEntriesLoaded]);

  const selected = entries[selectedIdx];
  useEffect(() => {
    let cancelled = false;
    if (!inspecting || !selected || selected.status !== "failed" || !selected.ghRunUrl) {
      setInspectText(null);
      return () => {
        cancelled = true;
      };
    }

    setInspectText("Loading failed step logs…");
    void fetchGHRunLogs(selected.ghRunUrl)
      .then((text) => {
        if (!cancelled) setInspectText(text);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setInspectText(reason instanceof Error ? reason.message : "Could not load failed step logs");
      });
    return () => {
      cancelled = true;
    };
  }, [inspecting, selected]);

  if (loading) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text fg={C.cyan}>◌ Loading history for {stack.name}…</text>
      </box>
    );
  }

  if (error || entries.length === 0) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <box flexDirection="column" alignItems="center">
          <text fg={error ? C.red : C.fg}><strong>{error ? "HISTORY UNAVAILABLE" : "NO DEPLOYMENT HISTORY"}</strong></text>
          <text fg={C.fgDark}>{error || `${stack.name} has no recorded updates.`}</text>
        </box>
      </box>
    );
  }

  const listHeight = Math.max(4, height - (inspecting ? 17 : 9));
  const maxStart = Math.max(0, entries.length - listHeight);
  const start = Math.min(maxStart, Math.max(0, selectedIdx - Math.floor(listHeight / 2)));
  const visible = entries.slice(start, start + listHeight);
  const branchWidth = width >= 100 ? 22 : 16;
  const narrow = width < 72;
  const messageWidth = Math.max(10, width - (narrow ? 46 : branchWidth + 54));
  const logLineCount = Math.max(3, height - listHeight - 12);
  const logLines = (inspectText || "")
    .split("\n")
    .map((line) => line.replaceAll("\t", "  ").replace(/\u001b\[[0-9;]*m/g, ""))
    .filter((line) => line.trim().length > 0)
    .slice(-logLineCount);

  return (
    <box flexDirection="column" width="100%" flexGrow={1}>
      <box flexDirection="row" justifyContent="space-between" paddingX={2}>
        <text fg={C.fg}>
          <span fg={C.fgDark}>HISTORY / </span>
          <span fg={C.cyan}><strong>{stack.name}</strong></span>
          <span fg={C.fgDark}> · {String(entries.length)} updates</span>
        </text>
        <text fg={C.fgDark}>esc back · enter {inspecting ? "close" : "inspect"}</text>
      </box>
      <box flexDirection="row" paddingX={1}>
        <text fg={C.fgDark}>{"    VER    KIND      STATUS      DUR     BRANCH"}</text>
      </box>
      <box flexDirection="column">
        {visible.map((entry, offset) => {
          const active = start + offset === selectedIdx;
          const color = statusColor(entry.status);
          return (
            <box
              key={`${entry.version}-${entry.kind}`}
              flexDirection="row"
              backgroundColor={active ? C.bgSelected : "transparent"}
              paddingX={1}
            >
              <text fg={active ? C.cyan : C.fgDark}>{active ? "▌" : " "}</text>
              <text fg={color}>{pad(statusIcon(entry.status), 3)}</text>
              <text fg={C.fgDark}>{pad(`v${entry.version}`, 7)}</text>
              {!narrow && <text fg={C.fg}>{pad(entry.kind, 10)}</text>}
              <text fg={color}>{pad(entry.status.toUpperCase(), 12)}</text>
              <text fg={C.fgDark}>{pad(entry.duration || "—", 8)}</text>
              {!narrow && <text fg={C.magenta}>{pad(truncate(shortBranch(entry.branch), branchWidth - 1), branchWidth)}</text>}
              <text fg={C.fgMuted}>{pad(truncate(entry.message, messageWidth - 1), messageWidth)}</text>
              <text fg={C.fgDark}>{timeAgo(entry.startTime)}</text>
            </box>
          );
        })}
      </box>

      {inspecting && selected && (
        <box flexDirection="column" paddingX={2} flexGrow={1}>
          <text fg={statusColor(selected.status)}>
            <strong>{truncate(`INSPECT / v${selected.version} / ${shortBranch(selected.branch)} / ${selected.author} / ${selected.duration || "—"}`, Math.max(20, width - 6))}</strong>
          </text>
          <text fg={selected.resourceChanges ? C.yellow : C.fgDark}>
            {selected.resourceChanges || "No resource changes recorded"}
          </text>
          {selected.status !== "failed" && (
            <text fg={C.fgMuted}>{truncate(selected.message, Math.max(20, width - 4))}</text>
          )}
          {selected.status === "failed" && !selected.ghRunUrl && (
            <text fg={C.yellow}>No GitHub run is linked to this deployment.</text>
          )}
          {logLines.map((line, index) => (
            <text key={`${index}-${line}`} fg={line.toLowerCase().includes("error") ? C.red : C.fgMuted}>
              {truncate(line, Math.max(20, width - 8))}
            </text>
          ))}
        </box>
      )}
    </box>
  );
}
