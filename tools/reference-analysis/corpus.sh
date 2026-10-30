#!/bin/bash
# corpus.sh <name> <mixfile>: separate and transcribe all windows, keep sheet and report, drop audio.
n=$1; f=$2
.venv/bin/python -I scripts/batch.py $n > /tmp/w-$n.txt
ARGS=$(cat /tmp/w-$n.txt | tr '\n' ' ')
.venv/bin/python -I scripts/sep.py "$f" stems $ARGS 2>&1 | tail -1
mkdir -p corpus
ls -d stems/$n-s* | xargs -P 5 -I{} sh -c 'timeout 120 .venv/bin/python -I scripts/deep.py {} > {}/print.txt 2>&1'
for d in stems/$n-s*; do b=$(basename $d); [ -f $d/report.json ] && cp $d/report.json corpus/$b.json && cp $d/sheet.png corpus/$b.png; cp $d/print.txt corpus/$b.txt; done
echo done $n
