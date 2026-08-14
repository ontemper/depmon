export interface StackInfo {
  name: string;
  lastUpdate: string;
  resourceCount: string;
  url: string;
  updateInProgress: boolean;
}

export type DeployHealth = "failed" | "deploying" | "healthy" | "unknown";

export interface StackHistory {
  version: number;
  status: string;
  kind: string;
  message: string;
  branch: string;
  author: string;
  duration: string;
  resourceChanges: string;
  startTime: string;
  endTime: string;
  ghRunUrl: string;
  repo: string;
  prNumber?: number;
  commitSha?: string;
}

export interface GHRun {
  name: string;
  status: string;
  conclusion: string;
  startedAt: string;
  updatedAt: string;
  headBranch: string;
  displayTitle: string;
  url: string;
  workflowName: string;
  event: string;
}
export interface PullRequestInfo {
  number: number;
  title: string;
  state: string;
  isDraft: boolean;
  headRefName: string;
  url: string;
  updatedAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  author: {
    login: string;
    name?: string;
  } | null;
}


export interface DeployData {
  stacks: StackInfo[];
  history: Map<string, StackHistory>;
  ghRuns: GHRun[];
  pullRequests: PullRequestInfo[];
  loading: boolean;
  lastRefresh: Date | null;
  error: string | null;
  warnings: string[];
  fromCache: boolean;
}

export type TabName = "stacks" | "deploys" | "activity" | "availability";
export type SortMode = "attention" | "recent" | "name";

export interface StackHistoryEntry extends StackHistory {
  stackName: string;
}
