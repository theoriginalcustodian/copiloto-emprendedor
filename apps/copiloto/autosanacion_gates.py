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


#: Las ÚNICAS categorías que se auto-reparan con un parche de código. Es el gate que más recorta la
#: superficie del ciclo, y sale de una observación del operador (2026-07-31): en producción los
#: fallos no van a ser features rotas sino operación —un campo vacío, un dato raro, un 503—, así que
#: la pregunta no es "¿puedo repararlo?" sino "¿hay algo de código que reparar?".
#:
#: - `infra_error` **NO**: un timeout o un 503 de Composio no tienen bug. Ya se reintentan solos
#:   (ítem 2.5); mandarlos al forjador es pagar dos llamadas al LLM y una suite entera para que el
#:   modelo "arregle" código que está bien — y un parche sobre código sano es una regresión con
#:   forma de reparación.
#: - `manual_intervention` **NO**: permisos y credenciales necesitan una persona, por definición.
#: - `cascading` **NO**: el bug está en el padre; parchear al hijo tapa el síntoma.
#: - `SIN_CATEGORIA` **NO** (no está acá y no debe estarlo): es un tipo que nadie clasificó todavía.
#:   `taxonomia_errores` se niega a asumir una categoría por descarte justamente para forzar esa
#:   decisión; auto-reparar lo no clasificado sería tomarla a ciegas y en el peor momento.
CATEGORIAS_REPARABLES = ("business_error",)

#: Marca del canario de salud (`canario_autosanacion.MARCA`). Se copia el literal en vez de importar
#: el módulo para no atar los gates —que corren dentro del workflow— a una dependencia que sólo existe
#: por el endpoint. El test de contrato verifica que los dos valores no se separen.
MARCA_CANARIO = "canario"


@dataclass(frozen=True)
class Decision:
    """El veredicto del gate, y —si es negativo— si tiene sentido volver a intentarlo.

    ``reintentable`` separa dos rechazos que hasta el 2026-08-02 se trataban igual y no lo son:

    - **transitorio** (kill switch, tope diario): la respuesta depende del ENTORNO y va a cambiar.
      El trauma se **suelta** a `pendiente` y mañana se repara. Cerrarlo sería perder un bug real.
    - **permanente** (el canario): la respuesta es una propiedad del trauma MISMO y no va a cambiar
      nunca. Soltarlo lo deja circulando para siempre.

    Por qué importa, medido en prod: el ciclo toma **UN** trauma por corrida
    (``tomar_un_bug_distinto``), ordenado por ``dedupe_count DESC``. El canario rechazado volvía a
    `pendiente` y era re-tomado en CADA corrida — las de las 02, 04, 06 y 08 del 2026-08-02 salieron
    todas `rechazado_por_gate` con el mismo `trauma_id: 14`. Y como cada prueba de vida comparte
    fingerprint, su ``dedupe_count`` crece: a los pocos disparos sería el más alto de la DLQ y se
    llevaría **todas** las corridas. El vigilante terminaría impidiendo trabajar al sistema que
    vigila — y el síntoma sería "el autohealing no repara nada", indistinguible de "no hay nada
    que reparar" ([[el-canario-el-control-positivo-de-lo-que-falla-callado]]).

    El default es ``True`` a propósito: un rechazo cuya permanencia nadie declaró se trata como
    transitorio, que es el lado seguro — se reintenta de más, no se descarta de menos.
    """

    permitido: bool
    motivo: str
    reintentable: bool = True


def apagado() -> bool:
    """El kill switch. Se lee en **cada** decisión, nunca cacheado al importar.

    ⚠️ **Lo que esto NO da, y antes este docstring prometía** (medido en el VPS el 2026-07-31): que
    leer `os.environ` en cada decisión permita apagar el ciclo *sin reiniciar el worker*. No: el
    worker corre bajo systemd con `EnvironmentFile=`, y systemd fija el entorno del proceso **al
    arrancar**. Editar `/etc/unreal-copilot/copiloto.env` no cambia el `environ` de un proceso vivo —
    se verificó leyendo `/proc/<pid>/environ`. Para que esta variable surta efecto hace falta
    `systemctl restart uc-copiloto-worker`.

    Leerla en cada decisión sigue valiendo (un reinicio basta, no hace falta redesplegar), pero
    llamarlo "sin reiniciar" era una promesa que el despliegue real no cumple — y un apagado de
    emergencia que se cree instantáneo y no lo es, es peor que uno que se sabe lento.

    **El apagado INMEDIATO es pausar los Schedules**, que no toca el proceso:

        python deploy/worker/verificar_autosanacion.py --pausar-todo

    Sin Schedule que dispare no hay ejecución, y surte efecto en el momento.
    """
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


def puede_reparar(*, ruta: str, reparaciones_hoy: int, categoria: str | None = None) -> Decision:
    """El gate de la reparación, en orden de costo: lo barato primero.

    El orden importa — preguntar por el kill switch cuesta una lectura de env, y consultar índices
    cuesta una query. Un ciclo apagado no debería pagar nada por descubrirlo.
    """
    if apagado():
        return Decision(False, f"kill switch activo ({ENV_KILL_SWITCH})")

    # El canario ANTES que los dominios: su error es deliberado, así que no hay nada que reparar y
    # preguntarse por el resto es trabajo perdido. Sin esta salida el forjador le escribiría un parche
    # a un `raise` puesto a propósito y abriría un PR basura en cada prueba de vida — y un guard que
    # ensucia en el caso normal se termina desarmando. Se excluye de REPARAR, no de REGISTRARSE: la
    # fila en la DLQ es justamente la evidencia que el canario viene a producir.
    if MARCA_CANARIO in (ruta or "").lower():
        # `reintentable=False`: el trauma se CIERRA, no se suelta. Su error es deliberado, así que
        # la respuesta de este gate no va a cambiar nunca — dejarlo en `pendiente` lo hacía volver
        # en cada corrida y, peor, escalar en el orden `dedupe_count DESC` hasta quedarse con todas.
        # Ver el docstring de Decision: el vigilante bloqueando al sistema que vigila.
        return Decision(False, "canario de salud: el error es deliberado, no hay bug que reparar. "
                               "Su valor está en haber quedado registrado, no en repararse",
                        reintentable=False)

    dominio = dominio_prohibido(ruta)
    if dominio:
        return Decision(False, f"dominio DIAGNOSTIC_ONLY: {dominio} — efecto irreversible y externo "
                               "(CAE ante AFIP, secreto one-shot, token rotado). Nunca se auto-repara")

    # `categoria=None` NO se interpreta como "adelante": un trauma viejo o depositado por una costura
    # que no la registró tiene que caer del lado del no. El default permisivo sería el error clásico
    # de este gate — el caso normal de toda regla restrictiva es no-hacer.
    if categoria not in CATEGORIAS_REPARABLES:
        return Decision(False, f"categoría {categoria!r}: no hay código que reparar acá. Sólo se "
                               f"auto-reparan {CATEGORIAS_REPARABLES}")

    tope = tope_diario()
    if reparaciones_hoy >= tope:
        return Decision(False, f"tope diario alcanzado ({reparaciones_hoy}/{tope})")

    return Decision(True, "ok")
