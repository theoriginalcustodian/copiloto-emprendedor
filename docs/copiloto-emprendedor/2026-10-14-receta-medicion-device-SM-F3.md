# Receta · medir en device los 4 ids de `SM-F3` (`onb-cumplida` · `preg` · `pres-voz` · `vozchat`)

> **Para quién:** la sesión que tenga el device libre (hoy frontend2; el device es de dueño ÚNICO) o el
> operador. **Escrita por frontend1, sin tocar el teléfono** (lectura de código propio + mapeo). La corre
> el dueño del device **de una pasada** cuando declare «device LIBRE» por `dato_`.
>
> **Estado:** sin ejercitar en device. Una receta no ejercitada es una promesa: el primer paso de
> abajo (§0) es el control que la acredita o la invalida.

## Qué entrega

Por cada id: un veredicto del **vocabulario cerrado** de `scripts/evidencia/contar-veredictos.py:645`
(`COHERENTE` · `DESVÍO` · `NO_MEDIBLE` · `FUERA-DE-REFERENCIA` · `NO_REPRODUCIBLE_SIN_EFECTO` ·
`REQUIERE_TRIAGE`; `PENDIENTE_DEVICE` NO cuenta como comparación) con `medido_contra: <sha de /healthz, MEDIDO al arrancar>` (el SHA que corre en prod; el
dato de un mensaje del buzón vence: `curl -s https://copilotoemprendedor.duckdns.org/healthz`) y **la captura** del paso decisivo. DoD de la ficha: que `falta-en-mobile.py` los deje de
listar en «cubiertos sin comparación».

## §0 · Precondiciones — midelas, no las supongas

```bash
python -I -X utf8 scripts/evidencia/device_medir.py autotest      # control positivo del instrumento, OFFLINE
adb devices                                                       # exactamente 1 línea con RF8T318RN9T
adb -s RF8T318RN9T shell dumpsys package app.copiloto.emprendedor | grep versionName
adb -s RF8T318RN9T reverse tcp:8081 tcp:8081                      # sólo si se sirve por Metro local
```

- **Qué build corre:** el device corre lo que Metro sirve, no `main`
  (`memoria/el-device-no-corre-main-corre-lo-que-metro-sirve.md`). Antes de medir, `git rev-parse --short
  HEAD` del checkout que sirve Metro tiene que ser el sha de `/healthz` (o anotar el que sea como `medido_contra`).
- **Animaciones del sistema en valor normal** (`adb shell settings get global animator_duration_scale` → 1.0):
  apagarlas cambia lo medido.
- **Usuario de prueba canónico:** `e2e-device@copiloto.test` (el único; ningún agente elige otro).
- **Sólo `input motionevent`** (DOWN/MOVE/UP) — el helper ya lo hace. **Nunca `input tap`**: no ejercita
  gestos RNGH ni botones flotantes.
- **Un solo adb.** Si otra sesión lo tiene, esta receta NO se corre.

Cada paso de abajo usa el helper: `D="python -I -X utf8 scripts/evidencia/device_medir.py"`.
`$D ver --filtro <texto>` lista `testID | texto | centro`; `$D hay <testID|texto>` sale 0/1;
`$D foto <archivo>` captura. Si un paso dice **`[ver]`** significa «pegá la salida de `$D ver` en el
`avance_`»: es evidencia, no resumen.

---

## `onb-cumplida` — el recibo de cumplimiento del onboarding

**Referencia del prototipo:** `index.html:3211-3222`. **Nativo:**
`apps/mobile/src/modules/onboarding/PantallaOnboarding.tsx` (montado por el `Guard` de
`apps/mobile/app/_layout.tsx:97-98`).

**Precondición del dato:** una cuenta que **no** haya cerrado el onboarding. Con el usuario canónico ya
cerrado el gate no aparece: usar el reset de onboarding del seed (`scripts/e2e*`/`deploy/copiloto`) o una
cuenta recién creada. Si no se puede resetear → `NO_MEDIBLE` con el motivo escrito, **no** `COHERENTE`.

| # | Acción | Esperado (medir con `$D hay`) |
|---|---|---|
| 1 | Abrir la app con la cuenta sin onboarding cerrado | `onboarding` visible |
| 2 | `$D hay onboarding-tarjeta-servicios` | tarjeta «Servicios conectados» |
| 3 | Si hay servicios conectados: `$D hay onboarding-recibo-servicios` | el **Recibo del chat** (no una píldora de texto) |
| 4 | `$D hay onboarding-insight` y `$D ver --filtro "facturado"` **[ver]** | texto del insight sale del backend; anotar el literal |
| 5 | `$D tocar onboarding-chip-detalle` («Armame el detalle») | entra al **hilo** con el pedido dicho (antes: sólo `onEntrar`); `$D hay chat-view` |
| 6 | Foto de los pasos 2 y 5 | `onb-cumplida-1.png`, `onb-cumplida-2.png` |

**Veredicto por divergencia** (las 6 del mapeo; ya resueltas en código según `2026-10-13-veredicto-onb-cumplida-chat-frontend1.md`, falta verlas en el teléfono; el veredicto de la FILA es el peor de las 6):
`#1` pantalla completa sin «Hoy» → `COHERENTE` si se ve como gate (la enmienda ya está escrita) · `#2` recibo real →
paso 3 · `#3` umbral del insight → paso 4 (anotar literal) · `#4` pregunta «…el detalle de quiénes son?»
→ paso 4 · `#5` «Armame el detalle» entra al hilo → paso 5 · `#6` botón «Entrar» → `$D hay
onboarding-entrar-botones`.

**Retorno:** `adb shell input keyevent KEYCODE_BACK` **sólo si** la pantalla lo admite; si el gate está
activo, BACK sale de la app (se fue al home en la medición de backend). Re-abrir con
`adb shell monkey -p app.copiloto.emprendedor 1`.

---

## `preg` — respuesta con card de datos («Vendiste $52.000 · 4 ventas»)

**Prototipo:** `index.html:3224-3231`. **Nativo:** el mapeo del 12-10 decía **NO EXISTE** (la respuesta
llega como texto plano, sin componente de card de resultado). **Medir de nuevo en código antes de
device**: `rg -n "estadistica|resultado" packages/core/src/chat apps/mobile/src/modules/chat | head`. Si
sigue sin componente, el veredicto **no necesita device**: `DESVÍO` con el literal que muestra
el nativo.

| # | Acción | Esperado |
|---|---|---|
| 1 | En el chat, `$D tocar chat-composer`, escribir `cuánto vendí esta semana` (`adb shell input text`, espacios como `%s`) y `$D tocar chat-enviar` | respuesta del asistente |
| 2 | `$D ver --filtro "Vendiste"` **[ver]** | ¿hay una card (Tile con kv) o sólo burbuja? |
| 3 | Foto | `preg-1.png` |

La capacidad «promo masiva a clientes» que el hilo del proto supone **no existe** (cero hits de `promo` en
`apps/mobile`): `FUERA-DE-REFERENCIA` sólo si el operador acepta que no se modela; si no, `DESVÍO`.

---

## `pres-voz` — dictar un presupuesto

**Prototipo:** `index.html:3351-3355`. **Nativo:** `chat/ChatView.tsx:182-191` + `chat/Burbuja.tsx:69-91`
(chip «Por voz · m:ss» dentro de la burbuja) y, desde Presupuestos, `PantallaPresupuestos.tsx:148-153,227`.

| # | Acción | Esperado |
|---|---|---|
| 1 | En el chat: `$D mantener boton-voz 2500` y soltar. Texto a decir (o reproducir): «Presupuesto para Panadería La Esquina, pintura de local, ochenta mil pesos» | transcripción enviada |
| 2 | `$D hay chat-bubble-voz` | burbuja del usuario con chip «Por voz · Ns» |
| 3 | `$D ver --filtro "Por voz"` **[ver]** | formato del chip: `m:ss` (proto) vs `Ns` (nativo, mapeo) — anotar el literal |
| 4 | Esperar el turno del asistente (≤ 30 s, polling de `/reply`) | «Dale. ¿Qué le cotizás?» o la card de presupuesto propuesto |
| 5 | Ir a **Presupuestos**, mantener `boton-voz` allí | divergencia declarada: abre `FormularioPresupuesto` con la transcripción cruda, no el diálogo del hilo |
| 6 | Fotos de 2 y 5 | `pres-voz-1.png`, `pres-voz-2.png` |

**Si el dictado no transcribe** (micrófono del emulador / permiso): el paso 1 queda `NO_MEDIBLE` con el
motivo. No sustituir por escribir el texto: eso mide otro camino (nombre con dos referentes).

---

## `vozchat` — dictado de un gasto y card de confirmación

**Prototipo:** `index.html:2898-2922,3569`. **Nativo:** `chat/ChatView.tsx:182-191`, `chat/Burbuja.tsx`,
`chat/TarjetaGastoPropuesto.tsx`.

| # | Acción | Esperado |
|---|---|---|
| 1 | En el chat, `$D mantener boton-voz 3000` diciendo «gasté cincuenta mil en mercadería a Distribuidora Sur» | burbuja con chip «Por voz · Ns» |
| 2 | `$D hay gasto-guardar` (card propuesta) | card editable (`FormularioGasto`), no filas kv con «Editar» |
| 3 | `$D ver --filtro "todavía no lo anoté"` **[ver]** | texto «Esto entendí. Revisalo y tocá Guardar — todavía no lo anoté.» |
| 4 | **Arrastrar para fijar:** `$D arrastrar boton-voz 0 -220 10` (sube 220 px) | la grabación queda fija; botones flotantes Pausar/Enviar |
| 5 | `$D tocar gasto-guardar` | `$D hay gasto-propuesto-guardado` → «Gasto anotado: $50.000,00» |
| 6 | **Segundo toque sobre la misma card ya respondida** (SM-D5): `$D tocar gasto-guardar` otra vez | **no** reenvía: sin segunda escritura (verificar en `/gastos`: una sola fila) |
| 7 | Fotos de 1, 3 y 5 | `vozchat-1.png` … `-3.png` |

El paso 6 acredita en device lo que SM-D5 dejó `DOD-PARCIAL` por falta de device: **cerrar SM-D5 con
esta evidencia**, citando la foto y el id de la fila de gasto.

---

## Cómo se devuelve (para que cuente)

1. **Un `avance_` por lote** (no por id) a `coordinacion/`, con por id: veredicto, `medido_contra:`,
   archivo de foto, y la salida `[ver]` pegada **sin resumir**.
2. Correr `python -I -X utf8 scripts/evidencia/falta-en-mobile.py` y pegar el delta: la ficha SM-F3 se
   cierra **cuando esos 4 ids dejan de aparecer**, no cuando el `avance_` lo dice.
3. Logcat a **archivo completo** si algo se cae (`adb logcat -b all -d > run.txt`); nunca por `tail`.
4. Dejar el device como estaba: sesión del usuario canónico abierta, app en Mi día, `adb reverse` según
   lo encontraste.

## Lo que esta receta NO sabe (a propósito)

- Las **coordenadas** de nada: el helper busca por `testID`. Si un testID no aparece en `$D ver`, el
  elemento no está expuesto a accesibilidad → anotarlo como defecto de la app (afecta TalkBack), no
  adivinar un `(x,y)`.
- El texto exacto del insight del onboarding y la respuesta del agente: los pone el backend vivo; por
  eso los pasos pegan el literal en vez de afirmar uno.
