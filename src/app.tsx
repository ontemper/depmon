import { useState, useMemo, useEffect } from "react";
import { useKeyboard, useRenderer } from "@opentui/react";
import { C } from "./lib/colors.ts";
import { buildStackStates, sortRuns, sortStackStates, summarizeFleet } from "./lib/deploy-state.ts";
import { buildStackAvailability } from "./lib/availability.ts";
import type { TabName, SortMode } from "./lib/types.ts";
import { configExists } from "./lib/config.ts";
import { useDeployData } from "./data/use-deploy-data.ts";
import { Header } from "./components/header.tsx";
import { StatusBar } from "./components/status-bar.tsx";
import { StacksView } from "./components/stacks-view.tsx";
import { DeploysView } from "./components/deploys-view.tsx";
import { ActivityView } from "./components/activity-view.tsx";
import { StackHistoryView } from "./components/stack-history-view.tsx";
import { AvailabilityView } from "./components/availability-view.tsx";
import { FilterBar } from "./components/filter-bar.tsx";
import { SetupView } from "./components/setup-view.tsx";

const TABS: TabName[] = ["stacks", "deploys", "activity", "availability"];
const SORT_MODES: SortMode[] = ["attention", "recent", "name"];

export function App() {
  const [showSetup, setShowSetup] = useState(!configExists());
  const renderer = useRenderer();
  const { data, refresh } = useDeployData();
  const [activeTab, setActiveTab] = useState<TabName>("availability");
  const [selectedIdx, setSelectedIdx] = useState(0);
  // Sub-view: when user presses Enter on a stack, show full history
  const [expandedStack, setExpandedStack] = useState<string | null>(null);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [inspecting, setInspecting] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<import("./lib/types.ts").StackHistory[]>([]);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>("attention");
  const [filterActive, setFilterActive] = useState(false);
  const [filterText, setFilterText] = useState("");

  const stackStates = useMemo(
    () => buildStackStates(data.stacks, data.history, data.ghRuns),
    [data.stacks, data.history, data.ghRuns],
  );
  const summary = useMemo(() => summarizeFleet(stackStates), [stackStates]);
  const orderedRuns = useMemo(() => sortRuns(data.ghRuns), [data.ghRuns]);
  const timeline = useMemo(
    () => [...stackStates]
      .filter((state) => state.history)
      .sort((a, b) => b.sortTime - a.sortTime),
    [stackStates],
  );
  const availability = useMemo(
    () => buildStackAvailability(stackStates, data.pullRequests),
    [stackStates, data.pullRequests],
  );
  const sorted = useMemo(() => {
    const ordered = sortStackStates(stackStates, sortMode);
    if (!filterText) return ordered;
    const query = filterText.toLowerCase();
    return ordered.filter(({ stack, history, ghRun }) =>
      stack.name.toLowerCase().includes(query) ||
      history?.branch.toLowerCase().includes(query) ||
      history?.author.toLowerCase().includes(query) ||
      history?.message.toLowerCase().includes(query) ||
      ghRun?.displayTitle.toLowerCase().includes(query),
    );
  }, [stackStates, sortMode, filterText]);

  const maxItems = useMemo(() => {
    if (activeTab === "stacks") return sorted.length;
    if (activeTab === "deploys") return orderedRuns.length;
    if (activeTab === "activity") return timeline.length;
    return availability.length;
  }, [activeTab, availability, orderedRuns, timeline, sorted]);

  useEffect(() => {
    setSelectedIdx((index) => Math.max(0, Math.min(index, maxItems - 1)));
  }, [maxItems]);

  useEffect(() => {
    setHistoryIdx((index) => Math.max(0, Math.min(index, historyEntries.length - 1)));
  }, [historyEntries.length]);

  useKeyboard((key) => {
    // Setup view handles its own keys
    if (showSetup) return;

    // Quit (but not while filtering)
    if (!filterActive && (key.name === "q" || (key.ctrl && key.name === "c"))) {
      renderer.destroy();
      return;
    }
    if (filterActive && (key.ctrl && key.name === "c")) {
      renderer.destroy();
      return;
    }

    // Filter mode
    if (filterActive) {
      if (key.name === "escape") {
        setFilterActive(false);
        setFilterText("");
        setSelectedIdx(0);
        return;
      }
      if (key.name === "enter" || key.name === "return") {
        setFilterActive(false);
        setSelectedIdx(0);
        return;
      }
      // Let the input component handle all other keys
      return;
    }

    // Activate filter
    if (key.name === "/" && !expandedStack && activeTab === "stacks") {
      setFilterActive(true);
      setSelectedIdx(0);
      return;
    }

    // If we're in expanded history view
    if (expandedStack) {
      if (key.name === "escape" || key.name === "backspace") {
        if (inspecting) {
          setInspecting(false);
        } else {
          setExpandedStack(null);
          setHistoryIdx(0);
          setInspecting(false);
        }
        return;
      }
      if (key.name === "j" || key.name === "down") {
        setHistoryIdx((i) => Math.max(0, Math.min(historyEntries.length - 1, i + 1)));
        return;
      }
      if (key.name === "k" || key.name === "up") {
        setHistoryIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (key.name === "i" || key.name === "enter" || key.name === "return") {
        setInspecting((visible) => !visible);
        return;
      }
      // Open in Pulumi Cloud
      if (key.name === "p") {
        const stack = data.stacks.find((s) => s.name === expandedStack);
        const entry = historyEntries[historyIdx];
        if (stack?.url && entry) {
          Bun.spawn(["open", `${stack.url}/updates/${entry.version}`], { stdout: "ignore", stderr: "ignore" });
        } else if (stack?.url) {
          Bun.spawn(["open", stack.url], { stdout: "ignore", stderr: "ignore" });
        }
        return;
      }
      // Open in GitHub Actions
      if (key.name === "g") {
        const entry = historyEntries[historyIdx];
        if (entry?.ghRunUrl) {
          Bun.spawn(["open", entry.ghRunUrl], { stdout: "ignore", stderr: "ignore" });
        }
        return;
      }
      if (key.name === "r") {
        void refresh();
        setHistoryRefreshKey((key) => key + 1);
        return;
      }
      return;
    }

    // Refresh
    if (key.name === "r") {
      refresh();
      return;
    }

    // Tab navigation
    if (key.name === "tab" || key.name === "right") {
      const idx = TABS.indexOf(activeTab);
      setActiveTab(TABS[(idx + 1) % TABS.length]!);
      setSelectedIdx(0);
      return;
    }
    if ((key.shift && key.name === "tab") || key.name === "left") {
      const idx = TABS.indexOf(activeTab);
      setActiveTab(TABS[(idx - 1 + TABS.length) % TABS.length]!);
      setSelectedIdx(0);
      return;
    }

    // Vim navigation
    if (key.name === "j" || key.name === "down") {
      setSelectedIdx((i) => Math.max(0, Math.min(maxItems - 1, i + 1)));
      return;
    }
    if (key.name === "k" || key.name === "up") {
      setSelectedIdx((i) => Math.max(0, i - 1));
      return;
    }

    // Enter: expand stack history
    if (key.name === "enter" || key.name === "return") {
      if (activeTab === "stacks" && sorted[selectedIdx]) {
        setExpandedStack(sorted[selectedIdx].stack.name);
        setHistoryIdx(0);
        setInspecting(false);
        return;
      }
      if (activeTab === "deploys" && orderedRuns[selectedIdx]) {
        const url = orderedRuns[selectedIdx].url;
        if (url) Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });
        return;
      }
      if (activeTab === "activity" && timeline[selectedIdx]) {
        setExpandedStack(timeline[selectedIdx].stack.name);
        setHistoryIdx(0);
        setInspecting(false);
        return;
      }
      if (activeTab === "availability" && availability[selectedIdx]?.pullRequest?.url) {
        Bun.spawn(["open", availability[selectedIdx].pullRequest.url], { stdout: "ignore", stderr: "ignore" });
        return;
      }
    }

    // Open in Pulumi Cloud
    if (key.name === "p") {
      if (activeTab === "stacks") {
        const state = sorted[selectedIdx];
        if (state?.stack.url) Bun.spawn(["open", state.stack.url], { stdout: "ignore", stderr: "ignore" });
      } else if (activeTab === "availability") {
        const item = availability[selectedIdx];
        if (item?.state.stack.url) Bun.spawn(["open", item.state.stack.url], { stdout: "ignore", stderr: "ignore" });
      }
      return;
    }

    // Open in GitHub
    if (key.name === "g") {
      if (activeTab === "stacks") {
        const state = sorted[selectedIdx];
        const url = state?.history?.ghRunUrl || state?.ghRun?.url;
        if (url) Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });
      } else if (activeTab === "deploys") {
        const url = orderedRuns[selectedIdx]?.url;
        if (url) Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });
      } else if (activeTab === "availability") {
        const url = availability[selectedIdx]?.pullRequest?.url;
        if (url) Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });
      }
      return;
    }

    // Toggle sort mode
    if (key.name === "s" && activeTab === "stacks") {
      setSortMode((m) => SORT_MODES[(SORT_MODES.indexOf(m) + 1) % SORT_MODES.length]!);
      setSelectedIdx(0);
      return;
    }

    // Open config
    if (key.name === "c") {
      setShowSetup(true);
      return;
    }

    // Number keys for tabs
    if (key.name === "1") { setActiveTab("stacks"); setSelectedIdx(0); }
    if (key.name === "2") { setActiveTab("deploys"); setSelectedIdx(0); }
    if (key.name === "3") { setActiveTab("activity"); setSelectedIdx(0); }
    if (key.name === "4") { setActiveTab("availability"); setSelectedIdx(0); }
  });

  // Setup view
  if (showSetup) {
    return <SetupView onDone={() => { setShowSetup(false); refresh(); }} />;
  }

  // Sub-view: expanded stack history
  if (expandedStack) {
    const stack = data.stacks.find((s) => s.name === expandedStack);
    if (!stack) {
      setExpandedStack(null);
      return null;
    }
    return (
      <box flexDirection="column" width="100%" height="100%" backgroundColor={C.bg}>
        <Header activeTab={activeTab} loading={data.loading} lastRefresh={data.lastRefresh} fromCache={data.fromCache} summary={summary} warnings={data.warnings} error={data.error} />
        <box flexGrow={1}>
          <StackHistoryView stack={stack} selectedIdx={historyIdx} inspecting={inspecting} refreshKey={historyRefreshKey} onEntriesLoaded={setHistoryEntries} />
        </box>
        <StatusBar hint={
          inspecting
            ? "esc close  j/k move  enter close inspector  p pulumi  g github"
            : "esc back  j/k move  enter inspect  p pulumi  g github"
        } />
      </box>
    );
  }

  return (
    <box flexDirection="column" width="100%" height="100%" backgroundColor={C.bg}>
      <Header activeTab={activeTab} loading={data.loading} lastRefresh={data.lastRefresh} fromCache={data.fromCache} summary={summary} warnings={data.warnings} error={data.error} />

      {data.loading && data.stacks.length === 0 ? (
        <box flexGrow={1} justifyContent="center" alignItems="center">
          <text fg={C.blue}>Loading deployment data…</text>
        </box>
      ) : data.error && data.stacks.length === 0 ? (
        <box flexGrow={1} justifyContent="center" alignItems="center">
          <text fg={C.red}>Error: {data.error}</text>
        </box>
      ) : (
        <box flexGrow={1}>
          {activeTab === "stacks" && <StacksView states={sorted} selectedIdx={selectedIdx} sortMode={sortMode} filterText={filterText} />}
          {activeTab === "deploys" && <DeploysView runs={orderedRuns} selectedIdx={selectedIdx} />}
          {activeTab === "activity" && <ActivityView states={timeline} selectedIdx={selectedIdx} />}
          {activeTab === "availability" && <AvailabilityView items={availability} selectedIdx={selectedIdx} />}
        </box>
      )}

      {filterActive ? (
        <FilterBar value={filterText} onChange={(v) => { setFilterText(v); setSelectedIdx(0); }} />
      ) : (
        <StatusBar hint={
          activeTab === "deploys"
            ? "j/k move  enter/g open run  tab view  r sync  q quit"
            : activeTab === "activity"
              ? "j/k move  enter history  tab view  r sync  q quit"
              : activeTab === "availability"
                ? "j/k move  enter/g open PR  p pulumi  tab view  r sync  q quit"
                : undefined
        } />
      )}
    </box>
  );
}
