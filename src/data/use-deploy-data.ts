import { useState, useEffect, useCallback, useRef } from "react";
import type { DeployData, StackHistory, StackInfo } from "../lib/types.ts";
import { fetchStackList, fetchStackHistory, fetchGHRuns, fetchPullRequests } from "./fetchers.ts";
import { readCache, writeCache } from "./cache.ts";

const HISTORY_CONCURRENCY = 4;
const REFRESH_INTERVAL_MS = 15_000;

async function fetchLatestHistories(
  stacks: StackInfo[],
  previousStacks: StackInfo[],
  previous: Map<string, StackHistory>,
): Promise<{ history: Map<string, StackHistory>; failures: number }> {
  const currentNames = new Set(stacks.map((stack) => stack.name));
  const history = new Map(
    [...previous].filter(([name]) => currentNames.has(name)),
  );
  const previousByName = new Map(
    previousStacks.map((stack) => [stack.name, stack]),
  );
  const targets = stacks.filter((stack) =>
    stack.lastUpdate !== "n/a" &&
    (
      !history.has(stack.name) ||
      previousByName.get(stack.name)?.lastUpdate !== stack.lastUpdate
    )
  );
  let cursor = 0;
  let failures = 0;

  const worker = async () => {
    while (cursor < targets.length) {
      const stack = targets[cursor++]!;
      try {
        const entries = await fetchStackHistory(stack.name, 1);
        const latest = entries[0];
        if (latest) history.set(stack.name, latest);
      } catch {
        failures += 1;
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(HISTORY_CONCURRENCY, targets.length) },
      () => worker(),
    ),
  );
  return { history, failures };
}

export function useDeployData() {
  const cached = useRef(readCache()).current;
  const mounted = useRef(true);
  const inFlight = useRef<Promise<void> | null>(null);
  const [data, setData] = useState<DeployData>(() => cached
    ? {
        stacks: cached.stacks,
        history: cached.history,
        ghRuns: cached.ghRuns,
        pullRequests: cached.pullRequests,
        loading: true,
        lastRefresh: new Date(Date.now() - cached.age),
        error: null,
        warnings: [],
        fromCache: true,
      }
    : {
        stacks: [],
        history: new Map(),
        ghRuns: [],
        pullRequests: [],
        loading: true,
        lastRefresh: null,
        error: null,
        warnings: [],
        fromCache: false,
      });
  const dataRef = useRef(data);
  dataRef.current = data;

  const refresh = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;

    const task = (async () => {
      setData((previous) => ({ ...previous, loading: true, error: null, warnings: [] }));
      try {
        const [stacksResult, runsResult, pullRequestsResult] = await Promise.allSettled([
          fetchStackList(),
          fetchGHRuns(),
          fetchPullRequests(),
        ]);
        if (stacksResult.status === "rejected") throw stacksResult.reason;

        const stacks = stacksResult.value;
        const previousData = dataRef.current;
        const previousHistory = previousData.history;
        const ghRuns = runsResult.status === "fulfilled" ? runsResult.value : previousData.ghRuns;
        const pullRequests = pullRequestsResult.status === "fulfilled"
          ? pullRequestsResult.value
          : previousData.pullRequests;
        const refreshTime = new Date();

        if (mounted.current) {
          setData((current) => ({
            ...current,
            stacks,
            ghRuns,
            pullRequests,
            lastRefresh: refreshTime,
            fromCache: false,
          }));
        }

        const { history, failures } = await fetchLatestHistories(
          stacks,
          previousData.stacks,
          previousHistory,
        );
        const warnings: string[] = [];
        if (runsResult.status === "rejected") {
          const detail = runsResult.reason instanceof Error ? runsResult.reason.message : "Unknown data source error";
          warnings.push(`GitHub: ${detail}`);
        }
        if (pullRequestsResult.status === "rejected") {
          const detail = pullRequestsResult.reason instanceof Error
            ? pullRequestsResult.reason.message
            : "Unknown data source error";
          warnings.push(`GitHub PRs: ${detail}`);
        }
        if (failures > 0) {
          warnings.push(`${failures} stack ${failures === 1 ? "history" : "histories"} could not be refreshed`);
        }

        writeCache(stacks, history, ghRuns, pullRequests);
        if (!mounted.current) return;
        setData({
          stacks,
          history,
          ghRuns,
          pullRequests,
          loading: false,
          lastRefresh: refreshTime,
          error: null,
          warnings,
          fromCache: false,
        });
      } catch (error) {
        if (!mounted.current) return;
        setData((previous) => ({
          ...previous,
          loading: false,
          error: error instanceof Error ? error.message : "Unknown data source error",
        }));
      }
    })().finally(() => {
      inFlight.current = null;
    });

    inFlight.current = task;
    return task;
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const interval = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [refresh]);

  return { data, refresh };
}
