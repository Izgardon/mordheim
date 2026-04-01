export function parseSpreadsheetValues(clipboardText: string) {
  const pastedValues = clipboardText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\t|\n/)
    .map((value) => value.trim());

  while (pastedValues.length > 0 && pastedValues[pastedValues.length - 1] === "") {
    pastedValues.pop();
  }

  return pastedValues;
}
