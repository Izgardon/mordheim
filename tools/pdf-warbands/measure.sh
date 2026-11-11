#!/bin/sh
# Measure each PDF: pages, pages with a text layer (over 300 characters), pages without (scans), and total text.
# Usage: sh tools/pdf-warbands/measure.sh <pdfs dir> <out dir>   (fetch.sh runs it on .pdf-sources/pdfs)
# Writes <out>/measure.tsv and <out>/text/<file>.txt (pdftotext -layout, pages split by form feeds).
# Needs poppler-utils (the cloud setup script installs it).
PDFS=$1
OUT=$2
[ -d "$PDFS" ] && [ -n "$OUT" ] || { echo "usage: $0 <pdfs dir> <out dir>"; exit 2; }
mkdir -p "$OUT/text"
printf "file\tpages\ttext_pages\tscan_pages\tchars\n" >"$OUT/measure.tsv"
for f in "$PDFS"/*.pdf; do
  name=$(basename "$f" .pdf)
  pages=$(pdfinfo "$f" 2>/dev/null | awk '/^Pages:/ {print $2}')
  [ -z "$pages" ] && { printf "%s\tERR\t\t\t\n" "$name" >>"$OUT/measure.tsv"; continue; }
  pdftotext -layout "$f" "$OUT/text/$name.txt" 2>/dev/null
  # characters per page, split on form feed
  stats=$(awk 'BEGIN{RS="\f"} {gsub(/[ \t\r\n]/,""); n=length($0); if (n>300) t++; else s++; c+=n} END{printf "%d\t%d\t%d", t, s, c}' "$OUT/text/$name.txt")
  printf "%s\t%s\t%s\n" "$name" "$pages" "$stats" >>"$OUT/measure.tsv"
done
echo "measured $(($(wc -l <"$OUT/measure.tsv") - 1)) PDFs into $OUT/measure.tsv"
