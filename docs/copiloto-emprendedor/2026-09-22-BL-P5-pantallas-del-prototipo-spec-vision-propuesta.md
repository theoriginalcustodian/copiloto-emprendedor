# BL-P5 · Qué pantalla del prototipo se construye y cuál no

**Fecha:** 2026-09-22 · **Medido sobre:** `main` @ `27e73a4d` · **Dueña:** PLANIFICACIÓN · **Cierra:** `BL-P5`
(backlog `2026-09-21-backlog-beta-odobi-con-dod.md`, §2).

**Para qué sirve.** Es la **única lista** que dice qué `?ver=` del prototipo cuenta para el cierre de la beta.
El criterio de cierre (backlog §13, punto 3) mide la matriz **sólo contra las pantallas marcadas `spec` acá**.
Sin esta lista, «48/48 coherentes» se medía contra pantallas que nadie va a construir: `plan` figuraba como una
fila más del mapa, aunque el propio prototipo la declara VISIÓN.

**Categorías:**
- **spec**: se construye en la beta, en web y en mobile.
- **visión**: se dibujó como futuro y **no** se construye (post-beta, `BL-V`).
- **propuesta**: Martín la propone y todavía no hay decisión.
- **fuera**: no es una pantalla de la app (estado técnico, alias derogado, pieza de marketing, boceto a corregir).
  No se mide.

## 1. Cómo se armó (para re-medirlo)

- **Barrido:** `grep -rhoE 'ver=[a-zA-Z0-9_-]+' 'Prototipo frontend/odobi-ui/' | sort -u` da **50 ids literales**.
  Hay **13 ids más** que el router reconoce sólo por código, sin ningún link literal: los ids de `HILOS[ver]` y los
  de `ver.startsWith('card')` (`prototipo/index.html:2874` `CARDS`, `:3199` `HILOS`, router `:3389-3717`).
  Más la home (`?ver=` vacío): **64**. Uno de ellos, `conta`, es un link muerto.
- **Mapas:** el vigente es `mapa-pantallas/index.html` (objeto `PANTALLAS`, `:169`), fuente de las «48 pantallas»
  del mapa del 16/09. `prototipo/mapa.html` (20 ids) y `arbol/arbol-web.html` (16) son mapas viejos.
  `arbol/index.html` no usa `?ver=`.
- **Decisiones que mandan:** acta `2026-09-21-acta-decisiones-beta-odobi.md` (DEC-1..DEC-13) y plan de
  implementación §2 (filas BL-X12m / BL-X12w, `:59-60`).
- El barrido lo hizo un sub-agente de sólo lectura. Planificación verificó contra el archivo las citas que cambian
  una clasificación (`index.html:1005`, `:3238`, `:3496-3498`; `mapa-pantallas/index.html:169-177`).

## 2. La lista

### spec — 54 ids (cuenta en §3)

| `?ver=` | Ítem que la cubre | | `?ver=` | Ítem que la cubre |
|---|---|---|---|---|
| *(vacío)* Mi día | — | | `fact-cae` | BL-C2 |
| `esc` | — | | `pres-voz` | — |
| `chat` | — | | `pres-hitl` | BL-D1 / BL-J1 |
| `splash` | BL-X10 | | `pres-ciclo` | BL-J9 |
| `entrada` | BL-X10 | | `vacio-visto` | BL-W5 |
| `reveal` | BL-X10 | | `vacio` | BL-W5 |
| `volver` | BL-X12m (mobile) · **web: BL-X10** (ver §4.1) | | `comousar` | BL-W9 |
| `ingresar` | BL-X12m / BL-X12w | | `soporte` | BL-W10 |
| `ingresar-error` | BL-X12m / BL-X12w | | `feedback` | BL-W3 / BL-J12 |
| `tablero` | BL-W7 / BL-J5 | | `hitl` | BL-D3 |
| `agenda` | BL-J13 | | `gastos` | BL-J7 |
| `detalle` | — | | `ingresos` | BL-J7 |
| `grabando` | BL-D2 | | `factura` | BL-C2 |
| `bloqueado` | BL-W1 | | `presu` | BL-J7 |
| `card` | BL-J7 | | `bi` | BL-X2 |
| `card-cobro` | BL-J7 | | `clientes` | BL-J6 / BL-J7 |
| `card-factura` | BL-J7 | | `ajustes` | BL-X1 |
| `card-presu` | BL-J7 | | `negocio` | BL-J10 / BL-X7 |
| `card-cliente` | BL-J7 | | `afip` | BL-C6 |
| `vozchat` | — | | `apps` | BL-C1 / BL-W2 / BL-C5 |
| `bi-vacio` | — | | `cuenta` | BL-J11 |
| `bi-refresh` | BL-W6 | | `apar` | BL-X4 |
| `onb-promesa` | BL-X8 (DEC-7) | | `hablar` | BL-X7 |
| `onb-cumplida` | BL-X8 (DEC-7) | | `cobro-voz` | BL-F2 |
| `consent` | BL-J8 | | `recibo` | BL-F1 |
| `caida` | BL-J4 | | `fact-voz` | — |
| `preg` | BL-X3 | | `fact-hitl` | BL-D3 |

«—» = la pantalla ya estaba ✅ en las dos plataformas el 16/09 y no tiene ítem abierto.

### visión — 2 ids (no se construyen)

| `?ver=` | Evidencia | Va a |
|---|---|---|
| `plan` | `prototipo/index.html:1005` «⚠️ VISIÓN: el backend no expone plan ni consumo»; DEC-8 | `BL-V2` |
| `limite` | DEC-8 (acta `:18`); el propio mockup se declara de visión (mapa 16/09, fila «El límite») | `BL-V2` |

### propuesta — 1 id

| `?ver=` | Evidencia | Estado |
|---|---|---|
| `pres-marca` | `prototipo/index.html:3238` «⚠️ PROPUESTA: la personalización de plantilla…»; backlog `BL-V1` | Post-beta hasta que el operador decida |

### fuera — 7 ids (no son pantallas de la app; no se miden)

| `?ver=` | Por qué | Evidencia |
|---|---|---|
| `fact-sinarca` | Boceto **a corregir**: emite sin HITL, algo que el producto prohíbe. El comportamiento real ya es spec vía `fact-voz → fact-hitl → fact-cae` | acta §4.1 · `BL-P6` |
| `escucha` | Alias de un estado **derogado** el 24/08; el router lo redirige al estado nuevo | `prototipo/index.html:3496-3498` |
| `cargando` | Estado técnico (skeleton), no una pantalla | `prototipo/index.html:3480,3828` |
| `ropa-presu` · `ropa-factura` · `ropa-cobro` | Escenarios para piezas de Instagram (marketing) | `prototipo/index.html:3268-3313` |
| `conta` | Link muerto: Contabilidad se fusionó con Inteligencia (DA-2) y el router ya no tiene handler | `prototipo/mapa.html:87` · `CLAUDE.md:801` |

## 3. Por qué el total de spec es 54 y no 48

El mapa del 16/09 contaba 48 filas; el vigente (`mapa-pantallas/index.html`, objeto `PANTALLAS`) tiene **51**, porque
#516 sumó `volver`, `ingresar` e `ingresar-error`. De 51 a 54, sin ningún desacuerdo de clasificación:
1. **−2:** `plan` y `limite` salen (visión, DEC-8).
2. **+4:** el mapa cuenta las cinco `card-*` como una sola fila (`card`); acá van separadas, porque BL-J7 nombra
   una pantalla de destino por cada una.
3. **+1:** `cobro-voz` es spec (`BL-F2`) pero no figura en ningún mapa: se auditó aparte como hilo fuera del mapa.

51 − 2 + 4 + 1 = **54**, recontado sobre la tabla de §2: 54 ids, ninguno repetido. Cuadre total:
54 spec + 2 visión + 1 propuesta + 7 fuera = **64 filas** = 50 ids literales (incluye `conta`) + 13 sólo por código
+ la home (`?ver=` vacío). Lo que importa para el cierre es el 54.

## 4. Consecuencias

1. **`volver` en web no tenía dueño.** BL-X12m lo cubre sólo en mobile, y BL-X12w sólo cubre `ingresar` e
   `ingresar-error`. Como `volver` es el mismo reveal que el splash con los labels del post-logout
   (`mapa-pantallas/index.html:173`), **entra en BL-X10 web** (FRONTEND-1).
2. **Mapas del prototipo que mienten** (van a Martín **por el operador**, junto con `BL-P6`; no se editan desde el
   repo porque el prototipo es suyo):
   - `mapa-pantallas/index.html:273` (`plan`) y `:235` (`limite`) no marcan visión.
   - `prototipo/mapa.html:97` presenta `plan` como spec y `:87` enlaza `conta`, que ya no existe.
   - `cobro-voz` no figura en ningún mapa.
3. **Criterio de cierre:** backlog §13, punto 3, mide contra la sección «spec» de este documento.
