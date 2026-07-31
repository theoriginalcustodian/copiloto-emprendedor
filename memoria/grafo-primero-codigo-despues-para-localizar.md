---
name: grafo-primero-codigo-despues-para-localizar
description: Hay un grafo de código del repo (MCP graphity-code) que devuelve file:line exactos — localizar con el grafo ahorra greps y tokens, pero probar SIEMPRE contra el archivo real
metadata:
  type: reference
---

Instrucción del operador, 2026-07-24: *"Podés consultar el grafo para información precisa y luego
verificar con código. **Es regla canónica para todas las sesiones** — nos ahorra mucho trabajo de
grepeado y de tokens. Es fundamental."*

Existe un **grafo de código del repo** (archivos, funciones, clases, `CALLS`/`DEFINES`/`IMPORTS`),
extraído **sin LLM** por `graphify`, servido por MCP `graphity-code`, **actualizado incremental en cada
`git push`**. Manual: `docs/copiloto-emprendedor/2026-07-23-HANDOFF-consultar-el-grafo-de-codigo.md`.
Canonizado en COORDINACION §4.2.octies.

## La regla, en dos tiempos — los dos obligatorios

1. **LOCALIZAR con el grafo.** Antes de barrer con greps, preguntale dónde vive lo que buscás → devuelve
   `source_file` + `source_location`.
2. **PROBAR con el archivo.** El grafo dice *dónde mirar*, **no** *qué es verdad hoy*. Andá al `file:line`
   y leelo. **Nunca cites el grafo como evidencia final** — citá el código.

```
ToolSearch "select:mcp__graphity-code__graphity_search,mcp__graphity-code__graphity_traverse_node"
graphity_search(query="...", group_id="code-copiloto-emprendedor", scope="nodes",
                node_labels=["Function","Class"])
```

## Los tres filos sin los cuales miente

- 🔑 **`group_id="code-copiloto-emprendedor"` SIEMPRE.** El tenant aloja **4 repos**; sin scopear
  mezclás repos y tomás un símbolo ajeno por propio.
- 📁 **Los paths omiten el prefijo `apps/`**: `copiloto/afip_web.py` en el grafo = `apps/copiloto/afip_web.py`
  en disco. No es un nodo roto.
- ⚠️ **Puede haber nodos stale** (el reconcile quedó en pausa por un guard) → la **presencia de un nodo
  NO prueba que el símbolo exista hoy**. Por eso el paso 2 no es opcional.

**Alcance — un vacío acá NO es hallazgo.** Cubre `apps/*`, `packages/core`, `motor`, `scripts`, `spikes`,
`deploy` (declarado en `source_dirs`, `graphify-graphity-bridge/config/repos.toml:153`). **NO cubre**
`docs/`, `coordinacion/`, `memoria/`, `_evidencia/`, `code/`. Si buscás algo de ahí y no aparece, está
**fuera de alcance, no roto** ([[vacio-no-es-hallazgo-correr-el-control]]).

### 🚫 Y eso es POR DISEÑO — no proponer meter documentos al grafo

Decisión del operador, 2026-07-24, textual: *«no vamos a meter documentos en el código… para leer
documentos lo hacemos local, con contexto local. **El grafo debe ser una copia fiel del código**. Esa es
la mayor ventaja para lograr eficiencia en el contexto completo de la app: es un cerebro mapeado del
repositorio que devuelve información en menos de 50 ms.»*

**El porqué, que es lo que hay que entender para no re-proponerlo:** el valor del grafo es ser un
**índice isomorfo** — una pregunta por semántica devuelve `file:line` verificable en milisegundos, y
cada nodo tiene un referente único y comprobable en disco. Mezclarle prosa rompe las dos propiedades a
la vez: infla el índice con nodos que **no se pueden probar contra un archivo** (paso 2 de la regla de
arriba deja de existir para ellos) y hace que una búsqueda de código traiga documentos que *hablan* del
símbolo en vez del símbolo. Se degrada justo lo que lo hace valioso. Los documentos se leen **local**,
donde ya tenés el contexto y el archivo entero.

Que el bridge **sepa** parsear markdown (`typing_rules/resolver.py:6` tipa un nodo por header) no es un
argumento a favor: es para los `.md` que viven **dentro** de carpetas de código (ej. `scripts/wave-a-output/`).
Capacidad ≠ mandato.

Corolario práctico: si te falta contexto de una decisión, **no** es el grafo el que tiene que ampliarse
— es `memoria/` + `docs/` los que se leen local. Y si una sesión propone ingestar prosa "para que el
agente sepa más", esto ya se decidió: la respuesta es no.

## 🕐 El cuarto filo — el grafo conoce lo PUSHEADO, y nada más

Leído del mecanismo real (`.githooks/pre-push`), 2026-07-24 — la doc decía *"puede ir unos minutos
atrás"* y **se queda corta**: no es un retraso de minutos, es un **horizonte**.

- **Disparador: `git push`** (incremental `--since <sha remoto>`), **fail-closed** — si el sync falla el
  push aborta, así que *push exitoso ⇒ grafo sincronizado*.
- **NO está:** lo commiteado sin pushear · lo pusheado con **`git push --no-verify`** (bypass
  **silencioso**, sin detector de drift posterior).
- **Está:** el estado de la **última rama pusheada** — no necesariamente `main`.
- **Adelantar sin pushear:** `bash scripts/graph-sync.sh` (sync manual, sin push).

> ⚠️ **Corrección medida (2026-07-31) — «lo sin commitear NO está» es FALSO.** `graphify` parsea el
> **working tree en disco**; el git-ref sólo decide *qué archivos mirar* y de dónde sale el
> `valid_at`. Probado: `spikes/s5-parche-y-auditor/spike.py` **no existe en el `HEAD`** de este
> checkout y el grafo **sí lo tiene**. O sea: el grafo puede contener código que no está en ninguna
> rama, presentado como hecho establecido. Y `valid_at` es el commit date del `HEAD` que corrió el
> sync — con el checkout 111 commits atrás, **todos** los edges quedaron sellados `2026-07-27`.
> La frescura real es **la hora del último sync**, no la del último push: cruzá `mtime` en disco
> contra `created_at` del nodo. Detalle → [[el-grafo-ingesta-el-disco-pero-fecha-con-head]].

> **Código ESTABLECIDO → el grafo es el índice. Trabajo EN VUELO (últimas horas, otra sesión, lo tuyo
> sin pushear) → el grafo es CIEGO por diseño**; ahí va `git grep origin/<rama>` o leer el archivo.

Por eso una ausencia en el grafo **nunca** prueba inexistencia: además del control positivo, preguntate
*«¿esto ya se pusheó?»*. Y el caso peligroso es el **normal**, no el raro — preguntar por lo que otra
sesión está escribiendo **ahora mismo**. Un grafo desactualizado responde con la misma cara de certeza
que uno al día: [[supuesto-cuya-falla-parece-un-estado-legitimo]].

## Evidencia — el control se corrió ANTES de canonizar la regla

2026-07-24, cruzado contra código verificado a mano minutos antes: **4 de 4 exactos** —
`FacturaWorkflow` L66 · `.confirmar_factura` L312 · `_confirm_choices` L609 · `confirmarFactura` L882.
Y trajo **3 nodos que un barrido con grep NO había encontrado**: `workflow_id_de_factura`
(`presupuesto_store.py:67`, justo el mecanismo del handoff presupuesto→factura), `EstadoFacturar`, y el
test de idempotencia de anulación.

**Por qué rinde tanto:** un grep contesta *"¿dónde aparece este string?"*; el grafo contesta *"¿qué
existe que haga esto?"* — que es **exactamente la pregunta del `§0 Reutilización`**
([[reutilizacion-es-regla-el-inventario-va-antes-del-diseno]]). Buscar reuso con grep obliga a adivinar
el nombre; con el grafo se busca por semántica. Las dos reglas se potencian: **el grafo es la forma
barata de construir el inventario de reutilización.**
