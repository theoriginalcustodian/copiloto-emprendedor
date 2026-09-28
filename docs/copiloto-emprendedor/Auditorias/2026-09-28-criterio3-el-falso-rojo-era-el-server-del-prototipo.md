# Criterio 3 · El falso rojo del generador era el server del prototipo

**Fecha:** 2026-09-28 · **Sesión:** AUDITORÍA · **Rama:** `auditoria/criterio3-instrumento-fail-closed`
· **PR:** #685 · **SHA del arreglo:** `f0f84f10`

> **Veredicto binario:** el instrumento del criterio 3 **no estaba midiendo mal el prototipo — estaba
> siendo interrumpido por su propio server**. Las tres capturas faltantes de la corrida B1 eran un
> falso rojo. El prototipo, el selector, el timeout y el `waitUntil` estaban todos bien.

---

## 1. Lo que parecía, y por qué era creíble

La corrida B1 falló en tres capturas —`apar`, `soporte`, `esc`— **todas `proto-desktop`, ninguna a
390**. El mensaje del instrumento decía «timeout de 10 s esperando `#s-apar.on`». Con dos ids del
mismo tipo (`#s-*.on`) saliendo bien a desktop, la hipótesis natural era del prototipo o de la espera.

Monté una sonda de tasa para no juzgar un intermitente con una pasada. Salió 40-60%, y el patrón
«intermitente» encajaba perfecto con «la espera es corta». **Dos instrumentos midiendo la misma
métrica equivocada se confirmaron mutuamente.**

## 2. El número que rompió el círculo

No fue re-medir: fue leer los **milisegundos de los éxitos**, que estaban en la salida de la primera
sonda, debajo de un veredicto que decía lo contrario.

```
apar @390     3/5  ms: 25, 29, 47          apar @desktop     5/5  ms: 19, 28, 19, 71, 22
soporte @390  3/5  ms: 42, 39, 76          soporte @desktop  2/5  ms: 20, 26
cuenta @390   4/5  ms: 104, 97, 25, 83     cuenta @desktop   4/5  ms: 31, 50, 19, 24
comousar @390 4/5  ms: 31, 79, 29, 23      comousar @desktop 5/5  ms: 29, 18, 36, 67, 24
```

Los éxitos salen a **19-104 ms** contra un timeout de **10 s**. Un timeout mal elegido produce
éxitos *cerca* del límite; si el más lento entra en el 1% del presupuesto, la espera no es la
variable. Es un fallo **binario**: o monta al instante, o no monta. Y dos datos más que mi lectura de
B1 había perdido: **falla en los dos viewports**, no sólo a desktop, y `apar@desktop` salió **5/5**
justo donde B1 lo vio fallar.

## 3. Tres mediciones que se refutan una a la otra

| # | instrumento | qué probó | resultado |
|---|---|---|---|
| 1 | `scripts/evidencia/observar-montaje-proto.mjs` | ¿el prototipo monta la marca? | **24/24** con la marca puesta, 82-126 ms, **cero `pageerror`**, `?ver=` nunca perdido |
| 2 | `scripts/evidencia/ab-waituntil.mjs` (vs python) | ¿es el `waitUntil`? | `networkidle` 26/32 · `domcontentloaded` **31/32** → **hipótesis falsa** |
| 3 | mismo A/B, server Node | ¿es el server? | **32/32 en los dos modos** → causa aislada |

El observador instala el `MutationObserver` con `addInitScript`, **antes del primer script de la
página**: instalarlo después de `goto` no puede ver una mutación que ya pasó.

**El paso 2 es el que más importa como método.** Sin el brazo de control habría visto «mejoró de 26 a
31», cambiado la línea y cerrado un arreglo falso sobre un instrumento compartido. El guard del
propio script imprimió `NO REPRODUCE… NO cambiar nada por este resultado`.

## 4. La señal que identificó la causa

**Los fallos se mueven de celda en celda entre corridas.** B1 los vio en `apar`, `soporte` y `esc` a
desktop; la sonda de tasa en 6 celdas distintas; el A/B en `soporte@390` y `esc@desktop` 1/4.

El id, el viewport y el prototipo son **fijos** entre intentos. Un fallo que cambia de sujeto sólo
puede venir de lo compartido. El server era `python -m http.server` (PID 3508, verificado con
`netstat` + `Win32_Process`).

## 5. El arreglo — está en la precondición, no en el generador

| qué | dónde | qué hace |
|---|---|---|
| server propio | `scripts/evidencia/server-proto.mjs` (nuevo, Node core, cero deps, 35 líneas) | sirve el prototipo con concurrencia real; sin path traversal |
| levantarlo | `scripts/evidencia/correr-criterio3.sh:63-69` | usa el server Node en vez de `python -m http.server` |
| **guard de concurrencia** | `scripts/evidencia/correr-criterio3.sh:82-98` | **8 pedidos EN PARALELO** al server ajeno vivo; si falla alguno, **aborta con exit 2** |
| veredicto honesto | `scripts/evidencia/sonda-tasa-desktop.mjs:56-79` | compara el éxito más lento contra el timeout; ya no afirma «es la espera» por el patrón |

**El guard es el entregable que vale más que la matriz.** La sonda de salud anterior preguntaba
«¿contesta 200?» y declaraba sano —tres veces por corrida— a un server que se colgaba. Un control que
comprueba disponibilidad no comprueba capacidad. Los 8 pedidos van en paralelo a propósito: en serie
pasarían los 8 y el control no vigilaría nada.

**Control positivo, en las dos direcciones:**

```
8123 (python -m http.server):  1/8 pedidos fallidos → el guard ABORTA ✅
8124 (server-proto.mjs, node): 0/8 pedidos fallidos → el guard PASA   ✅
```

## 6. El defecto de proceso, que es el hallazgo transferible

Dos turnos diagnosticando el sujeto equivocado los sostuvo un `catch` de tres caracteres:

```js
try {
  await page.goto(`${BASE}/?ver=${id}`, { waitUntil: 'networkidle' });   // ← el que fallaba
  await page.waitForSelector(`#s-${id}.on`, { timeout: 10000 });          // ← el que reporté
  ok++;
} catch { /* cuenta como fallo */ }                                       // ← el mensaje se tira acá
```

El error real decía `page.goto: Timeout 8000ms exceeded`. El `waitForSelector` **nunca llegó a
ejecutarse** en las corridas que reporté como «el selector no aparece». El `catch` no atribuyó nada —
no puede, abarca los dos pasos. **La atribución la puse yo, y elegí el `await` que estaba depurando.**

Reglas, en `memoria/el-fallo-que-se-mueve-acusa-al-recurso-compartido.md`:

1. Un `catch` por operación falible, o el mensaje se imprime. El primer renglón de un error de
   Playwright dice `page.goto:` o `waitForSelector:` — **eso es la atribución**.
2. Antes de nombrar el paso que falló, preguntá cuál fue el **último que corrió**. Si el paso 1 se
   cuelga, el paso 2 no falló: no existió.
3. Un patrón que encaja con tu hipótesis no la confirma si medís dos veces la misma cosa.

## 7. Estado de la matriz B1 — y el control positivo del arreglo

**Corrida 1** (los 7 ids del default, `2026-09-28T11:53:33Z`): **exit 0**, 53 PNG,
`no_medibles_por_captura: []`, los 7 caminos de acceso declarados en
`evidencia-out/criterio3-caminos.json`, y el guard nuevo imprimiendo
`✓ concurrencia 8/8 pedidos sin cuelgue` antes de medir.

**Corrida 2 — el control positivo que cierra el ciclo.** Re-corrí exactamente los ids que
**producían el falso rojo**, porque un arreglo verificado sobre otro conjunto no prueba nada sobre
las celdas que fallaban:

```
· midiendo SOLO: apar,soporte,esc,bi,bi-refresh,comousar,cuenta
EXIT REAL DEL GENERADOR: 0
```

| id | capturas | antes |
|---|---|---|
| `apar` | **4/4** ✅ | faltaba `proto-desktop` |
| `soporte` | **4/4** ✅ | faltaba `proto-desktop` |
| `esc` | **4/4** ✅ | faltaba `proto-desktop` |
| `bi` · `bi-refresh` · `comousar` · `cuenta` | **4/4** ✅ | ya salían |

Las tres celdas que fallaban salen completas, sin tocar el prototipo, sin tocar el `waitUntil`, sin
tocar el timeout y sin tocar el selector. **Lo único que cambió es quién sirve los archivos.**

## 8. Lo que este arreglo NO cierra

- **`factura` y `comousar` quedan pendientes del contrato BL-Q3 v2** (planificación): tienen más de
  un camino de acceso con UI distinta en la app, así que una fila sin camino declarado no significa
  nada. No es un problema del instrumento sino de la definición de la fila.
- **`hitl`** se mide por el camino de factura, no por cobro MP ni agenda: `_run_emitir_factura`
  (`apps/copiloto/tool_catalog.py:1332`) **no recibe `confirmed`** porque no lo necesita — todos sus
  `return` son `is_write=False` y no hay llamada a AFIP. Una capacidad ausente no puede fallar
  abierta; un gate sí. Los otros dos dependen de que un `if` esté bien escrito
  (`tool_catalog.py:576,612`).
- **El delta contra el prototipo** de `card`, `card-presu` y `card-cobro` (`index.html:2862-2868`,
  `:2877-2878`, `:3661-3666`): los «COHERENTE» de FE1 sobre esos tres comparan otra pantalla.
