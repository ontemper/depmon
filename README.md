# depmon

Attention-first terminal deployment cockpit for Pulumi stacks and GitHub Actions runs.

Built with [OpenTUI](https://github.com/anomalyco/opentui).

## Requirements

- [Bun](https://bun.sh)
- [Pulumi CLI](https://www.pulumi.com/docs/install/) authenticated to the backend that owns your stacks
- [GitHub CLI](https://cli.github.com/) authenticated to the repository that runs your Pulumi workflows

```bash
pulumi whoami
gh auth status
```

## Install

Install the latest version directly from GitHub:

```bash
bun add --global github:ontemper/depmon
depmon
```

If `depmon` is not found after installation, add Bun's global binary directory to your shell path:

```bash
export PATH="$HOME/.bun/bin:$PATH"
```

## Configure

For the quickest setup, launch depmon from the Git repository that contains your Pulumi project:

```bash
cd /path/to/your/repository
depmon
```

On first launch, the setup screen pre-fills what it can detect. Use `tab` and `shift+tab` to move between fields, then press `enter` to save. Press `c` from the cockpit whenever you need to edit the configuration.

- **Pulumi project directory** is the repository or workspace root used as the command working directory.
- **Pulumi `--cwd` subpath** is the directory containing `Pulumi.yaml`, relative to the project directory. Use `.` when `Pulumi.yaml` is at the root.
- **GitHub repository** is the `owner/repo` queried for workflow runs. Depmon displays workflows whose names contain `Pulumi`.

The saved configuration lives at `~/.config/depmon/config.json`:

```json
{
  "pulumiDir": "/path/to/your/repository",
  "pulumiPkg": "packages/pulumi-infra",
  "ghRepo": "your-org/your-repo"
}
```

For a standalone Pulumi project, use `"pulumiPkg": "."`.

You can also configure depmon without a file, which is useful for one-off runs and CI-like shells:

```bash
DEPMON_PULUMI_DIR=/path/to/repository \
DEPMON_PULUMI_PKG=packages/pulumi-infra \
DEPMON_GH_REPO=your-org/your-repo \
depmon
```

Configuration resolves in this order:

1. `DEPMON_PULUMI_DIR`, `DEPMON_PULUMI_PKG`, and `DEPMON_GH_REPO`
2. `~/.config/depmon/config.json`
3. Auto-detection from the current directory

Auto-detection walks up to find `Pulumi.yaml`, defaults the Pulumi subpath to `.`, and asks `gh repo view` for the current repository.

## Usage

```bash
depmon
```
Depmon opens on the **Free** view so you can immediately see which non-core stack is safe to deploy to. Press `1` for the fleet health view.

### Keybindings

| Key | Action |
|-----|--------|
| `j/k` or arrows | Move through the current queue |
| `tab`, arrows, or `1/2/3/4` | Switch view (Fleet / Runs / Timeline / Free) |
| `enter` | Open stack history, inspect an update, or open the selected GitHub run/PR |
| `/` | Filter stacks by name, branch, author, message, or workflow title |
| `s` | Cycle fleet order (attention / recent / name) |
| `p` | Open the selected stack or update in Pulumi Cloud |
| `g` | Open the linked GitHub Actions run or pull request |
| `r` | Refresh the current data and history |
| `c` | Edit configuration |
| `esc` | Close the inspector, go back, or clear the filter |
| `q` | Quit |

### Tabs

- **Fleet** — combined Pulumi and GitHub health, ordered by failures and active deploys first. Wide terminals get a persistent inspector; compact terminals get an inline summary.
- **Runs** — attention-sorted GitHub Actions runs with branch, trigger, change, and direct GitHub access.
- **Timeline** — a two-line flight recorder showing the latest deployment, resource delta, branch, author, and change for every stack.
- **Free** — answers where to deploy next by correlating each non-core stack's deployed branch with GitHub pull requests. Never-used stacks and stacks whose PR is closed or merged are **Free**; active deployments are **Deploying**; recently updated open PRs are **In use**; open PRs untouched for seven days are **Stale**; unmatched branches require a **Check**.

Select a stack to open its 20-update history. The update inspector shows metadata and resource changes; failed updates include the tail of the failed GitHub Actions step logs when a run is linked.

### Caching

State is cached at `~/.cache/depmon/state.json`. Cached data displays immediately while fresh data loads in the background. Depmon refreshes every 60 seconds, limits concurrent Pulumi history commands, preserves usable cached data when GitHub is unavailable, and surfaces degraded sources instead of silently showing an empty fleet.

## Development

```bash
bun install
bun run typecheck
bun test
```
