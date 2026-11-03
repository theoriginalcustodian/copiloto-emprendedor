# RESCATE — contenido que SOLO vive en el working tree del checkout compartido

Medido el 2026-11-03 contra `origin/main`. Estas lineas **no estan en ningun commit**:
no las tiene `main`, no las tiene el HEAD del checkout (207 commits atras) y no hay rama
que las contenga. Un `merge --ff-only` con descarte, un `checkout` o un `reset` las borra
y no hay de donde recuperarlas.

**Por que no se arregla commiteando el archivo entero:** el HEAD de ese checkout esta
rancio, asi que el archivo tambien trae su version VIEJA de lo que `main` ya cambio.
Commitearlo rescata estas lineas y **revierte** las de main en el mismo movimiento.
La resolucion es conservar las DOS mitades, nunca elegir un lado.

---

## `Prototipo frontend/odobi-ui/mockups/11-voz-contextual/index.html`

1 linea(s) unica(s):

```html
      "Todavía no se guardó nada" no es una cortesía: es <b>regla dura del producto</b> — mientras la card
```

---

## `Prototipo frontend/odobi-ui/mapa-pantallas/index.html`

5 linea(s) unica(s):

```html
     'no es otra pantalla: es el aterrizaje del splash con los labels del post-logout («Entrar» / «Entrar con otra cuenta»). Estaba escrito en §8 desde el 29/07 y nunca se había dibujado — y en mobile no existe: la app salta directo al formulario.'],
    ['detalle', 'Detalle', 'El sheet que sube al tocar una tarjeta.',
     'resuelve dos cosas: el detalle que el repo pide al tocar, y la alternativa de un solo puntero que WCAG 2.5.1 exige para el swipe.'],
     'el título NOMBRA lo que vas a guardar ("Nuevo gasto") y el botón conserva el verbo del repo ("Guardar el gasto"). Un título nombra, un botón actúa. Cambia el contenido según de dónde dictaste; lo que no cambia nunca es "Todavía no se guardó nada".'],
     'la regla del destino: lo que REGISTRA se queda en su función, lo que PREGUNTA va al chat. Nada se guarda al enviar — sigue vigente "Todavía no se guardó nada".'],
```

---

## Control

Instrumento: `medir_frase_vs_linea.py`. Compara el NUCLEO DE PROSA de cada linea
(sin markup ni comillas) contra el archivo completo de `main`, porque comparar la
linea entera cuenta como «unica» una reenvoltura y comparar la frase suelta la
absuelve de mas. De las 12 lineas agregadas: 3 son la misma prosa con otra
envoltura, 3 son markup puro, **6 son contenido unico**.

Control positivo: una frase inventada da AUSENTE (corrido, da False).

