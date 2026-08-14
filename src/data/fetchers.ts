import type { StackInfo, StackHistory, GHRun, PullRequestInfo } from "../lib/types.ts";
import { loadConfig } from "../lib/config.ts";

const COMMAND_TIMEOUT_MS = 30_000;

export class DataSourceError extends Error {
  constructor(
    readonly source: string,
    message: string,
  ) {
    super(message);
    this.name = "DataSourceError";
  }
}

async function runCmd(cmd: string[], cwd?: string): Promise<string> {
  const proc = Bun.spawn(cmd, {
    cwd: cwd ?? undefined,
    stdout: "pipe",
    stderr: "pipe",
  });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, COMMAND_TIMEOUT_MS);

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(timeout);

  const source = cmd[0] ?? "command";
  if (timedOut) {
    throw new DataSourceError(source, `${source} timed out after 30 seconds`);
  }
  if (exitCode !== 0) {
    const detail = stderr.trim() || stdout.trim() || `exit code ${exitCode}`;
    throw new DataSourceError(source, detail.split("\n").at(-1) ?? detail);
  }
  return stdout;
}

function parseArray<T>(source: string, text: string): T[] {
  try {
    const value: unknown = JSON.parse(text);
    if (!Array.isArray(value)) throw new Error("expected an array");
    return value as T[];
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new DataSourceError(source, `${source} returned ${detail}`);
  }
}

function parseHistoryEntry(e: Record<string, unknown>): StackHistory {
  const env = (e.environment && typeof e.environment === "object" ? e.environment : {}) as Record<string, unknown>;
  const branch = typeof env["git.headName"] === "string" ? env["git.headName"] : "unknown";
  const author = typeof env["git.author"] === "string" ? env["git.author"] : "unknown";
  const ghRunUrl = typeof env["ci.build.url"] === "string" ? env["ci.build.url"] : "";
  const repo = typeof env["github.repository"] === "string" ? env["github.repository"] : "";
  const commitSha = typeof env["git.head"] === "string"
    ? env["git.head"]
    : typeof env["ci.pr.headSHA"] === "string"
      ? env["ci.pr.headSHA"]
      : undefined;

  let prNumber: number | undefined;
  const rawPrNum = env["github.pr.number"];
  if (rawPrNum !== undefined && rawPrNum !== null && rawPrNum !== "") {
    const parsedNum = Number(rawPrNum);
    if (Number.isFinite(parsedNum)) prNumber = parsedNum;
  }
  if (prNumber === undefined && typeof e.message === "string") {
    const msgMatch = e.message.match(/#(\d+)/);
    if (msgMatch) {
      const parsedNum = Number(msgMatch[1]);
      if (Number.isFinite(parsedNum)) prNumber = parsedNum;
    }
  }

  const startTime = typeof e.startTime === "string" ? e.startTime : "";
  const endTime = typeof e.endTime === "string" ? e.endTime : "";
  let duration = "";
  if (startTime && endTime) {
    const diffSec = Math.floor(
      (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
    );
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    duration = mins > 0 ? `${mins}m${secs}s` : `${secs}s`;
  }

  const rc = (e.resourceChanges && typeof e.resourceChanges === "object" ? e.resourceChanges : {}) as Record<string, unknown>;
  const changes = Object.entries(rc)
    .filter(([k]) => k !== "same")
    .map(([k, v]) => `${k}:${v}`)
    .join(" ");

  return {
    version: typeof e.version === "number" ? e.version : 0,
    status: typeof e.result === "string" ? e.result : "unknown",
    kind: typeof e.kind === "string" ? e.kind : "update",
    message: typeof e.message === "string" ? e.message : "",
    branch,
    author,
    duration,
    resourceChanges: changes,
    startTime,
    endTime,
    ghRunUrl,
    repo,
    prNumber,
    commitSha,
  };
}


export async function fetchStackList(): Promise<StackInfo[]> {
  const cfg = loadConfig();
  const text = await runCmd(
    ["pulumi", "--cwd", cfg.pulumiPkg, "stack", "ls", "--json"],
    cfg.pulumiDir,
  );
  const stacks = parseArray<Record<string, unknown>>("Pulumi stack list", text);
  return stacks
    .filter((stack) => typeof stack.name === "string")
    .map((stack) => ({
      name: String(stack.name),
      lastUpdate: typeof stack.lastUpdate === "string" ? stack.lastUpdate : "n/a",
      resourceCount: String(stack.resourceCount ?? "n/a"),
      url: typeof stack.url === "string" ? stack.url : "",
      updateInProgress: stack.updateInProgress === true,
    }));
}

export async function fetchStackHistory(
  stackName: string,
  pageSize = 1,
  includeRefresh = false,
): Promise<StackHistory[]> {
  const cfg = loadConfig();
  // Fetch extra entries so we can filter out refreshes and still return enough.
  const fetchSize = includeRefresh ? pageSize : pageSize + 10;
  const text = await runCmd(
    [
      "pulumi", "--cwd", cfg.pulumiPkg, "stack", "history",
      "--stack", stackName,
      "--json", "--show-secrets=false",
      "--page-size", String(fetchSize),
    ],
    cfg.pulumiDir,
  );
  const entries = parseArray<Record<string, unknown>>(`Pulumi history for ${stackName}`, text);
  const parsed: StackHistory[] = entries.map(parseHistoryEntry);
  if (includeRefresh) return parsed.slice(0, pageSize);
  return parsed
    .filter((entry) => entry.kind === "update" || entry.kind === "import" || entry.kind === "destroy")
    .slice(0, pageSize);
}

export async function fetchGHRuns(): Promise<GHRun[]> {
  const cfg = loadConfig();
  if (!cfg.ghRepo) {
    throw new DataSourceError("GitHub Actions", "No GitHub repository is configured");
  }
  const text = await runCmd([
    "gh", "run", "list",
    "--json", "name,status,conclusion,startedAt,updatedAt,headBranch,displayTitle,url,workflowName,event",
    "--limit", "40",
    "-R", cfg.ghRepo,
  ]);
  return parseArray<GHRun>("GitHub Actions", text)
    .filter((run) => run.workflowName?.toLowerCase().includes("pulumi"));
}

export async function fetchPullRequests(): Promise<PullRequestInfo[]> {
  const cfg = loadConfig();
  if (!cfg.ghRepo) {
    throw new DataSourceError("GitHub pull requests", "No GitHub repository is configured");
  }
  const text = await runCmd([
    "gh", "pr", "list",
    "--state", "all",
    "--json", "number,title,state,isDraft,headRefName,url,updatedAt,closedAt,mergedAt,author",
    "--limit", "2000",
    "-R", cfg.ghRepo,
  ]);
  return parseArray<PullRequestInfo>("GitHub pull requests", text);
}

export async function fetchGHRunLogs(runUrl: string): Promise<string> {
  const match = runUrl.match(/\/runs\/(\d+)/);
  if (!match) throw new DataSourceError("GitHub Actions", "Could not identify the workflow run");
  const cfg = loadConfig();
  const text = await runCmd([
    "gh", "run", "view", match[1]!,
    "--log-failed",
    "-R", cfg.ghRepo,
  ]);
  return text.trim() || "No failed step logs were returned.";
}
