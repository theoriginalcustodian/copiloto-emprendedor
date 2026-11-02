#!/usr/bin/env bash
# SM-L3 — control de ESTADO EN SERVIDOR de la anulación de facturas (corrible ANTES y DESPUÉS del botón).
#
# Pregunta que responde: ¿la factura N° <nro> quedó anulada, con la nota de crédito que la respalda?
# Lee el libro propio (`uc_factory.afip_comprobantes`) por SSH -> fusion -> psql, en una transacción
# READ ONLY: no escribe nada ni emite nada. Por nro reporta el original (estado) y las NC que apuntan a él
# (tipos 3/8/13/53 = NC) con su CAE. El vínculo se mide COMO ESTÁ en el libro (medido 2026-11-02): el ORIGINAL
# anulado guarda en `cbte_asoc_nro` el nro de su NC (`marcar_anulada`); las filas NC suelen tener `cbte_asoc_nro`
# vacío. Se aceptan los dos sentidos del puntero.
#
# Veredicto POR FACTURA (exit 0 sólo si TODAS cumplen; la pantalla NO cuenta):
#   ANULADA     original.estado='anulada' Y existe una NC con CAE apuntando a él.
#   SIN-ANULAR  el original existe, estado distinto de 'anulada', sin NC  (estado ANTES del botón).
#   INCONSISTENTE  NC con CAE pero el original no está marcado 'anulada' (o al revés): la NC existe ante
#                  ARCA y la base quedó atrás (`marcar_anulada` falló) — es hallazgo, no obstáculo.
#   DUPLICADA   más de una NC por el mismo original (el fisco acreditaría el doble).
#   NO-EXISTE   no hay fila con ese nro: sin evidencia, el script NO afirma nada (exit 2).
#
#   exit 3 = el control no pudo correr (conexión/SQL): distinto de "no existe".
# Uso:  bash deploy/copiloto/verificar-anulacion.sh [nro ...]        (default: 10 11)
#   UC_DEPLOY_HOST (default unreal-copilot) / UC_FUSION_HOST / UC_FUSION_DB_CONTAINER / UC_FUSION_DB_SUPERUSER / PGDATABASE como en provision-rol-consola.sh
#   Si hay varios tenants con ese nro, se listan todos: el operador reconoce el suyo por CUIT/fecha/total.
set -euo pipefail

HOST="${UC_DEPLOY_HOST:-unreal-copilot}"      # VPS de la app: desde ahí se alcanza fusion
FUSION="${UC_FUSION_HOST:-fusion}"
CONTAINER="${UC_FUSION_DB_CONTAINER:-supabase-db}"
SUPERUSER="${UC_FUSION_DB_SUPERUSER:-supabase_admin}"
DB="${PGDATABASE:-postgres}"
NROS=("$@"); [ ${#NROS[@]} -gt 0 ] || NROS=(10 11)
for n in "${NROS[@]}"; do case "$n" in ''|*[!0-9]*) echo "nro inválido: '$n'" >&2; exit 64;; esac; done
LISTA="$(IFS=,; echo "${NROS[*]}")"

SQL="BEGIN READ ONLY;
WITH orig AS (
  SELECT cliente_id, cuit, tipo_cbte, punto_venta, nro, estado, cae, total, fecha_emision, cbte_asoc_nro
    FROM uc_factory.afip_comprobantes
   WHERE nro IN ($LISTA) AND tipo_cbte NOT IN (3, 8, 13, 53)
), nc AS (
  SELECT o.cliente_id, o.cuit, o.punto_venta, o.nro AS nro_orig, n.nro AS nro_nc, n.cae AS cae_nc
    FROM orig o
    JOIN uc_factory.afip_comprobantes n
      ON n.cliente_id=o.cliente_id AND n.cuit=o.cuit AND n.punto_venta=o.punto_venta
     AND n.tipo_cbte IN (3, 8, 13, 53) AND (n.nro=o.cbte_asoc_nro OR n.cbte_asoc_nro=o.nro)
)
SELECT left(o.cliente_id::text, 8) AS tenant, o.cuit, o.punto_venta AS pv, o.nro, o.fecha_emision AS fecha,
       o.total, o.estado,
       (SELECT count(*) FROM nc WHERE nc.cliente_id=o.cliente_id AND nc.cuit=o.cuit
           AND nc.punto_venta=o.punto_venta AND nc.nro_orig=o.nro AND coalesce(nc.cae_nc,'')<>'') AS ncs_con_cae,
       (SELECT string_agg(nc.nro_nc::text, ',') FROM nc WHERE nc.cliente_id=o.cliente_id AND nc.cuit=o.cuit
           AND nc.punto_venta=o.punto_venta AND nc.nro_orig=o.nro) AS nros_nc
  FROM orig o ORDER BY o.nro, o.cuit;
COMMIT;"

CRUDO="$(printf '%s\n' "$SQL" | ssh -o BatchMode=yes "$HOST" ssh -o BatchMode=yes "$FUSION" \
  docker exec -i -u postgres $CONTAINER psql -U $SUPERUSER -d $DB -v ON_ERROR_STOP=1 -At -F @ -f -)" \
  || { echo "ERROR DE CONEXIÓN/SQL (ssh $HOST -> $FUSION): el control NO corrió — esto NO es 'no existe'." >&2; exit 3; }
SALIDA="$(printf '%s\n' "$CRUDO" | grep -E '^[0-9a-f]{8}@' || true)"

if [ -z "$SALIDA" ]; then
  echo "NO-EXISTE: ningún comprobante con nro en ($LISTA) — SIN EVIDENCIA, no se afirma nada." >&2
  exit 2
fi

RC=0; VISTOS=""
while IFS='@' read -r tenant cuit pv nro fecha total estado ncs nros_nc; do
  VISTOS="$VISTOS $nro"
  if   [ "${ncs:-0}" -gt 1 ];                          then V="DUPLICADA";     RC=1
  elif [ "$estado" = "anulada" ] && [ "$ncs" -eq 1 ];  then V="ANULADA"
  elif [ "$estado" != "anulada" ] && [ "$ncs" -eq 0 ]; then V="SIN-ANULAR";    RC=1
  else                                                      V="INCONSISTENTE"; RC=1; fi
  printf '%-13s N°%-4s tenant=%s cuit=%s pv=%s fecha=%s total=%s estado=%s NC(con CAE)=%s [%s]\n' \
    "$V" "$nro" "$tenant" "$cuit" "$pv" "$fecha" "$total" "$estado" "$ncs" "${nros_nc:--}"
done <<< "$SALIDA"
for n in "${NROS[@]}"; do case " $VISTOS " in *" $n "*) ;; *) echo "NO-EXISTE     N°$n sin fila — sin evidencia"; RC=2;; esac; done
exit $RC
