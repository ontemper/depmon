import { C } from "../lib/colors.ts";

export function FilterBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <box flexDirection="row" width="100%" height={1} paddingX={2} backgroundColor={C.bgHighlight}>
      <text fg={C.yellow}>/</text>
      <input
        value={value}
        onChange={onChange}
        onInput={onChange}
        focused
        width={40}
        backgroundColor={C.bgHighlight}
        textColor={C.fg}
        cursorColor={C.blue}
        placeholder="filter stacks..."
      />
    </box>
  );
}
