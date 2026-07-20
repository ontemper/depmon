import { useState } from "react";
import { useKeyboard, useRenderer } from "@opentui/react";
import { C } from "../lib/colors.ts";
import { loadConfig, saveConfig, type DepmonConfig } from "../lib/config.ts";

const FIELDS = [
  { key: "pulumiDir" as const, label: "Pulumi project directory", placeholder: "/path/to/your/repo" },
  { key: "pulumiPkg" as const, label: "Pulumi --cwd subpath", placeholder: "packages/pulumi-infra  (or . for root)" },
  { key: "ghRepo" as const, label: "GitHub repo (org/name)", placeholder: "org/repo" },
];

export function SetupView({ onDone }: { onDone: () => void }) {
  const renderer = useRenderer();
  const current = loadConfig();
  const [values, setValues] = useState<Record<string, string>>({
    pulumiDir: current.pulumiDir === process.cwd() ? "" : current.pulumiDir,
    pulumiPkg: current.pulumiPkg === "." ? "" : current.pulumiPkg,
    ghRepo: current.ghRepo,
  });
  const [focusIdx, setFocusIdx] = useState(0);
  const [saved, setSaved] = useState(false);

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      renderer.destroy();
      return;
    }
    if (key.name === "escape") {
      onDone();
      return;
    }
    if (key.shift && key.name === "tab") {
      setFocusIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (key.name === "tab" || (key.name === "enter" || key.name === "return")) {
      if (focusIdx < FIELDS.length - 1) {
        setFocusIdx((i) => i + 1);
      } else {
        // Save
        const cfg: DepmonConfig = {
          pulumiDir: values.pulumiDir || process.cwd(),
          pulumiPkg: values.pulumiPkg || ".",
          ghRepo: values.ghRepo || "",
        };
        saveConfig(cfg);
        setSaved(true);
        setTimeout(() => onDone(), 600);
      }
      return;
    }
  });

  return (
    <box flexDirection="column" width="100%" height="100%" backgroundColor={C.bg} justifyContent="center" alignItems="center">
      <box flexDirection="column" width={60} border borderStyle="rounded" borderColor={C.borderActive} padding={2} gap={1}>
        <box justifyContent="center">
          <text fg={C.blue}><strong>depmon setup</strong></text>
        </box>
        <box>
          <text fg={C.fgDark}>Configure where depmon looks for Pulumi stacks and GitHub runs.</text>
        </box>
        <box>
          <text fg={C.fgDark}>Tab/Enter to move between fields. Esc to skip.</text>
        </box>

        {FIELDS.map((field, i) => (
          <box key={field.key} flexDirection="column" marginTop={1}>
            <text fg={focusIdx === i ? C.blue : C.fgDark}>
              {focusIdx === i ? "▸ " : "  "}{field.label}
            </text>
            <box paddingLeft={2}>
              <input
                value={values[field.key] || ""}
                onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
                focused={focusIdx === i}
                width={50}
                backgroundColor={focusIdx === i ? C.bgHighlight : C.bgDark}
                textColor={C.fg}
                cursorColor={C.blue}
                placeholder={field.placeholder}
              />
            </box>
          </box>
        ))}

        {saved && (
          <box marginTop={1} justifyContent="center">
            <text fg={C.green}><strong>Saved to ~/.config/depmon/config.json</strong></text>
          </box>
        )}
      </box>

      <box marginTop={1}>
        <text fg={C.fgDark}>
          <span fg={C.fgMuted}>tab/enter</span> next field{"  "}
          <span fg={C.fgMuted}>shift+tab</span> prev{"  "}
          <span fg={C.fgMuted}>esc</span> skip
        </text>
      </box>
    </box>
  );
}
