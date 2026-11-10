#!/bin/sh
# OCR the named PDFs page by page, for the ones with no text layer.
# Usage: sh tools/pdf-warbands/ocr.sh <pdfs dir> <out dir> name1 name2 ...   (names without .pdf)
# Writes <out>/ocr/<name>.txt (pages separated by form feeds) from 300 dpi greyscale renders. Expect small slips,
# such as "Id" for "Ld". Needs poppler-utils and tesseract-ocr (the cloud setup script installs both).
PDFS=$1
OUT=$2
[ -d "$PDFS" ] && [ -n "$OUT" ] || { echo "usage: $0 <pdfs dir> <out dir> name ..."; exit 2; }
shift 2
mkdir -p "$OUT/ocr"
pages=$(mktemp -d)
trap 'rm -rf "$pages"' EXIT
for name in "$@"; do
  rm -f "$pages"/*
  pdftoppm -r 300 -gray -png "$PDFS/$name.pdf" "$pages/p"
  : >"$OUT/ocr/$name.txt"
  for img in "$pages"/p-*.png; do
    tesseract "$img" - --psm 4 2>/dev/null >>"$OUT/ocr/$name.txt"
    printf "\f" >>"$OUT/ocr/$name.txt"
  done
  echo "$name done"
done
