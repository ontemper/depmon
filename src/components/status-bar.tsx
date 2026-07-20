import { C } from "../lib/colors.ts";
import { loadConfig } from "../lib/config.ts";
import { useTerminalDimensions } from "@opentui/react";


export function StatusBar({ hint }: { hint?: string }) {
  const cfg = loadConfig();
  const { width } = useTerminalDimensions();
  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      width="100%"
      height={1}
      paddingX={2}
      backgroundColor={C.bgDark}
    >
      <text fg={C.fgDark}>
        {hint ?? (
          <>
            <span fg={C.cyan}>j/k</span> move{"  "}
            <span fg={C.cyan}>enter</span> inspect{"  "}
            <span fg={C.cyan}>/</span> find{"  "}
            <span fg={C.cyan}>s</span> order{"  "}
            <span fg={C.cyan}>r</span> sync
            {width >= 100 && (
              <>
                {"  "}<span fg={C.cyan}>p</span> pulumi{"  "}
                <span fg={C.cyan}>g</span> github{"  "}
                <span fg={C.cyan}>c</span> config{"  "}
                <span fg={C.cyan}>q</span> quit
              </>
            )}
          </>
        )}
      </text>
      <text fg={C.fgDark}>{width >= 112 ? cfg.ghRepo || "repository not configured" : ""}</text>
    </box>
  );
}
