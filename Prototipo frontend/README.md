# Prototipo frontend — Odobi

Trabajo de UX/UI sobre el copiloto: **prototipo navegable, mockups anotados y el sistema visual**.
Todo es HTML autocontenido, sin build ni dependencias — se abre con doble clic o con cualquier
servidor estático.

Nada de esto toca el código de la app. Es la capa de diseño: el *qué* (pantallas navegables) y el
*por qué* (cada decisión con su fundamento y la alternativa que se descartó).

---

## Por dónde empezar

```bash
cd "Prototipo frontend/odobi-ui"
python3 -m http.server 8080
```

| Abrir | Qué es |
|---|---|
| `mapa-pantallas/` | **Empezá acá.** Las 23 pantallas dentro de un marco de teléfono, agrupadas. Cada marco carga el prototipo en vivo, no una captura |
| `prototipo/` | El prototipo navegable. Gestos reales: arrastrá el borde de arriba para el escritorio y el de abajo para el chat |
| `mockups/` | 13 piezas de argumentación, cada una con su `DECISIONES.md` |

El prototipo abre pantallas sueltas con `?ver=`:
`splash` · `entrada` · `esc` · `chat` · `escucha` · `hitl` · `vacio` · `gastos` · `ingresos` ·
`factura` · `presu` · `bi` · `conta` · `clientes` · `ajustes` · `negocio` · `afip` · `apps` ·
`plan` · `cuenta` · `apar` · `hablar`

---

## Qué hay en cada carpeta

| Carpeta | Contenido |
|---|---|
| `prototipo/` | 23 pantallas navegables en un solo HTML. Drag real con Pointer Events, swipe para descartar avisos, las dos animaciones de arranque |
| `mapa-pantallas/` | Índice visual con marco de teléfono. Escala ajustable y anotaciones que se pueden apagar |
| `mockups/` | 13 mockups anotados. Los 11 primeros recrean la UI; **12 y 13 cargan el prototipo por iframe** para no tener dos fuentes de verdad |
| `assets/` | Tipografías (Plus Jakarta Sans), 36 íconos Phosphor, isotipo y lockup, ilustración spot, marco de teléfono |
| `tokens/` | Variables del sistema — `odobi.css` |
| `explorations/` | Exploraciones cerradas: splash, acento, tipografía, isotipo, la comparativa con Monzo |
| `audit/` | Análisis del build + la lámina para presentarlo |
| `arbol/` · `deck-assets/` | Piezas de presentación (⚠️ muestran la UI anterior a la renovación visual) |
| `CLAUDE.md` | **La fuente operativa.** Reglas duras: paleta, contraste, tipografía, iconografía, estructura |

---

## Lo que hay que saber antes de tocar nada

**Las dos gramáticas visuales.** No es decoración: es semántica.

| | **A — operación** | **B — configuración** |
|---|---|---|
| Dónde | Mi día, las 7 funciones, Contabilidad | Ajustes y sus 7 opciones |
| Encabezado | card blanca + **bloque negro** | título grande suelto sobre el lienzo |
| Bloque de color | uno, con la cifra | **ninguno** |
| Elección | — | filas con radio |

**El bloque negro significa "una cifra de tu negocio"**, y sólo eso. Cuando se usaba también para
un mail o un tema, el recurso dejaba de decir algo.

**Reglas que vienen del repo, no del diseño:**

- Cuando falta un dato va **"—", nunca "$0"**. Mostrar cero de rentabilidad cuando falta un gasto
  le miente al usuario sobre su negocio.
- **Caja y Facturado nunca se mezclan**: si se sumaran, la misma plata se contaría dos veces.
- Un gasto **no se puede editar ni borrar** después de guardado — por eso la card editable es el
  único control de calidad del dato de todo el producto.
- La cartera de Clientes **no alimenta la facturación** (ver deudas abiertas).

**Contraste:** todo par nuevo se calcula antes de usarse, nunca a ojo.

---

## Deudas abiertas

- **El pill de acción de tarjeta da 3,17:1** — blanco sobre `#DE7250` a 16 px sin bold está debajo
  de AA para texto normal. Aplicado a pedido, **anotado y no cerrado**. Salidas: fill `#B04A2E`
  (5,43:1) o volver a 19 px bold.
- **Descartar avisos depende de un gesto de trayectoria.** WCAG 2.5.1 pide una alternativa de un
  solo puntero; falta reponerla por otra vía.
- **La duración de la Entrada son 1,5 s provisorios** — se cierra midiendo la carga real de Mi día.
- **No hay `.riv` exportado.** Splash y Entrada están como referencia de movimiento en CSS; la
  pieza final se construye en Rive.
- **La cartera de Clientes no alimenta la facturación**: al facturar los datos se cargan a mano.
  La pantalla insinúa una promesa que el backend no cumple. Es carencia del producto, no del diseño.
- **Contabilidad e Inteligencia se solapan** en caja, categorías y mejores clientes.
- **Los gráficos no son tocables** y nada lo indica: tocarlos y que no pase nada se lee como app rota.
- **`arbol/` y `deck-assets/` quedaron en la UI anterior** a la renovación visual.
