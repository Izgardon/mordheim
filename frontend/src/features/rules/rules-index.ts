import { rulesTabs, type RulesTabId } from "./data/rules-content";

/** One block of the rulebook: a section's opening, or one of its headed parts (each `h2`). */
export type RuleEntry = {
  /** Stable within the book: `<section>-<heading>` ("shooting-cover"). */
  id: string;
  sectionId: RulesTabId;
  section: string;
  title: string;
  html: string;
  /** The block's words, for searching inside the rules. */
  text: string;
};

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const words = (text: string) => text.replace(/\s+/g, " ").trim();
const sentenceCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

let built: RuleEntry[] | null = null;

/**
 * The bundled rulebook (`features/rules/data`) cut into blocks at each `h2`: what the Rules page
 * lists and Search everything searches. Built once, on first use.
 */
export function ruleEntries(): RuleEntry[] {
  if (built) return built;
  const parser = new DOMParser();
  const entries: RuleEntry[] = [];
  for (const tab of rulesTabs) {
    const doc = parser.parseFromString(tab.content, "text/html");
    const blocks: { title: string; nodes: Element[] }[] = [{ title: tab.label, nodes: [] }];
    for (const child of Array.from(doc.body.children)) {
      if (child.tagName === "H2") {
        blocks.push({ title: sentenceCase(words(child.textContent ?? "")), nodes: [] });
        continue;
      }
      blocks[blocks.length - 1].nodes.push(child);
    }
    const seen = new Map<string, number>();
    for (const block of blocks) {
      if (!block.nodes.length) continue;
      const base = `${tab.id}-${slug(block.title) || "intro"}`;
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      entries.push({
        id: count ? `${base}-${count + 1}` : base,
        sectionId: tab.id,
        section: tab.label,
        title: block.title,
        html: block.nodes.map((node) => node.outerHTML).join(""),
        text: words(block.nodes.map((node) => node.textContent ?? "").join(" ")),
      });
    }
  }
  built = entries;
  return entries;
}

/** Whether an entry's title or text holds the words searched for (case aside). */
export function ruleMatches(entry: RuleEntry, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return entry.title.toLowerCase().includes(needle) || entry.text.toLowerCase().includes(needle);
}

/**
 * The words around the first match in a block's text, for a row under its title: the text before
 * (trimmed to a word), the match as written, and after.
 */
export function ruleSnippet(text: string, query: string, radius = 70) {
  const needle = query.trim().toLowerCase();
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (at < 0) return null;
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + needle.length + radius);
  const before = text.slice(start, at).replace(/^\S*\s/, start > 0 ? "" : "$&");
  const after = text
    .slice(at + needle.length, end)
    .replace(/\s\S*$/, end < text.length ? "" : "$&");
  return {
    before: `${start > 0 ? "…" : ""}${before}`,
    match: text.slice(at, at + needle.length),
    after: `${after}${end < text.length ? "…" : ""}`,
  };
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A block's HTML with every match of the search wrapped in `<mark>`, tags left alone. */
export function highlightRuleHtml(html: string, query: string) {
  const needle = query.trim();
  if (!needle) return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return html;
  const pattern = new RegExp(escapeRegExp(needle), "gi");
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  for (const node of texts) {
    const value = node.nodeValue ?? "";
    if (!pattern.test(value)) continue;
    pattern.lastIndex = 0;
    const fragment = doc.createDocumentFragment();
    let last = 0;
    for (const match of value.matchAll(pattern)) {
      const index = match.index ?? 0;
      fragment.append(value.slice(last, index));
      const mark = doc.createElement("mark");
      mark.textContent = match[0];
      fragment.append(mark);
      last = index + match[0].length;
    }
    fragment.append(value.slice(last));
    node.replaceWith(fragment);
  }
  return root.innerHTML;
}
