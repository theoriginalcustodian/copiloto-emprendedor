# Splash y entrada — spec de port a Reanimated

Para David. **Reemplaza al pendiente de exportar el `.riv`**, y explica por qué.

Fuente de verdad del movimiento: `explorations/splash-o/v2-inmersivo.html` **rev. 3**.
Ese archivo corre hoy en el prototipo (`?ver=splash`) y es de donde salen todos los números
de acá. No es una recreación: es la pieza.

---

## 0 · Por qué Reanimated y no Rive

| | |
|---|---|
| **La app ya tiene Reanimated** (`4.5.0`) y **no tiene Rive** | Meter `rive-react-native` es una dependencia **nativa** nueva en una app de 43 deps. Es decisión de arquitectura tuya, no de diseño |
| ⚠️ **El splash MIDE en runtime** | La forma se posa donde va la O calculando **el ancho real de "dobi"**. Un `.riv` tiene esa posición **horneada**: si cambia la tipografía o el texto, se rompe sin avisar. Ya nos pasó cambiar de fuente y tener que regenerar 24 paths |
| El artboard de Rive **está desactualizado igual** | Se armó el 06/08 con el monograma anterior. El **18/08** se adoptó tu isotipo y el **19/08** la entrada se invirtió. Exportar hoy daría una pieza vieja |

**Si aun así preferís Rive**, decilo y se rehace el artboard — pero entonces el `--ox` hay que
fijarlo a mano y queda como deuda.

---

## 1 · Son DOS piezas, no una acelerada

| | Cuándo | Dura | Qué hace |
|---|---|---|---|
| **Splash** | primer ingreso · post-logout | **6,84 s** | construye identidad. Se paga una vez en la vida de la cuenta |
| **Entrada** | arranques 2..n | **~1,5 s provisorios** | **cubre la latencia de carga**. Se ve todos los días |

⚠️ **No son la misma animación con otro tiempo.** El splash se puede permitir 6,84 s porque
ocurre una vez; la entrada no puede pasarse de la carga real de Mi día — si termina antes,
el usuario espera mirando algo quieto, que es peor que no tener animación.

---

## 2 · Curvas y tempos

```
ease          cubic-bezier(.2,  0,   0,   1)     general
ease-blob     cubic-bezier(.5,  0,   .2,  1)     arranca contenida, acelera, frena
ease-collapse cubic-bezier(.32, 0,   .16, 1)     el inverso: se va posando
ease-bounce   cubic-bezier(.24, 1.62,.4,  1)     rebote de las letras
```

En Reanimated: `Easing.bezier(x1,y1,x2,y2)`. ⚠️ **`ease-bounce` sobrepasa 1** (1.62) — es un
overshoot real, no un error de transcripción. Si se recorta, las letras dejan de rebotar.

**Tempo elegido: `Calmo` · aparición `Densa`** (Martin, 29/07 — cerrado, no se reabre).

```
grow      1900 ms    cuánto tarda una forma en comerse la pantalla
colapso   1450 ms    el colapso dirigido hacia la O
settle     780 ms    la O apareciendo
letra      720 ms    cada letra de "dobi"
lstg       150 ms    escalonado entre letras
stagger    380 ms    = round(grow × 0.20)  ← "Densa": tres vivas casi siempre
```

---

## 3 · El splash, fase por fase

Cuatro formas de **familia circular** —parecidas, no idénticas— nacen en el centro, crecen
y salen del frame. Adentro ya nació la siguiente.

```
t=0      forma 1 nace   scale .04 → 7.8, rotate r0 → r1
t=380    forma 2
t=760    forma 3
t=1140   forma 4  (la última: NO sale)
t=3040   ── colapso ──  la última se contrae Y se desplaza hasta el lugar de la O
                        el fondo final (blanco→crema) entra en linear, mismo tiempo
t=4055   la O aparece   (entra MIENTRAS la forma termina de posarse: dc + col − col×.3)
t=4790   d·o·b·i        entran desde la DERECHA con rebote, escalonadas 150 ms
t=6080   el lockup sube 96 px · tagline +320 · botón +900 · ghost +1040
t=6840   fin de la animación de identidad
```

Fórmulas, para que no queden números mágicos:

```js
stagger   = round(grow × ratio)              // 380
dc        = (nBlobs − 1) × stagger + grow    // 3040 · arranque del colapso
tO        = dc + col − round(col × 0.3)      // 4055
tW        = dc + col + 300                   // 4790
tF        = tW + lstg × 3 + letra + 120      // 6080 · recién cuando la "i" terminó
```

**Las formas:** `circle` · `squircle` (radio 34%) · `super` (radios asimétricos) ·
`egg` · `scallop` (festón, ver §5). Colores: crema · arena · terracota · terracota profunda
· negro carbón.

**Opacidad:** entran a 5% del recorrido (`0% opacity:0 → 5% opacity:1`), no desde cero —
si no, se ve el "pop" del primer frame.

---

## 4 · ⚠️ Lo que Rive no puede hacer: `--ox`

```js
targetX = −(anchoReal("dobi") / 2)
```

La última forma **no se contrae al centro de la pantalla**: se contrae al **lugar exacto que
va a ocupar la O** dentro del lockup, que está a la izquierda del centro óptico.

**Ese desplazamiento se MIDE del wordmark renderizado**, en runtime, justo antes de arrancar.
En React Native: `onLayout` sobre el `<Text>` de "dobi" → `width` → guardarlo en un
`SharedValue`.

Es lo que hace que **la forma se pose donde va la O y el wordmark no salte después**. Con un
valor horneado, cualquier cambio de tipografía, de tracking o de tamaño lo desalinea en
silencio.

---

## 5 · El festón de 12 lóbulos

No es un asset: se genera. Coordenadas 0–1 (caja unitaria), Catmull-Rom convertido a Bézier
cúbica para que los lóbulos queden suaves.

```js
const N = 12, A = 0.06, R = 0.5 - A;   // ⚠️ R + A ≤ 0.5, si no los lóbulos se cortan
for (let i = 0; i < N * 2; i++) {
  const ang = (i / (N * 2)) * Math.PI * 2 - Math.PI / 2;
  const r   = R - A + (i % 2 ? 0 : A * 2);
  pts.push([0.5 + Math.cos(ang) * r, 0.5 + Math.sin(ang) * r]);
}
// y entre cada par de puntos:
c1 = [p1 + (p2 − p0) / 6]
c2 = [p2 − (p3 − p1) / 6]
```

⚠️ **`R + A` tiene que quedar ≤ .5.** Si se pasa, los lóbulos se salen de la caja de recorte
y **las puntas aparecen cortadas contra el borde** — bug real, visto el 29/07.

En RN: `react-native-svg` con `<Path>` y `clipPath`, o directamente el path como forma.

---

## 6 · La entrada diaria — ✅ REHECHA, lista para portar

**Fuente de verdad: `prototipo/index.html` → `?ver=entrada`.** Se rehizo con tu isotipo el
18/08 (`explorations/isotipo-david/entrada.html`) y ya está portada al prototipo.

⚠️ **No mires `explorations/splash-o/v2-inmersivo.html` para esto.** Ahí vive la versión
vieja —la O del wordmark quieta + 3 ondas que se disipan— y quedó superada por dos
decisiones posteriores: **18/08** se adoptó tu isotipo, **19/08** la entrada se invirtió
(fondo blanco, signo en terracota viva). Ese archivo se conserva como registro histórico y
sigue siendo la fuente del **splash**, no de la entrada.

**El signo nuevo encaja mejor que el viejo, y no es casualidad: ya son arcos.** La onda deja
de ser un adorno alrededor de la letra y pasa a ser **el propio símbolo desplegándose**.

### Lo que hay que portar

Fondo `#FFFFFF`. Signo de **132 px**, `viewBox="0 0 24 24"`, los 4 arcos con
`stroke:#DE7250` · `fill:none` · `stroke-width:1.3` · linecap y linejoin `round`.
`pathLength="100"` normaliza los cuatro trazos: **el `dasharray` no depende del largo real
de cada arco**, que es lo que permite que los dos primeros tarden lo que se les dice y no lo
que miden.

| Elemento | `d` | Cómo entra | Dur | Delay |
|---|---|---|---|---|
| Arco exterior | `M11 3.5a8.5 8.5 0 1 0 0 17` | draw-on (`dashoffset` 100→0) | 420 ms | 0 |
| Arco interno | `M11 7.5a4.5 4.5 0 1 0 0 9` | draw-on | 340 ms | 140 ms |
| Onda 1 | `M16.5 8.8a4.8 4.8 0 0 1 0 6.4` | `onda` | 460 ms | 300 ms |
| Onda 2 | `M19.5 6.5a9 9 0 0 1 0 11` | `onda` | 460 ms | 420 ms |

Curva única para los cuatro: `cubic-bezier(.2, .8, .2, 1)` → `Easing.bezier(.2,.8,.2,1)`.
**No hay overshoot acá** (a diferencia del splash): se ve 20+ veces por día y **lo simpático
la primera vez es insoportable a la vigésima**.

```
onda:  0%   opacity 0 · translateX(-3px) scaleX(.7)
      60%   opacity 1
     100%   opacity 1 · translateX(0) scaleX(1)
```
`transform-origin: 11px 12px` — el centro del signo, no el de la caja. En Reanimated va como
`transformOrigin` sobre el `<Path>`, o desplazando el pivote a mano.

⚠️ **`scaleX`, no `scale`:** las ondas se **estiran hacia afuera** desde el eje del signo. Con
escala uniforme se agrandan enteras y se lee como un zoom, no como sonido que sale.

El último arco termina a los **880 ms** (420 + 460). Lo que sigue es sostener el signo quieto
hasta el corte y salir con un fundido de **340 ms**.

### Las tres reglas que la pieza cumple

- **Termina en el signo estático, idéntico al de la app** — no hay corte ni fundido entre la
  animación y la pantalla.
- **Un solo gesto, no cuatro entradas:** los solapes están calculados para eso (cada elemento
  arranca antes de que termine el anterior).
- **Nada de rebote.** Ver arriba.

⚠️ **Duración total: 1,5 s son PROVISORIOS.** El número se cierra **midiendo la carga real de
Mi día**, no a ojo. Si la carga es más rápida, la entrada sobra; si es más lenta, hay que
sostenerla o repetirla. **Esto lo tenés que medir vos** — es el único dato de toda la spec
que no está de nuestro lado. Los 880 ms de dibujo no se tocan: lo que se estira o se acorta es
**el reposo**, entre que el signo queda completo y el fundido.

---

## 7 · Movimiento reducido

Con `prefers-reduced-motion` (RN: `AccessibilityInfo.isReduceMotionEnabled`):

- Las formas **no se animan y no se muestran** — se va directo al fondo final.
- El wordmark aparece **completo y quieto**.
- En la entrada, **el signo aparece entero y quieto**: `dashoffset` en 0, opacidad plena, sin
  transform. ⚠️ **Deroga el "fijos al 28% de opacidad"** de la versión vieja: aquello era una
  onda a medio disipar, un estado intermedio. **Ahora el signo es el logo**, y un logo al 28%
  se lee como que la app no terminó de cargar.

⚠️ **Lo que NO se apaga: el resultado.** El usuario tiene que ver el lockup y llegar a los
botones igual. Se saca el movimiento, nunca el contenido — es la misma regla que aplicamos al
aviso de "Guardado".

---

## 8 · Lo que queda abierto

| | |
|---|---|
| **La duración de la entrada** | 1,5 s provisorios. Se cierra midiendo la carga real de Mi día |
| **Los timings nunca se validaron con el MCP de 60FPS** | El archivo lo dice: *"60FPS MCP no respondió hoy: timings sin validar"*. Están elegidos a ojo sobre una pantalla, no medidos en device |
| **Los botones del splash** | Fill `#DE7250` + display **20 Bold** blanco = 3,17:1, legal sólo como texto grande. ⚠️ A 18 px deja de cumplir **y se ve idéntico** |
