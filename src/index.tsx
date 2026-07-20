#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./app.tsx";

// Handle CLI subcommands before starting TUI
const cmd = process.argv[2];
if (cmd === "update") {
  console.log("Updating depmon from github.com/ontemper/depmon...");
  const install = Bun.spawnSync(
    ["bun", "add", "--global", "github:ontemper/depmon"],
    { stdout: "inherit", stderr: "inherit" },
  );
  process.exit(install.exitCode);
}

const renderer = await createCliRenderer({ exitOnCtrlC: false });
createRoot(renderer).render(<App />);
