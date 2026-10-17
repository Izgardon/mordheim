import { fireEvent, screen, within, type Matcher } from "@testing-library/react";

const normalise = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

/**
 * Matches the innermost element whose whole text content is `text`, for lines split across
 * several nodes, e.g. "Level 2 Thugs (3/5)".
 */
export const byTextContent =
  (text: string): Matcher =>
  (_content, element) => {
    if (!element || normalise(element.textContent) !== text) {
      return false;
    }
    return !Array.from(element.children).some((child) => normalise(child.textContent) === text);
  };

/**
 * Reads a unit's stats table as `{ M: "4", WS: "4", ..., AS: "5+" }`, pairing each column
 * header with the cell under it in the first body row.
 */
export const readStatsGrid = (table: HTMLElement) => {
  const headers = within(table)
    .getAllByRole("columnheader")
    .map((header) => normalise(header.textContent));
  const [, firstRow] = within(table).getAllByRole("row");
  const cells = within(firstRow)
    .getAllByRole("cell")
    .map((cell) => normalise(cell.textContent));
  return Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
};

/**
 * Lists the stat columns that have a checkbox in the row under the values (the level-up
 * dialog's advance picker, whose checkboxes have no labels: UX-04).
 */
export const readStatsWithCheckbox = (table: HTMLElement) => {
  const headers = within(table)
    .getAllByRole("columnheader")
    .map((header) => normalise(header.textContent));
  const rows = within(table).getAllByRole("row");
  const pickerRow = rows[rows.length - 1];
  return within(pickerRow)
    .getAllByRole("cell")
    .flatMap((cell, index) => (within(cell).queryByRole("checkbox") ? [headers[index]] : []));
};

/** The checkbox under a stat column of the level-up dialog's picker row. */
export const getStatCheckbox = (table: HTMLElement, stat: string) => {
  const headers = within(table)
    .getAllByRole("columnheader")
    .map((header) => normalise(header.textContent));
  const rows = within(table).getAllByRole("row");
  const cell = within(rows[rows.length - 1]).getAllByRole("cell")[headers.indexOf(stat)];
  return within(cell).getByRole("checkbox");
};

/**
 * Hovers every tooltip trigger beside `element` (e.g. the badges next to a unit's name) and
 * returns the tooltip texts, in order.
 */
export const hoverTooltipsBeside = async (element: HTMLElement) => {
  const container = element.parentElement ?? element;
  const triggers = Array.from(container.querySelectorAll<HTMLElement>("[aria-describedby]"));
  const texts: string[] = [];
  for (const trigger of triggers) {
    fireEvent.mouseEnter(trigger);
    texts.push(normalise((await screen.findByRole("tooltip")).textContent));
    fireEvent.mouseLeave(trigger);
  }
  return texts;
};
