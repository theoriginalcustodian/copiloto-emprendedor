# Mi día · tres verticales — exploraciones

**Ninguno de estos archivos es la versión vigente.** Son fotos del momento en que se tomó cada
decisión: sirven para saber **qué se descartó y por qué**, no para ver cómo está la app.

> ## Lo aplicado vive en el prototipo
>
> ```bash
> cd odobi-ui && python3 -m http.server 8080
> ```
>
> | Pantalla | URL |
> |---|---|
> | Mi día | `localhost:8080/prototipo/` |
> | Tablero | `…/prototipo/?ver=tablero` |
> | Agenda | `…/prototipo/?ver=agenda` |
> | Estado de carga | `…/prototipo/?ver=cargando` |
>
> ⚠️ El parámetro `?ver=` **sólo funciona en el prototipo**. En estos archivos no hace nada.

---

## Qué hay acá, en orden cronológico

| Archivo | Qué probó | Cómo terminó |
|---|---|---|
| `v1.html` | Las tres verticales, primera versión. Tres bloques en scroll + tablero + agenda | ⛔ **Superado.** Chips con fondo pastel, rótulos en versalitas, botón de 46 px |
| `v2.html` | Paleta pastel escalonada + encabezados de día grandes (CARROT Weather) + fila en curso teñida (Klook) + sheet de detalle (Alta) | ◐ **Parcial.** Los encabezados y el tinte quedaron; los chips con fondo no |
| `v3.html` | Patrones de Quizlet: degradé invertido, carrusel con puntitos, filas de 64 px, selección con borde y check | ◐ **Parcial.** Ver decisiones abajo |
| `cards.html` | Tres patrones de card traducidos de Aceternity: stack apilado · expandible · arrastre con rebote | ✅ **Ganó B (expandible)**, y se sumó el rebote de C |
| `chips.html` | Chips de prioridad: con fondo · sólo texto · texto + punto · texto + peso | ✅ **Ganó C (texto + peso)** |
| `elementos.html` | Cuatro huecos detectados con los catálogos de gluestack, RN Elements, UI Kitten y Tamagui | ✅ **Los cuatro aplicados** |

## Decisiones cerradas, y qué las cerró

| Decisión | Resultado | Dónde se probó |
|---|---|---|
| **Eje del kanban** | **Estado** (Para hoy · Haciendo · Hechas), como el repo. No por función | `v1` |
| **Integración de las tres** | Una pantalla, tres bloques en scroll | `v1` |
| **Prioridad** | Odobi ordena; el usuario fija arriba. El orden manual **envejece** | — |
| **Degradé** | Se mantiene el de siempre (arena abajo). ⛔ Invertirlo al estilo Quizlet **se probó y se descartó** | `v3` |
| **Card del tablero** | **Expandible in-place** — y es lo que el repo ya pedía | `cards` |
| **Swipe** | Con **rebote** al pasar el umbral: comunica "hasta acá llega" sin cartel | `cards` |
| **Chips de prioridad** | **Sólo texto, peso escalonado.** Con fondo eran 8 manchas por pantalla | `chips` |
| **"Urgente"** | `#EDAE9E` descartado: estaba a **2,2° de matiz** de la terracota — era terracota aclarada | `v3` |
| **Botón de tarjeta** | 38 px · pad 16 · 15 px · margen 20. Bajó de 46 porque competía con el aviso | `v3` |
| **Selección** | Borde + check, no relleno: la solapa activa deja de gastar acento | `v3` |
| **Carrusel** | ⛔ **Descartado** al llegar el expandible: mostraba una tarjeta por vez y gastaba el eje horizontal (que el swipe necesita) | `v3` → `cards` |
| **Alerta crítica** | En el **tablero**, no en Mi día: allá la prioridad ya la dice el texto en color | `elementos` |

## Lo que sigue abierto

- **El sheet de detalle quedó redundante.** Si el expandible ya muestra el detalle, hay que decidir
  si el sheet sobrevive o si el tablero también expande.
- **Agendar una tarjeta y "Odobi propone huecos" son VISIÓN.** El backend no expone duración ni
  huecos, y **las tarjetas del detector no tienen campo de hora** — eso es cambio de modelo de
  datos, no de UI. Confirmar con David.
- **La spec completa** está en `specs/mi-dia-tres-verticales.md`.
