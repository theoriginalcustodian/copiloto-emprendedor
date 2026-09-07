# Exploraciones — índice

**Nada de acá es la versión vigente.** Cada carpeta es el registro de una decisión: sirve para saber
**qué se descartó y por qué**, no para ver cómo está la app.

> ## Lo aplicado vive en dos lugares
>
> ```bash
> cd odobi-ui && python3 -m http.server 8080
> ```
>
> - **`prototipo/`** — las pantallas navegables. Abrí una suelta con `?ver=` (ver `README` del repo)
> - **`mapa-pantallas/`** — todas dentro de un marco de teléfono, agrupadas
>
> ⚠️ El parámetro `?ver=` **sólo funciona en el prototipo**. En las exploraciones no hace nada.

---

## Las once carpetas

| Carpeta | Qué se decidió ahí | Estado |
|---|---|---|
| `wise-ab/` | Experimento A/B con Wise: cuánto "display" adoptar | ✅ **Cerrada 06/08.** Gana B acotada. ⚠️ El HTML usa la nav de 4 secciones: es registro histórico, no UI vigente |
| `tipografia-libre/` | Reemplazo de NeueEinstellung (licencia USD 375/año) | ✅ **Cerrada 07/08.** Gana Plus Jakarta Sans Bold, elegida midiendo con `fontTools`, distancia 0,111 |
| `splash-o/` | El splash largo y la entrada corta | ✅ **Cerrada 29/07.** `v2-inmersivo.html` rev.3 **es la pieza que se portó a Rive** — de ahí se copió al prototipo, no se recreó |
| `splash-motion/` | Alternativa de motion para el splash | ⛔ **Descartada** |
| `isotipo-comparativa/` | Monograma propio vs. isotipo de David | ✅ **Cerrada 18/08.** Gana el de David (4 arcos). Análisis en `ANALISIS-CHAVES.md` |
| `isotipo-david/` | Cómo se mueve el isotipo en la entrada | ✅ **Cerrada.** `entrada.html` es la referencia de movimiento; la pieza final va en Rive |
| `acento/` | Terracota: valor único vs. par | ✅ **Cerrada 18/08.** Gana el par `#DE7250` + `#B04A2E`. Incluye la revisión del bold en botones |
| `iconos/` | Set de íconos: Iconoir vs. Phosphor | ✅ **Cerrada 19/08.** Gana **Phosphor Regular**, elegido midiendo el grosor como % del alto |
| `monzo/` | La renovación visual completa | ✅ **Cerrada 19/08.** Ver `DECISIONES.md` y `PROPAGACION.md` — es la que cambió todo el sistema |
| `mi-dia-3v/` | Mi día con tres verticales: números, agenda y tablero | ✅ **Cerrada 20/08.** Seis archivos, ver su `LEEME.md` |
| `portada-color/` | ¿La portada de Mi día va en negro o en terracota? | ✅ **Cerrada 20/08.** Sigue el **negro**: significa "una cifra de tu negocio" y aparece así en 9 pantallas |

## Cómo leer una exploración

1. Si tiene **`DECISIONES.md`**, empezá por ahí: está la tabla de decisión → fundamento →
   alternativa descartada.
2. Si tiene **`LEEME.md`** (sólo `mi-dia-3v/`), es porque hay varios archivos y hace falta saber
   cuál es cuál.
3. Los `.html` son para **ver**, no para copiar: varios usan CSS anterior a la renovación visual del
   19/08 y romperían el sistema si se pegan tal cual.

⚠️ **Excepción importante:** `splash-o/v2-inmersivo.html` **sí** es fuente. Es la pieza que se portó
a Rive, y el prototipo la copia literal — recrearla desde la spec en texto da otra versión del mismo
momento, cosa que ya pasó una vez.

## Dónde vive la regla, si la exploración ya cerró

En **`CLAUDE.md`** (raíz de `odobi-ui/`). Las exploraciones explican **por qué**; `CLAUDE.md` dice
**qué rige hoy**. Si hay conflicto, gana `CLAUDE.md`.
