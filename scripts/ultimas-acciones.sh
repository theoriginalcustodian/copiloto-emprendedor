#!/usr/bin/env bash
# Qué está haciendo AHORA cada sesión, leído del log crudo. Sin heurísticas: acciones con hora.
# Regla aprendida 2026-07-24: el log responde en una lectura lo que el sensor erró 6 veces.
P=~/.claude/projects/c--Proyectos-Claude-Claude-code-copiloto-emprendedor
N="${1:-4}"
for f in "$P"/*.jsonl; do
  m=$(( ( $(date +%s) - $(stat -c %Y "$f") ) / 60 ))
  [ "$m" -lt 30 ] || continue
  t=$(tail -c 400000 "$f")
  rol=$(printf '%s' "$t" | grep -o 'sesión \(BACKEND\|FRONTEND\|PLANIFICACIÓN\)' | sort | uniq -c | sort -rn | head -1 | sed 's/.*sesión //')
  echo "── ${rol:-SIN-CRON} · $(basename "$f" | cut -c1-8) · ${m}min"
  printf '%s' "$t" | python -c "
import sys, json
acc=[]
for l in sys.stdin:
    if '\"tool_use\"' not in l: continue
    try: d=json.loads(l)
    except Exception: continue
    c=(d.get('message') or {}).get('content')
    if not isinstance(c,list): continue
    for b in c:
        if b.get('type')=='tool_use':
            i=b.get('input') or {}
            acc.append((d.get('timestamp','')[11:16], b.get('name'), str(i.get('command') or i.get('file_path') or i.get('pattern') or '')[:58]))
for x in acc[-$N:]: print('   ', *x)
" 2>/dev/null
done
echo "── UTC ahora: $(date -u '+%H:%M')  (local $(date '+%H:%M'))"
