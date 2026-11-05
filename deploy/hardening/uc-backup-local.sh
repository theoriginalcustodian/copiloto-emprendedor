#!/usr/bin/env bash
# deploy/hardening/uc-backup-local.sh — backup lógico diario de las DBs locales del VPS (SEC-C10-1).
# Cubre copiloto-auth-db-1 (GoTrue: usuarios) y temporal-postgres (historial durable). NO cubre secretos
# (.env) ni la DB fusion (otro host). Es la PRIMERA capa (corrupción lógica / borrado accidental): vive en
# el mismo disco, así que NO es DR; el off-site (Storage Box, fleet-platform/backup) es decisión del operador.
# Idempotente: un archivo por día y DB; retención RETENCION_DIAS. Falla ruidoso si un dump sale vacío.
set -euo pipefail
DEST="${UC_BACKUP_DIR:-/var/backups/uc}"
RETENCION_DIAS="${UC_BACKUP_RETENCION_DIAS:-7}"
DBS="${UC_BACKUP_DBS:-copiloto-auth-db-1:postgres:postgres temporal-postgres:temporal:temporal}"
umask 077; mkdir -p "$DEST"; chmod 700 "$DEST"
dia="$(date -u +%F)"; rc=0
for item in $DBS; do
  IFS=: read -r ctr usr db <<<"$item"
  out="$DEST/${ctr}-${dia}.dump"; tmp="$out.tmp"
  if docker exec "$ctr" pg_dump -U "$usr" -d "$db" -Fc > "$tmp" 2>"$tmp.err" && [ -s "$tmp" ]; then
    mv -f "$tmp" "$out"; rm -f "$tmp.err"; echo "OK $out $(stat -c %s "$out") bytes"
  else
    echo "FALLA backup de $ctr: $(head -c 300 "$tmp.err" 2>/dev/null)" >&2; rm -f "$tmp" "$tmp.err"; rc=1
  fi
done
find "$DEST" -name '*.dump' -mtime +"$RETENCION_DIAS" -delete
exit "$rc"
