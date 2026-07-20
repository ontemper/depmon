import { C } from "../lib/colors.ts";
import type { TabName } from "../lib/types.ts";
import { Divider } from "./divider.tsx";
import type { FleetSummary } from "../lib/deploy-state.ts";
import { useTerminalDimensions } from "@opentui/react";

const TABS: { key: TabName; label: string; keyHint: string }[] = [
  { key: "stacks", label: "Fleet", keyHint: "1" },
  { key: "deploys", label: "Runs", keyHint: "2" },
  { key: "activity", label: "Timeline", keyHint: "3" },
  { key: "availability", label: "Free", keyHint: "4" },
];
const LOGO = [
  "█▀▄ █▀▀ █▀█ █▀▄▀█ █▀█ █▄ █",
  "█▄▀ ██▄ █▀▀ █ ▀ █ █▄█ █ ▀█",
] as const;


export function Header({
  activeTab,
  loading,
  lastRefresh,
  fromCache,
  summary,
  warnings,
  error,
}: {
  activeTab: TabName;
  loading: boolean;
  lastRefresh: Date | null;
  fromCache: boolean;
  summary: FleetSummary;
  warnings: string[];
  error: string | null;
}) {
  const { width } = useTerminalDimensions();
  const compact = width < 76;
  const refreshText = loading
    ? "SYNCING"
    : lastRefresh
      ? `SYNC ${lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
      : "NOT SYNCED";
  const degraded = [error, ...warnings].filter(Boolean).join(" · ");

  return (
    <box flexDirection="column" width="100%">
      <box flexDirection="row" justifyContent="space-between" width="100%" paddingX={2}>
        {compact ? (
          <text>
            <span fg={C.cyan}><strong>DEPMON</strong></span>
            <span fg={C.fgDark}> // </span>
            <span fg={C.fg}><strong>CONTROL</strong></span>
          </text>
        ) : (
          <box flexDirection="column">
            {LOGO.map((line) => (
              <text key={line} fg={C.blue}><strong>{line}</strong></text>
            ))}
          </box>
        )}
        <box flexDirection="column" alignItems="flex-end">
          {!compact && <text fg={C.fg}><strong>DEPLOY CONTROL</strong></text>}
          <text fg={loading ? C.cyan : C.fgDark}>
            {refreshText}{" "}
            <span fg={loading ? C.cyan : fromCache ? C.yellow : C.green}>
              {loading ? "◌" : fromCache ? "◒" : "●"}
            </span>
          </text>
        </box>
      </box>

      <box flexDirection="row" gap={compact ? 2 : 3} paddingX={2}>
        <text fg={summary.failed > 0 ? C.red : C.fgDark}>
          <strong>■ {String(summary.failed)}</strong>{compact ? "" : " ATTENTION"}
        </text>
        <text fg={summary.deploying > 0 ? C.cyan : C.fgDark}>
          <strong>◆ {String(summary.deploying)}</strong>{compact ? "" : " LIVE"}
        </text>
        <text fg={C.green}>
          <strong>✓ {String(summary.healthy)}</strong>{compact ? "" : " CLEAR"}
        </text>
        {summary.unknown > 0 && (
          <text fg={C.yellow}><strong>? {String(summary.unknown)}</strong>{compact ? "" : " NO SIGNAL"}</text>
        )}
        <text fg={C.fgDark}>{String(summary.total)} STACKS</text>
      </box>

      {degraded && (
        <box paddingX={2}>
          <text fg={C.yellow}>⚠ DEGRADED DATA · {degraded}</text>
        </box>
      )}

      <box flexDirection="row" gap={3} paddingX={2}>
        {TABS.map((tab) => (
          <text key={tab.key} fg={activeTab === tab.key ? C.cyan : C.fgMuted}>
            <span fg={C.fgDark}>{tab.keyHint}</span>{" "}
            {activeTab === tab.key
              ? <strong>{tab.label.toUpperCase()}</strong>
              : tab.label.toUpperCase()}
          </text>
        ))}
      </box>
      <Divider />
    </box>
  );
}
