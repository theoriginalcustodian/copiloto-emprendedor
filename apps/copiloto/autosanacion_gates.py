"""Los gates de la autosanación — qué se puede reparar, cuánto, y cómo se apaga. Fase 3.

Ninguno de estos gates es una precaución razonable: **los cuatro salen de algo medido**, y los dos
primeros salen de mediciones que contradijeron el diseño original.

## 1. La whitelist se deriva del ÍNDICE ÚNICO, no de una opinión de dominio (spike S3)

8 reinyecciones simultáneas de la misma operación, con la ventana real de 250 ms entre el chequeo y
la escritura:

```
if-ya-existe CON la ventana abierta → 1 fila
['UniqueViolation' ×7, 'insertó' ×1]
```

**Los 8 hilos atravesaron el `if`.** Quedó una sola fila **gracias al índice**, no gracias al `if`.
Los 7 `UniqueViolation` *son* la prueba de que la ventana existe — el primer veredicto del spike fue
"la ventana no se expuso" mirando el conteo de filas, y era falso.

Por eso una operación es reinyectable **si y sólo si existe un índice único que la proteja de la
carrera**. Preguntárselo a la base y no a un catálogo escrito a mano no es prolijidad: un catálogo
envejece en silencio, un índice se puede consultar.

## 2. El dominio fiscal es `DIAGNOSTIC_ONLY` — por medición, no por precaución

`existe_comprobante` consulta a **AFIP**, no a la base. No hay índice que pueda cerrar esa ventana, y
por eso el guard no se deriva de la regla de arriba: la regla **misma** deja al fiscal afuera. Un
reintento ahí es una segunda factura con **CAE real ante el fisco** — no es un error recuperable.
Precedente propio: [[idempotencia-con-un-if-tiene-ventana]] (facturar 2× → 2 CAE).

## 3. Tope diario y 4. kill switch

Los dos que ARCA **no** tenía. El tope acota el daño de un ciclo que se vuelve loco; el kill switch lo
apaga sin desplegar. Ambos parametrizados: un número fijo en el código se descubre tarde y se cambia
por deploy, que es exactamente lo que no querés estar haciendo cuando el ciclo está fallando.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

SCHEMA = "uc_factory"

#: Apagado total, sin desplegar. Cualquier valor distinto de "1"/"true"/"yes" deja el ciclo encendido.
ENV_KILL_SWITCH = "COPILOTO_AUTOSANACION_OFF"
#: Reparaciones propuestas por día. Acota el daño de un ciclo que se vuelve loco.
ENV_TOPE_DIARIO = "COPILOTO_AUTOSANACION_TOPE_DIARIO"
TOPE_DIARIO_DEFAULT = 5

#: Rutas cuyo error NUNCA se auto-repara. No es una lista de "áreas sensibles": es la lista de
#: dominios donde el efecto de un reintento es IRREVERSIBLE Y EXTERNO — el fisco emite el CAE, el
#: RPA consume el secreto one-shot, MercadoPago rota el token y el anterior muere.
DOMINIOS_PROHIBIDOS = (
    "afip_factura_activities",
    "afip_gateway",
    "afip_anulacion_workflow",
    "afip_onboarding_activities",   # crear_certificado: RPA + secreto one-shot
    "afip_comprobante_store",
    "mp_credential_store",          # refresh_credential: MP rota el token
)


@dataclass(frozen=True)
class Decision:
    permitido: bool
    motivo: str


def apagado() -> bool:
    """El kill switch. Se lee en **cada** decisión, no al arrancar: apagarlo tiene que surtir efecto
    sin reiniciar el worker — si hiciera falta un reinicio, no sería un kill switch."""
    return os.environ.get(ENV_KILL_SWITCH, "").strip().lower() in ("1", "true", "yes")


def tope_diario() -> int:
    """Tope de reparaciones/día, parametrizado. Un valor inválido **no** puede desactivar el tope:
    se degrada al default en vez de lanzar o de quedar en infinito."""
    try:
        valor = int(os.environ.get(ENV_TOPE_DIARIO, TOPE_DIARIO_DEFAULT))
        return valor if valor > 0 else TOPE_DIARIO_DEFAULT
    except (TypeError, ValueError):
        # Degradar acá es lo seguro (caso (c) del censo de `except`): un env mal tipeado no puede
        # traducirse en "sin tope". Lanzar tampoco sirve — apagaría el ciclo por un error de config.
        return TOPE_DIARIO_DEFAULT


def dominio_prohibido(ruta: str) -> str | None:
    """Devuelve el dominio prohibido que toca `ruta`, o `None`. Coincide por substring a propósito:
    un path, un módulo o un nombre de activity tienen que caer igual, y equivocarse hacia el rechazo
    es gratis mientras que equivocarse hacia el permiso emite una factura."""
    ruta_baja = (ruta or "").lower()
    for dominio in DOMINIOS_PROHIBIDOS:
        if dominio in ruta_baja:
            return dominio
    return None


def tiene_indice_unico(conn, tabla: str, columnas: tuple[str, ...]) -> bool:  # noqa: ANN001
    """¿Hay un índice ÚNICO en `tabla` que cubra exactamente `columnas`?

    Se le pregunta **a la base**, no a un catálogo escrito a mano: un catálogo envejece en silencio
    —alguien borra el índice y el catálogo sigue diciendo que existe— y un índice se puede consultar.
    Incluye los índices **parciales** (`WHERE ...`), que es la forma que usan los de este repo.
    """
    with conn.cursor() as cur:
        cur.execute(
            """SELECT array_agg(a.attname ORDER BY a.attname)
                 FROM pg_index i
                 JOIN pg_class c   ON c.oid = i.indrelid
                 JOIN pg_namespace n ON n.oid = c.relnamespace
                 JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
                WHERE n.nspname = %s AND c.relname = %s AND i.indisunique
                GROUP BY i.indexrelid""",
            (SCHEMA, tabla))
        for (cols,) in cur.fetchall():
            if set(cols or []) == set(columnas):
                return True
    return False


def puede_reparar(*, ruta: str, reparaciones_hoy: int) -> Decision:
    """El gate de la reparación, en orden de costo: lo barato primero.

    El orden importa — preguntar por el kill switch cuesta una lectura de env, y consultar índices
    cuesta una query. Un ciclo apagado no debería pagar nada por descubrirlo.
    """
    if apagado():
        return Decision(False, f"kill switch activo ({ENV_KILL_SWITCH})")

    dominio = dominio_prohibido(ruta)
    if dominio:
        return Decision(False, f"dominio DIAGNOSTIC_ONLY: {dominio} — efecto irreversible y externo "
                               "(CAE ante AFIP, secreto one-shot, token rotado). Nunca se auto-repara")

    tope = tope_diario()
    if reparaciones_hoy >= tope:
        return Decision(False, f"tope diario alcanzado ({reparaciones_hoy}/{tope})")

    return Decision(True, "ok")
