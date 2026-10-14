# Receta · medir en device los dos flujos nuevos de `SM-E3` (imputar un gasto · anotar una tarjeta)

> **Para quién:** la sesión que tenga el device libre (hoy frontend2; el device es de dueño ÚNICO) o el
> operador. **Escrita por planificación, sin tocar el teléfono** — todo lo de abajo sale de leer el
> código mergeado (`ddd68358` y `274af593`), no de haberlo corrido.
>
> **Estado:** sin ejercitar en device. Una receta no ejercitada es una promesa: §0 es el control que la
> acredita o la invalida.
>
> **Reemplaza la prosa del `contrato_` del 14-10.** Ese contrato describía los pasos en texto; el
> instrumento lo marcó `PROSA PURA` y tenía razón: sin testIDs ni comandos, el que corre la receta
> tiene que reconstruirla, y reconstruirla es decidir otra vez.

## Qué entrega

**7 veredictos** del vocabulario cerrado de `scripts/evidencia/contar-veredictos.py:645`
(`COHERENTE` · `DESVÍO` · `NO_MEDIBLE` · `FUERA-DE-REFERENCIA` · `NO_REPRODUCIBLE_SIN_EFECTO` ·
`REQUIERE_TRIAGE`; `PENDIENTE_DEVICE` **no** cuenta como comparación), cada uno con
`medido_contra: <sha de /healthz>` y la captura del paso decisivo. Con los 7 escritos en un `cierre_`,
SM-E3 pasa de 🟧 DOD-PARCIAL a TERMINADO (es lo único que le falta además de `cambiar-email`, que está
bloqueado en el operador por SMTP).

## §0 · Precondiciones — medilas, no las supongas

```bash
python -I -X utf8 scripts/evidencia/device_medir.py autotest   # control positivo del instrumento, OFFLINE
adb devices                                                    # exactamente 1 línea
curl -s https://copilotoemprendedor.duckdns.org/healthz        # el sha de prod = medido_contra
```

🔴 **El control que esta receta NO puede saltearse.** El device corre **lo que Metro sirve**, no `main`
(`memoria/el-device-no-corre-main-corre-lo-que-metro-sirve.md`). Los dos flujos de abajo **no existen**
antes de `ddd68358` / `274af593`, así que servir un checkout anterior mide una app sin ellos y produce
un `DESVÍO` **falso**:

```bash
# en el checkout que sirve Metro:
git merge-base --is-ancestor ddd68358 HEAD && echo "OK imputacion"  || echo "FALTA ddd68358"
git merge-base --is-ancestor 274af593 HEAD && echo "OK alta tarjeta" || echo "FALTA 274af593"
```

Si alguno dice `FALTA`, **no se mide**: se sirve un checkout que los incluya. Un veredicto tomado sin
este control no acredita nada.

Resto de precondiciones, iguales a las demás recetas de device:

- **Usuario canónico `e2e-device@copiloto.test`** — el único; ningún agente elige otro.
- **Animaciones del sistema en valor normal** (`adb shell settings get global animator_duration_scale`
  → 1.0): apagarlas cambia lo medido.
- **Sólo `input motionevent`** (DOWN/MOVE/UP) — el helper ya lo hace. **Nunca `input tap`**: las
  opciones del selector son `Pressable` de *gesture-handler*
  (`apps/mobile/src/theme/glass/campos/CampoSelect.tsx:16,61`) y `input tap` no ejercita RNGH.
- **Un solo adb.** Si otra sesión lo tiene, esta receta no se corre.

Helper: `D="python -I -X utf8 scripts/evidencia/device_medir.py"` — `$D ver --filtro <texto>` lista
`testID | texto | centro`; `$D hay <testID>` sale 0/1; `$D tocar <testID>`; `$D foto <archivo>`.
**`[ver]`** significa «pegá la salida de `$D ver` en el `cierre_`»: es evidencia, no resumen.

---

## Receta A · imputar un gasto a su trabajo — 4 veredictos

**Nativo:** `apps/mobile/src/modules/gastos/DetalleGasto.tsx` (`BloqueTrabajo`, líneas 93-227).
**Gemela web:** `apps/copiloto-web/src/modules/gastos/DetalleGasto.tsx` — mismo core, sólo difiere el JSX.
**Backend:** `PUT /gastos/{id}/imputacion` (`apps/copiloto/gastos_web.py:161`), lectura en
`GET /gastos/{id}` (`b392389b`).

**Precondición del dato:** el tenant canónico necesita **≥1 gasto** y **≥1 trabajo imputable**
(presupuesto / comprobante / cobro). Si la lista sale vacía (`detalle-gasto-trabajos-vacio`), el
veredicto es **`NO_MEDIBLE` con el motivo escrito**, nunca `COHERENTE`: una lista vacía se ve igual
desde afuera que una que no carga.

| # | Acción | Esperado (`$D hay` / `$D ver`) |
|---|---|---|
| 1 | Abrir **Gastos** y tocar un gasto sin imputar | `$D hay detalle-gasto-trabajo` |
| 2 | `$D ver --filtro "Sin imputar"` **[ver]** | `detalle-gasto-sin-imputar` con el literal «Sin imputar: este gasto no le baja el margen a ningún trabajo.» |
| 3 | `$D tocar detalle-gasto-imputar` | aparece `detalle-gasto-trabajos` (o `-cargando` y después la lista) |
| 4 | `$D ver --filtro trabajos-opcion` **[ver]** y tocar **el id que salga** | ⚠️ el testID de cada opción es `detalle-gasto-trabajos-opcion-<eslabon>:<ref>` (`DetalleGasto.tsx:89-91` + `CampoSelect.tsx:59`): el `<ref>` es dato del tenant y lleva un `:` adentro. **Se lista, no se construye** — un id fabricado por quien escribe la receta no se distingue de uno real |
| 5 | `$D hay detalle-gasto-trabajo-imputado` + `$D foto sme3-A-imputado.png` | el `Dato` «Trabajo» con la etiqueta del destino |
| 6 | 🔴 **Persistencia:** cerrar el detalle, volver a abrir el **mismo** gasto | sigue mostrando `detalle-gasto-trabajo-imputado`. Este paso es el que separa «la UI pintó» de «el backend guardó» — sin él el veredicto acredita el render, no la capacidad |
| 7 | `$D tocar detalle-gasto-desimputar` y repetir el paso 6 | vuelve a `detalle-gasto-sin-imputar`, y **sigue así** tras reabrir |

**Veredictos A** (uno por fila, el peor manda en la fila):

- **A1 · estado inicial honesto** — paso 2: el gasto sin imputar lo *dice*, no lo deja en blanco.
- **A2 · la lista trae trabajos reales del tenant** — paso 4, con el `[ver]` pegado.
- **A3 · imputar PERSISTE** — pasos 5-6. Si pinta y no persiste: `DESVÍO`, no `COHERENTE`.
- **A4 · desimputar persiste** — paso 7. El camino de vuelta es parte de la capacidad: sin él, un error
  de imputación es irreversible desde la app.

**Si el PUT falla** (sin red, backend caído): `detalle-gasto-trabajo-error` tiene que mostrar el texto;
si en vez de eso la UI queda mostrando el trabajo como imputado, es `DESVÍO` — es exactamente el defecto
que el PR del alta de tarjeta arregló del otro lado.

---

## Receta B · anotar una tarjeta a mano en Mi Día — 3 veredictos

**Nativo:** `apps/mobile/src/modules/midia/PantallaMiDia.tsx:384-403`. **Gemela web:**
`apps/copiloto-web/src/modules/midia/MidiaScreen.tsx`. **Backend:** `POST /mi-dia/tarjetas` vía
`crearTarjetaMiDia` (`packages/core/src/api/miDia.ts:240`).

El bloque de alta **está siempre visible** (campo + botón «Agregar»): no hay que abrir nada.

| # | Acción | Esperado |
|---|---|---|
| 1 | Abrir **Mi día**: `$D hay midia-alta` y `$D hay midia-alta-texto` | el campo «Anotar algo para hoy», placeholder «Llamar al proveedor» |
| 2 | 🔴 **Campo vacío:** `$D ver --filtro Agregar` **[ver]** sin escribir nada | «Agregar» **deshabilitado** (`deshabilitado: vacio || guardando`, `PantallaMiDia.tsx:399`). Si está habilitado y al tocarlo no pasa nada, es el defecto que este PR vino a arreglar: prometer sin dar |
| 3 | `$D tocar midia-alta-texto`, escribir `Llamar al proveedor de harina` (`adb shell input text`, espacios como `%s`) y `$D tocar midia-alta-enviar` | la tarjeta entra |
| 4 | `$D ver --filtro "harina"` **[ver]** + `$D foto sme3-B-tarjeta.png` | la tarjeta aparece dentro de `midia-lista`, y `midia-contador` sube en 1 |
| 5 | 🔴 **Persistencia:** salir de Mi día y volver (o `adb shell monkey -p app.copiloto.emprendedor 1`) | la tarjeta **sigue ahí** |

**Veredictos B:**

- **B1 · el campo vacío no promete** — paso 2. Es el DoD del PR: el 400 del backend pasó a ser **estado
  de la UI** en vez de una promesa que falla después.
- **B2 · la tarjeta entra y se ve** — pasos 3-4, con el `[ver]` y la foto.
- **B3 · la tarjeta PERSISTE** — paso 5. Igual que A3: sin esto se acredita el render, no la escritura.

---

## Cómo se devuelve (para que cuente)

1. **Un `cierre_` a planificación** con los **7** veredictos (A1-A4, B1-B3), cada uno con
   `medido_contra: <sha de /healthz>`, su archivo de foto y el `[ver]` pegado **sin resumir**.
2. El `cierre_` tiene que **nombrar el id `SM-E3`** en el cuerpo. No es formalidad: el forense del
   14-10 midió que **18 de 26 fichas nunca fueron nombradas** por ninguna sesión, y por eso el registro
   no se marcaba — los ids propios (`KVCAIDASALE`, `A7`) no entran al circuito de cierre.
3. **Nadie marca la ficha a mano.** Con el `cierre_` escrito, el marcado lo hace
   `python -I -X utf8 scripts/sprint-estado.py --marcar SM-E3 --estado TERMINADO --cierre "<...>"`, y el
   gate `--check` rechaza un TERMINADO cuyo sha no sea ancestro de `origin/main`.
4. Logcat a **archivo completo** si algo se cae (`adb logcat -b all -d > run.txt`); nunca por `tail`.
5. Dejar el device como estaba: usuario canónico abierto, app en Mi día, `adb reverse` como lo encontraste.

## Lo que esta receta NO sabe (a propósito)

- **Las coordenadas de nada.** El helper busca por `testID`. Si un testID de los de arriba no aparece en
  `$D ver`, el elemento no está expuesto a accesibilidad → es un defecto de la app (afecta TalkBack) y se
  anota como tal; **no se adivina un `(x, y)`**.
- **El `<ref>` de los trabajos del tenant** (paso A4) y el texto del insight: los pone el backend vivo.
  Por eso los pasos piden pegar el literal en vez de afirmar uno.
- **Si el tenant canónico no tiene trabajos imputables**, A2-A4 son `NO_MEDIBLE` con el motivo, y hay que
  decirlo en el `cierre_`: la ficha no cierra con 7/7 inventados. Sembrar el dato es trabajo de backend
  (hay `scripts/` de seed en `deploy/copiloto`), y pedirlo es un `pedido_`, no una decisión del que mide.
