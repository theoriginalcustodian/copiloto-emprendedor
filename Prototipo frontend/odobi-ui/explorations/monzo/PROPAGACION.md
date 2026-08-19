# Propagación de la gramática de Monzo — 19/08/2026

Qué se aplicó, dónde, y qué reglas del sistema quedaron modificadas. La exploración y su
fundamento están en `DECISIONES.md` (mismo directorio); esto es el registro del alcance.

## Alcance

| Destino | Estado |
|---|---|
| `prototipo/index.html` | ✅ completo (Mi día, escritorio, chat, HITL, funciones) |
| `mockups/` — los 11 | ✅ CSS completo · stack de portada en los 4 que la tienen (02, 03, 09 ×2, 10) |
| `tokens/odobi.css` | ⛔ PENDIENTE — los tokens siguen con los radios viejos |
| `audit/lamina/` · `arbol/` · `deck-assets/` | ⛔ PENDIENTE — muestran la UI anterior |

## Las siete transformaciones

| # | Qué | Antes | Ahora |
|---|---|---|---|
| 1 | Lienzo | blanco plano | degradé ascendente `#F5E7DE` → `#F7F3EC` (arena abajo) |
| 2 | Radios | `--r-s:8` `--r-m:16` | `--r-s:14` `--r-m:22` + `--r-xl:26` nuevo |
| 3 | Portada | caja crema, cifra 28 px | **bloque negro** + stack, cifra 40 px |
| 4 | Superficies blancas | `border:1px solid` | **sin borde**, elevación `0 4px 18px rgba(26,21,18,.07)` |
| 5 | Acción de tarjeta | link de texto `#B04A2E` | **pill** `#DE7250`, mismo fill que el mic |
| 6 | Composer | input con borde terracota | card blanca elevada + mic 52 px con sombra de color |
| 7 | Tiles | 36 px | 42 px |

## El stack de portada

Card blanca del **mismo ancho** que el bloque negro, que baja **hasta la mitad de él por
detrás**: el borde inferior queda tapado, no recortado (`height:calc(50% + 26px)` sobre un
`padding-top:52px`). Trae **wordmark a la izquierda y fecha a la derecha**, alineados por
baseline.

Se probó primero con la card de atrás más angosta (inset lateral, como Monzo). Se descartó:
Martin pidió mismo ancho. Con ancho igual la curva superior del bloque negro deja asomar dos
cuñas blancas en los laterales — por eso el solape tiene que ser generoso.

## Reglas del sistema que esto MODIFICA

Tres, y ninguna es cosmética. Hay que llevarlas a `CLAUDE.md`:

1. **Cae el borde terracota de 1 px del input** (regla de componente del 22/07: *"input+mic =
   unidad hablarle a Odobi"*). La unidad ahora la produce la **elevación compartida** de
   input y mic, no una línea. El propósito de la regla se conserva; cambia el mecanismo.
2. **El wordmark sale del header** y pasa a la **card del stack**. La tabla de piezas de
   marca del 18/08 asigna "wordmark solo → header de la app": donde hay stack, el header
   queda **sólo con el avatar**. Ponerlo en los dos lados gastaba el mismo signo dos veces.
3. **El isotipo sale de los labels de sección** ("PARA HOY"). Sigue en avatar del chat,
   estados vacíos, splash y piezas de marca. Pedido de Martin el 19/08.

## Deudas abiertas

- ⚠️ **Contraste del pill: 3,17:1.** Blanco sobre `#DE7250` a 16 px sin bold está **debajo de
  AA para texto normal** (necesita 4,5:1). Aplicado a pedido expreso de Martin, **anotado y no
  cerrado**. Dos salidas cuando se cierre: fill `#B04A2E` (5,43:1) o volver a 19 px bold
  (que era legal por la vía de "texto grande", piso 18,66 px).
- ⚠️ **Descartar avisos depende de un gesto de trayectoria.** WCAG 2.5.1 exige una
  alternativa de un solo puntero. La × en la tarjeta se quitó por pedido de Martin (19/08);
  falta reponer la alternativa por otra vía (desde el detalle, o un "ocultar" en la acción).
- **Qué significa descartar** es decisión de producto sin cerrar: 4 de las 8 reglas del
  detector se cierran solas **por el hecho**. Descartar a mano no paga la factura. La
  recomendación es que el descarte valga **hasta mañana**, no para siempre — si no, el
  usuario silencia sin querer un aviso que sigue siendo verdad.
- **Verificación en alto reducido:** el marco de escritorio de 844 px ocultó un bug real
  (tarjetas recortadas en el celular, por `flex-shrink` en un contenedor con
  `overflow:hidden`). Todo render de control va también a **430×760**.

## Estado de calma (Mi día sin avisos)

Si no queda ninguna tarjeta —porque se cerraron solas o se descartaron— aparece la
**ilustración de la taza** (`assets/illustrations/taza.svg`, dibujo de Martin) con "Nada
urgente por hoy". El vacío es un **resultado bueno** y tiene que verse como tal, no como una
pantalla que falló al cargar. La etiqueta "PARA HOY" se va con las tarjetas: sin tarjetas no
encabeza nada. `?vacio=1` en el prototipo lo muestra sin tener que descartar a mano.
