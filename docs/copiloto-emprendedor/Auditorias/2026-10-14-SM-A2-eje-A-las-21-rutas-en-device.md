# SM-A2 (#1012) — Eje A: las 21 rutas, navegando, en device

> **Sesión:** frontend2 · **Fecha:** 2026-10-14 · **Device:** `RF8T318RN9T` (720×1600), dueño único.
> **Qué mide:** ¿se LLEGA a la pantalla haciendo lo que hace un dedo? (eje A de
> `2026-10-11-receta-device-21-pantallas.py`). El render por deep link es el eje B y **no** se mezcla.
> **Medido contra:** bundle servido por Metro desde `main` `ea810b7a` (incluye el fix SM-A1) ·
> prod `/healthz` `9e536c38` · app dev-client ya instalada (cero rebuild).
> **Condición:** escalas de animación del sistema en **valor normal** (no se tocaron), FAB de
> herramientas del dev-client apagado (tapaba el acceso a Ajustes).

## Veredictos (21 de 21)

Vocabulario del eje A: `LLEGA` · `NO_LLEGA` · `NO_ATRIBUIBLE`.

| # | Ruta | Veredicto | Camino con un dedo (captura) |
|---|---|---|---|
| 1 | `/` | LLEGA | arranque en frío: base con «Bajá para tus funciones» (`midia0`) |
| 2 | `/midia` | **NO_LLEGA** | ningún call-site navega a `/midia` (grep literal: sólo comentarios). El *contenido* Mi día es la base (`/`); la **ruta** sólo por deep link (`x-midia-link`, eje B) |
| 3 | `/inteligencia` | LLEGA | pestaña → tile «Inteligencia» (`t-intel`) |
| 4 | `/legal` | LLEGA | Ajustes → Mi cuenta → «Términos y Condiciones» (`l-tos`) y «Política de Privacidad» (`l-priv`) |
| 5 | `/ajustes-soporte` | LLEGA | Ajustes → «Soporte técnico» (`aj-soporte`) |
| 6 | `/facturacion` | LLEGA | pestaña → tile «Facturación» (`t-fact`) |
| 7 | `/presupuestos` | LLEGA | pestaña → tile «Presupuestos» (`t-presup`) |
| 8 | `/gastos` | LLEGA | pestaña → tile «Gastos» (`t-gastos`) |
| 9 | `/ingresos` | LLEGA | pestaña → tile «Ingresos» (`t-ingr`) |
| 10 | `/ajustes-afip` | LLEGA | Ajustes → «Facturación ARCA» (`aj-afip`) |
| 11 | `/clientes` | LLEGA | pestaña → tile «Clientes» (`t-clientes`) |
| 12 | `/recientes` | LLEGA | Mi día → «Actividad reciente ›» (`r-recientes`) |
| 13 | `/agenda` | **NO_ATRIBUIBLE** | el botón «Ver agenda» se oculta con Google Calendar caído (`PantallaMiDia.tsx:489`, por diseño) y el tenant canónico lo tiene caído: la precondición no se da, la ruta no se puede juzgar. Por deep link renderiza (`x-agenda-link`, eje B) |
| 14 | `/soporte-ticket` | LLEGA | Soporte → tarjeta «Ticket SOP-0005» (`x-ticket`) |
| 15 | `/apps` | LLEGA | Ajustes → «Apps conectadas» (`aj-apps`) |
| 16 | `/ajustes` | LLEGA | Mi día → botón de Ajustes (esquina sup. der.) (`aj-hub`) |
| 17 | `/ajustes-cuenta` | LLEGA | Ajustes → «Mi cuenta» (`aj-cuenta`) |
| 18 | `/ajustes-negocio` | LLEGA | Ajustes → «Mi negocio» (`aj-negocio`) |
| 19 | `/ajustes-skins` | LLEGA | Ajustes → «Apariencia» (`aj-skins`) |
| 20 | `/ajustes-como-usar` | LLEGA | Ajustes → «Cómo usar la app» (`aj-comousar`) |
| 21 | `/ajustes-feedback` | LLEGA | Ajustes → «Contanos qué tal» (`aj-feedback`) |

**Cuenta:** 19 LLEGA · 1 NO_LLEGA · 1 NO_ATRIBUIBLE = 21.

## Controles de la corrida

- **Positivo:** el toque quieto sobre la pestaña abre el escritorio y cada tile cambia la pantalla
  (título y contenido distintos del estado previo) — el instrumento *puede* ver una llegada.
  El gesto de apertura es el de SM-A1 (6/6).
- **Negativo:** un toque en una zona sin control de Mi día (360,1500) deja la pantalla
  **byte-idéntica** (`c-antes` = `c-neg`, sha256 `7837e11581ab…`): el instrumento no inventa llegadas.
- Cada llegada se acredita por **contraste**: el estado previo (hub, escritorio o Mi día) tiene
  otro título y otro contenido que el posterior; no se usa un testID que pueda ser de una capa anterior.

## Lo que esta corrida NO es

- **No es el instrumento por árbol de UI.** `uiautomator dump` falla («could not get idle state»)
  con animaciones normales porque la portada anima siempre; las llegadas se leyeron de capturas
  de pantalla **a ojo, una por una**. Es medición de una corrida, no un script re-ejecutable.
- **No acredita render ni contenido** de las 21 (eje B) ni su paridad contra la referencia.
- Las capturas (24 PNG, ~4,5 MB) **no se versionan** (repo público): viven en
  `artefactos-build/device-capturas/sm-a2/` del worktree `wt-fe2-kvcaida`; sha256 truncado en la
  tabla de abajo.

## Hallazgos laterales (sin dueño asignado — no fixeados acá)

1. **Título «Política de Privacidad» solapa «Volver»** a 720 px: la «d» final queda debajo del botón
   (`l-priv`). «Términos y Condiciones» parte en dos líneas y no solapa. Cáscara de `/legal`.
2. **Facturación** mostró dos indicadores de refresco a la vez («Te deben» y «Mis comprobantes»)
   en la carga inicial; no se investigó si es defecto o transitorio.
3. **D-A** (el chat «arriba» al arrancar) sigue ocurriendo — ya señalado en el `cierre_` de SM-A1;
   pido id propio.
4. **«Términos y privacidad — Aceptaste la versión vigente (2026-09-22)»** en Mi cuenta es una fila
   que no navega: confirma que la aceptación se *muestra*; SM-C4 decide si además condiciona algo.

## sha256 (primeros 12) de las capturas citadas

```
midia0 45ea95a997e3 · t-intel 3445de087b51 · l-tos c752c035f4f1 · l-priv b9b302969fad
aj-soporte ec48f9d194cc · t-fact 7551bae999e9 · t-presup cfa1682c9eca · t-gastos 19593865419b
t-ingr a3efb7f28561 · aj-afip 34e30142df28 · t-clientes a90a3c5845f1 · r-recientes 74e23bd5d0ae
x-agenda-link 23408fa9f4e5 · x-ticket 6b2d59da4da7 · aj-apps 501a01996a8a · aj-hub 4780757c37e8
aj-cuenta 61d30e188111 · aj-negocio 0f119fdca195 · aj-skins ee7ec4c1ee26
aj-comousar e804aa66fa73 · aj-feedback 1ad4a89367e3 · x-midia-link ab85e41dd18e
c-antes = c-neg 7837e11581ab
```
