// Fails when the JavaScript a first visit must download before anything renders (the entry
// chunk plus whatever index.html preloads) grows past its gzip budget. Run after `vite build`:
//   npm run size            # checks dist/
//   npm run size -- <dir>   # checks another build directory
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

// PERF-17. Raise only with a reason in the commit message; route code belongs in lazy chunks.
const ENTRY_JS_BUDGET_KIB = 125;

const distDir = resolve(process.argv[2] ?? "dist");
const html = readFileSync(join(distDir, "index.html"), "utf8");

const attribute = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]+)"`))?.[1];
const tags = html.match(/<(script|link)\b[^>]*>/g) ?? [];
const entryFiles = tags
  .filter((tag) => /type="module"/.test(tag) || /rel="modulepreload"/.test(tag))
  .map((tag) => attribute(tag, "src") ?? attribute(tag, "href"))
  .filter(Boolean);
const styleFiles = tags
  .filter((tag) => /rel="stylesheet"/.test(tag))
  .map((tag) => attribute(tag, "href"))
  .filter((href) => href && href.startsWith("/"));

if (entryFiles.length === 0) {
  console.error(`No entry script found in ${join(distDir, "index.html")}.`);
  process.exit(1);
}

const measure = (file) => {
  const contents = readFileSync(join(distDir, file.replace(/^\//, "")));
  return { file, raw: contents.length / 1024, gzip: gzipSync(contents).length / 1024 };
};
const format = (kb) => `${kb.toFixed(2).padStart(9)} KiB`;

const entry = entryFiles.map(measure);
const styles = styleFiles.map(measure);
for (const { file, raw, gzip } of [...entry, ...styles]) {
  console.log(`${file.padEnd(48)} ${format(raw)}  gzip ${format(gzip)}`);
}

const entryGzip = entry.reduce((sum, { gzip }) => sum + gzip, 0);
const verdict = entryGzip <= ENTRY_JS_BUDGET_KIB ? "within" : "OVER";
console.log(
  `\nEntry JS: ${entryGzip.toFixed(2)} KiB gzip, ${verdict} the ${ENTRY_JS_BUDGET_KIB} KiB budget.`
);
if (entryGzip > ENTRY_JS_BUDGET_KIB) {
  process.exit(1);
}
