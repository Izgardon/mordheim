import { Fragment } from "react";

const tableBlockRegex = /\[\[table\]\]([\s\S]*?)\[\[\/table\]\]/g;

export function renderBoldMarkdown(text: string, fallback = "-") {
  if (!text) {
    return fallback;
  }

  const blocks = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tableBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    blocks.push({ type: "table", content: match[1] ?? "" });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    blocks.push({ type: "text", content: text.slice(lastIndex) });
  }

  if (blocks.length === 0) {
    blocks.push({ type: "text", content: text });
  }

  return blocks.map((block, index) => {
    if (block.type === "table") {
      const table = parseTable(block.content);
      if (!table) {
        return (
          <Fragment key={`text-${index}`}>
            {renderTextBlock(block.content)}
          </Fragment>
        );
      }
      return (
        <div
          key={`table-${index}`}
          className="my-2 overflow-x-auto rounded-xl border border-border/60 bg-card/70"
        >
          <table className="min-w-full text-xs text-muted-foreground">
            <thead className="bg-background/80 text-[10px] uppercase tracking-[0.2em]">
              <tr>
                {table.header.map((cell, cellIndex) => (
                  <th key={cellIndex} className="px-2 py-2 text-left font-semibold">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border/60">
                {table.row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-2 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <Fragment key={`text-${index}`}>
        {renderTextBlock(block.content)}
      </Fragment>
    );
  });
}

function parseTable(content: string) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.startsWith("|") || line.includes("|"));

  if (lines.length < 2) {
    return null;
  }

  const headerLine = lines[0];
  const rowLine = lines[1] === "---" || lines[1].includes("---") ? lines[2] : lines[1];
  if (!rowLine) {
    return null;
  }

  const header = headerLine
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
  const row = rowLine
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);

  if (!header.length || !row.length) {
    return null;
  }

  return { header, row };
}

function renderTextBlock(text: string) {
  const cleaned = text.trim();
  if (!cleaned) {
    return null;
  }

  const lines = cleaned.split("\n");
  return lines.map((line, lineIndex) => (
    <Fragment key={lineIndex}>
      {renderBoldSegments(line)}
      {lineIndex < lines.length - 1 ? <br /> : null}
    </Fragment>
  ));
}

function renderBoldSegments(line: string) {
  const parts = line.split("**");
  return parts.map((part, index) =>
    index % 2 === 1 ? <strong key={index}>{part}</strong> : <Fragment key={index}>{part}</Fragment>
  );
}
