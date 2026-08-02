# 🚧🔁 El guard se vuelve el CUELLO DE BOTELLA de lo que protege

**Fecha:** 2026-08-02 · **Dónde:** ciclo de autosanación (`autosanacion_gates.py` + `_workflow.py`)

## El caso, medido en producción

El **canario** de salud es un trauma inyectado a propósito para probar que el cable de detección
funciona. El gate lo rechaza (bien: no hay que repararlo). Pero el rechazo lo devolvía a `pendiente`,
y el ciclo toma **UN** trauma por corrida ordenado por `dedupe_count DESC`.

Resultado: las corridas de las 02, 04, 06 y 08 del 2026-08-02 salieron **todas**
`rechazado_por_gate` con el mismo `trauma_id: 14`. Y como cada prueba de vida comparte fingerprint,
su `dedupe_count` **crece en cada disparo**: en pocos días sería el más alto de la DLQ y se llevaría
el 100 % de las corridas.

**El vigilante terminaba impidiendo trabajar al sistema que vigila.**

## Por qué no da síntoma

El síntoma sería *"el autohealing no repara nada"* — **indistinguible de "no hay nada que
reparar"**, que es el estado sano y esperado. El monitoreo daba verde: el ciclo corría, el canario
probaba vida, no había errores. Todo cierto, y el sistema estaba tapado.

## No fue una vez: es un patrón

El mismo día apareció **dos veces** en el mismo componente:

1. **El canario** — el que prueba que el sistema anda, monopoliza el sistema.
2. **Los dominios prohibidos** (AFIP/MP) — la lista que protege de reparar lo irreversible devolvía
   esos traumas a la cola para siempre, porque su rechazo tampoco era permanente. Ya había pasado:
   lo dejó anotado un comentario en `e2e_autosanacion_trauma_real.py:280`.

Un tercer caso vive en la misma familia: un guard que **grita en el caso normal** enseña a saltearlo
([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]). Ahí el costo es la credibilidad; acá, el
throughput. Misma raíz: **el guard consume el recurso escaso de lo que protege** — atención en un
caso, turnos de la cola en el otro.

## La regla

> Todo guard que **rechaza** tiene que declarar si su rechazo es **permanente** (propiedad del ítem
> mismo → se cierra) o **transitorio** (depende del entorno → vuelve a la cola). Sin esa distinción,
> el default "vuelve a la cola" convierte cada rechazo permanente en un ítem inmortal que compite
> para siempre por el recurso escaso.

La pregunta a hacerse al escribir un guard no es sólo *"¿rechaza lo que debe?"* sino
**"¿qué le pasa a lo rechazado, y cuántas veces va a volver?"**

Y el default correcto es el **contrario** al que parece: `reintentable=True` por defecto (se
reintenta de más, no se descarta de menos), con lo permanente declarado explícitamente. Descartar
por defecto perdería bugs reales.

## El cierre que faltaba

Descartar en silencio también estaba mal — de ahí salió el escalón que faltaba, avisar por issue de
GitHub, y el agujero que las dos correcciones abrieron entre sí:
[[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]].

Relacionadas: [[el-canario-el-control-positivo-de-lo-que-falla-callado]] ·
[[el-guard-falla-abierto-en-su-caso-de-activacion]] · [[el-guard-que-caza-a-su-propio-autor]]
