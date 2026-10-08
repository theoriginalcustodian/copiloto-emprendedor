# Muestreo adversarial del punto 2 de §13 — veredicto: NO CIERRA

> **Qué es esto.** El cierre del punto 2 de `§13` del backlog de la beta, por el método que `DEC-18`
> firmó el 2026-10-08: **no se tildan 53 casillas, se muestrean 10 ítems de forma adversarial.**
> Contrato: `contrato_planificacion-a-auditoria_el-punto-2-cierra-por-MUESTREO-ADVERSARIAL-de-10-items-no-tildando-53-casillas`.
> **Sujeto medido:** `origin/main` @ **`00a14413`**. **Medido por:** sesión AUDITORÍA, 2026-10-08.
> **Veredicto binario: el punto 2 NO cierra — 3 de los 10 ítems muestreados tienen residuo real,
> asignable hoy, que el cierre trata como no-asignable.**
>
> **🔻 Corregido el 2026-10-08, **12 minutos** después de mergear este doc: eran 4, son 3.** `BL-O6`
> salió del punto 2 por un diferimiento que el operador firmó el **21/09** y que mi filtro de
> exclusión no vio, porque esa fila del acta **no tiene número de `DEC-*`** (`§8`). Sus dos
> defectos **siguen vivos** y sus dos filas `H-*` siguen en pie — lo que cambia es que **el punto 2
> no los mide**. El veredicto binario **no se mueve**: 3 de 10 refutan el «0 asignables» igual, y
> el 🔴 más grave (`BL-B1`, el instrumento que acredita el moat) nunca fue `BL-O6`.

**Control de vigencia del sujeto, corrido antes de publicar** (la regla que esta misma sesión pagó
hoy: la refutación de una afirmación puede vivir dentro de la base elegida). Medí en un worktree a
`28e80ba1`; `origin/main` avanzó a `00a14413` mientras trabajaba. `git log 28e80ba1..00a14413 -- <path>`
sobre los **6 paths de los 4 falsos** devuelve **0 commits en todos**; el control positivo del mismo
instrumento (`-- docs/`) devuelve **2**. Las mediciones valen en `00a14413`. Además verifiqué el
**frente vivo** de fe2 (`origin/fe2/bl-o6-legal-parte-a-y-parte-b-web`), que sí toca `legal.ts`
(`d91f6786`): **no cambia** el texto del §5 — el falso de `BL-O6` no está en vías de arreglarse.

---

## 0. Inventario de lo existente (regla: inventario antes del diseño)

No se construyó instrumento nuevo. Lo que ya existía y se usó tal cual:

| instrumento | dónde | qué dio hoy |
|---|---|---|
| extractor de DoD | `scripts/backlog-dod-gap.py` (354 líneas, read-only salvo un `git fetch --quiet`) | **77 ítems · VERIFICADO=7 · DERIVABLE=58 · SOLO-CASILLA=0 · SIN-SEÑAL=12**, con sus 3 controles en verde (positivo real 11 ítems · negativo `#999999` · `sin_casillas` `BL-J1`/`BL-X8`) |
| el texto de cada ítem | `docs/copiloto-emprendedor/2026-09-21-backlog-beta-odobi-con-dod.md` (1191 líneas, 77 encabezados `### BL-…`) | los 11 ítems elegidos se ubicaron **por id**, 11/11, con control negativo (`BL-Z99` → 0) |
| el DoD base | ese backlog, `§0.4` (líneas 106-149) | 9 casillas que aplican a **todo** ítem de código además del propio |
| los excluidos con firma | ese backlog, `§12.bis` (creada por `DEC-18`) | 6 `BL-O`: `O1`, `O2`, `O3`, `O4`, `O5`, `O7` |

---

## 1. Cómo elegí los 10 — el criterio, escrito para que se pueda repetir y criticar

El contrato pide **sesgo adversarial**: *«preferí los que más probablemente estén falsos — los
`DERIVABLE` con muchas casillas sin tildar y PR viejo. Si buscás donde es difícil y no encontrás
nada, el resultado vale; si buscás donde es fácil, no mide nada.»* El criterio que apliqué, en orden:

1. **Puntaje primario: casillas sin tildar, descendente.** Más sub-DoD declarado = más superficie
   para que algo no esté. Los dos máximos del backlog (**6 casillas**) entraron los dos.
2. **Desempate: PR más viejo, ascendente.** Más tiempo desde el PR = más distancia entre lo que el
   PR hizo y lo que la casilla dice hoy.
2.bis **Desempate fino: punto ciego conocido del gate.** Entre dos ítems de igual puntaje preferí
   el que cae donde el gate **no puede ver**. Por eso tomé `BL-D2` (523) y no `BL-D1` (522), que es
   un PR más viejo: `BL-D2` es un **gesto táctil**, y el gate corre en `jsdom`, que no ejercita
   gestos (`memoria/gate-jsdom-no-ve-gestos-tactiles.md`) — un verde ahí no acredita nada. `BL-D1`
   además comparte materia con `BL-J1`/`K-01` (clave de idempotencia), que es uno de los 3 falsos
   positivos **ya medidos**, así que medirlo repetiría hallazgo. **Escribo el desempate porque sin
   él mi tabla diría «de los más viejos» y eso, solo, no explica por qué salté al 522.**
3. **Cobertura: las 9 familias**, con **a lo sumo 2 por familia**, para que el muestreo no mida una
   sola capa del producto. Cubiertas 9 de 9; la única familia con 2 es `BL-J`, y son exactamente los
   dos ítems de 6 casillas del punto 1 — el sesgo eligió, no yo.
4. **Excluidos con firma, no por conveniencia:** los 6 `BL-O` de `§12.bis` (`DEC-12`, `DEC-17`) y los
   3 falsos positivos **ya medidos y anotados** en `main` (`BL-C5`, `BL-P2`, `BL-J1`) — volver a
   medirlos sería contar dos veces un hallazgo que ya tiene dueño.
   > **🔻 Acá está el defecto de mi propio criterio, corregido el 08/10 (`§8`).** Corrí este
   > filtro contra **`§12.bis`** del backlog y contra el cuerpo del punto 2, que **indexan por
   > `DEC-*`**. El acta del 21/09 difiere `BL-O6` en una fila cuya **columna de decisión es «—»**:
   > sin id, no entra en ningún índice que se consulte por id, y su propio ítem no la citaba.
   > **El filtro de alcance se corre contra el acta, no contra el índice derivado del acta.**

**Y una elección deliberada contra mi propio sesgo:** metí `BL-P7`, que es el **único** de los 10 con
las casillas **tildadas**. Los otros nueve están sin tildar, así que para ellos «falso ✅» es una
pregunta sobre el residuo; para `BL-P7` es una afirmación explícita que se puede refutar. Un muestreo
que sólo mira lo no-tildado no puede cazar una casilla mentirosa.

### Los 10

| # | id | familia | sin tildar | PR | por qué este, según el criterio |
|---|---|---|---|---|---|
| 1 | `BL-P7` | P | **tildado** | — | el único con casillas tildadas ⇒ el único refutable de frente |
| 2 | `BL-D2` | D | 4 | 523 | **gesto táctil**: el gate corre en `jsdom` y no lo ejercita ⇒ su verde no acredita (ver desempate 2.bis) |
| 3 | `BL-C6` | C | 5 | **530** | 5 casillas y el PR **más viejo** de los de 5; toca autorización por tenant |
| 4 | `BL-W11` | W | 5 | 550, **630** | 5 casillas y **dos** PR ⇒ se tocó dos veces, superficie de drift |
| 5 | `BL-F1` | F | 4 | 562 | «componente compartido» ⇒ clase donde el fix llega a una sola copia |
| 6 | `BL-J9` | J | **6** | 588 | **máximo de casillas del backlog**; incluye precedencia y adversarial |
| 7 | `BL-J11` | J | **6** | **554** | el otro máximo, con el PR más viejo de los dos; toca auth |
| 8 | `BL-B1` | B | 4 | 603 | su DoD **afirma evidencia** — la clase más auditable y la que más miente |
| 9 | `BL-O6` | O | 3 | 678 | ~~el único `BL-O` con señal **no** excluido por firma~~ → **era falso: sí estaba excluido** (acta 21/09, fila sin `DEC-*`). Medido igual, y los defectos existen — pero **el punto 2 no los mide** (`§8`) |
| 10 | `BL-Q3` | Q | 3 | 623 | es un ítem que **audita a otros**: si él es falso, arrastra los que acredita |

### El control positivo, elegido por un criterio DISTINTO — y por qué eso importa

`BL-Q1` · *Control de paridad web ↔ mobile en CI* · **6/6 casillas tildadas**, clase `VERIFICADO`.

**No lo elegí con el puntaje adversarial, y eso es a propósito.** Si el control positivo saliera del
mismo criterio que los 10, compartiría su constructo y no probaría nada: un control que comparte el
defecto del instrumento **absuelve en vez de cazar** — lo pagué hoy mismo, dos veces, y está escrito
en `memoria/vacio-no-es-hallazgo-correr-el-control.md` §Refuerzo (d). El criterio independiente acá
es **«lo sé cerrado por evidencia de primera mano»**: el check de paridad corrió **verde en los 6/6
jobs de cada PR que mergeé hoy**, así que si mi método da rojo sobre `BL-Q1`, el roto es el método.

**Resultado del control: VERDE.** Las 6 casillas están, corrí sus tests (`test-testid-paridad.sh` →
**16 checks ✅**) y el gate real (`--check` → `473 excepciones vigentes, 0 sin cubrir, 0 obsoletas`,
exit 0). Único desvío: **cifras que envejecieron** — baseline **473** hoy vs. 484 que cita el ítem;
ids dinámicos **662** (407 mobile / 255 web) vs. 656 (402/254). Drift por código nuevo, no defecto.
⇒ **El método reconoce un verde real; sus rojos no son un artefacto del método.**

---

## 2. Alcance de la medición — declarado, porque cambia el veredicto

`§0.4` del backlog impone 9 casillas base a todo ítem de código, y **tres de ellas (4 deploy, 5
evidencia de device/PWA, 8 re-medición de la matriz) no son medibles en esta sesión**: la orden del
operador del **2026-09-22** difirió device y EAS al sprint siguiente, y el contrato de `DEC-18` acota
el muestreo a *«el DoD de cada uno contra **código / VPS**»*.

**Entonces, qué cuenta como «falso ✅» acá.** No la casilla sin tildar — `DEC-18` punto 1 ya
estableció que la casilla mide el ritual de tildar, no el trabajo. Lo que el punto 2 afirma, en el
propio `§13`, es: *«residuo verificado fila por fila, **0 asignables**»*. Por lo tanto:

> **Falso ✅ = un ítem cuyo residuo es trabajo real, asignable hoy, que el cierre está tratando como
> no-asignable.** No lo es: lo que ya está hecho · lo diferido por firma nombrada · lo que sólo falta
> verificar en device.

Esa distinción es la que hace que el muestreo mida el **producto** y no el diferimiento de device.
Si se midiera `§0.4`.5 al pie de la letra, los 10 saldrían falsos y el resultado diría únicamente
«no hay device» — que ya está decidido y escrito.

⚠️ **Y lo digo acá porque invierte el veredicto si el operador lee distinto:** **8 de los 10** tienen
al menos una casilla de device. Con el alcance de arriba, esas casillas no condenan. Con el alcance
literal de `§0.4`, el punto 2 **no puede cerrar en este sprint** por construcción — y entonces la
discusión no es de auditoría, es de firma. **Eso ya tiene fila y no la vuelvo a abrir:
`H-PUNTO2INCUMPLIBLE`**, una de las 6 que `#977` enumera como «nombran el punto 2». Lo que agrego
acá es que el veredicto **no se apoya** en esa lectura (ver `§4`).

**Nota de severidad del veredicto:** los 3 falsos de abajo **no dependen de esa lectura**. Ninguno
es una casilla de device: son tres de código/test y uno de texto publicado. El veredicto «no cierra»
se sostiene con el alcance **más permisivo** de los dos.

---

## 3. Los 10, uno por uno

Cada fila lleva el path y la línea **reales de hoy**, no las que cita el backlog: **6 de las citas
del backlog envejecieron** y están listadas en `§5.3`.

### 3.1 `BL-P7` — NO falso · el trabajo está; la casilla contiene una medición que envejeció

Casilla 1 («cada uno movido a `cerrado/<fecha-original>/`»): **está** para el universo citado —
`find abierto -name '2026-09-0[78]_*'` → **0** (control positivo: `find abierto -type f | wc -l` =
**49**, el instrumento ve). Casilla 2 afirma que *«`abierto/` sólo contiene trabajo vivo, todos del
22/09»*: hoy `abierto/` tiene **49** archivos, **0** con fecha 09-22 — 1 del 10-05, 8 del 10-06, 17
del 10-07, 23 del 10-08.

**No es falso ✅:** lo contratado (mover los viejos) se hizo. Lo que falló es que la casilla
**fechó una medición dentro del DoD**, y una medición se vence. Es el patrón
`el-dod-que-escribi-estaba-mal-y-la-evidencia-lo-corrigio`. El dato de los 49 va al janitor (`§5.2`).

### 3.2 `BL-D2` — NO falso · código y tests en ambas plataformas; falta device

Umbral y cancelación: mobile `apps/mobile/src/modules/chat/BotonVoz.tsx:34-35` (`UMBRAL_CANCELAR_PX`),
`:265-267`, `:178-186`; aviso `ChatView.tsx:252-253`. Web `MicButton.tsx:22` (`CANCEL_THRESHOLD_PX=80`),
`:252-257`, `:274-275`. Toque corto: `BotonVoz.tsx:41` (`DURACION_MINIMA_MS = 350`) con test
`BotonVoz.test.tsx:221-232` (349 ms → `onCancelar`, 350 → `onSoltarSinFijar`). Web `MicButton.test.tsx:178,199`.
Residuo: **sólo** la casilla 3 (gesto por `adb input motionevent`) y la captura PWA ⇒ device.

### 3.3 `BL-C6` — NO falso · el guard y su adversarial están, para la rama que el guard cubre

El chequeo real está en **`apps/copiloto/afip_web.py:208-217`**:

```python
vinculado = await asyncio.to_thread(cred.ambientes_vinculados, body.cuit)
if not vinculado and await asyncio.to_thread(cred.primer_cuit) is not None:
    raise conflicto(CUIT_NO_VINCULADO, "Ese CUIT todavía no está vinculado a tu cuenta de ARCA.")
```

Adversarial: `apps/copiloto/tests/test_afip_cuit_vinculado_pg.py:54-64`
(`test_ADVERSARIAL_A_no_toma_prestado_el_CUIT_vinculado_de_B`, 409 `cuit_no_vinculado`, control
positivo 200 con su propio CUIT). La UI está en las dos plataformas (web `PantallaAfipSetup.tsx:369-383`,
mobile `:530-556`), y el botón «Cambiar» del título del ítem **ya no existe en ninguna**
(`queryByTestId('afip-perfil-cuit-cambiar')` → `toBeNull` en ambos tests).

**Hallazgo estrecho, no falso ✅** (`§5.1`, `H-C6ALTAEXENTA`): el guard es **asimétrico por rama** —
si el tenant **no tiene ningún** CUIT vinculado (`primer_cuit() is None`), el alta inicial queda
**exenta** y el test adversarial ejercita sólo la rama guardada. No es explotable para emitir: el
gateway exige certificado del store **del propio tenant** (`_gateway_con_certificado(cliente_id, cuit)`).
El comentario de `:208-213` justifica la exención por **UX del alta**, no por autorización — y la
regla dura del repo dice que un control sin test adversarial del caso hostil queda `[UNVERIFIED]`.

### 3.4 `BL-W11` — NO falso · las 4 casillas medibles están

Fecha: web `MidiaScreen.tsx:196` (`data-testid="midia-fecha"`), mobile `PantallaMiDia.tsx:519-520`,
helper compartido `packages/core/src/midia/fechaMiDia.ts:19`. Caída de Calendar: web `:327-335`,
mobile `:557-572`, con tests de los tres estados en ambas (`MidiaScreen.test.tsx:101,114,133` ·
`PantallaMiDia.test.tsx:342,394,353/445`). Aviso de caja: `packages/core/src/midia/caja.ts:70-71`
nombra **Mercado Pago**, con test `caja.test.ts:50-53` y backend coherente
(`inteligencia_queries.py:217`, sólo MP). Matiz, no residuo: *«ofrece reconectar»* es **texto**
(«Reconectala en Ajustes → Apps»), sin botón ni link. Residuo: captura PWA ⇒ device.

### 3.5 `BL-F1` — NO falso, con una ambigüedad que planificación tiene que zanjar

Hay **un `Recibo` por plataforma** y no hay gemelos: web `design-system/Recibo.tsx:41`, mobile
`chat/Recibo.tsx:26`. Los homónimos de `Onboarding.tsx:164` y `PantallaOnboarding.tsx:170` son una
**función local de un paso de onboarding** con otras props (`estiloContenedor`, `onEntrar`): colisión
de nombre, no segunda implementación. Lo usan factura, gasto, ingreso, presupuesto, cliente y el HITL
genérico; `TarjetaPropuestaShell.tsx:76-77` es un wrapper de una línea, no una copia.

**Lo medido con instrumento validado:** **ningún check visual en ninguno de los dos** — `grep -Ei
'check|✓|✔|Icon|Svg|Path|Circle'` → **0 en ambos**, con **control positivo de 96 archivos** del repo
que sí matchean `Svg|Icon`. El tono `exito` se comunica **sólo por color** (mobile
`tema.color.exito` + `fontWeight 600`; web la clase `propuesta-card--exito`).

**Por qué NO lo cuento como falso:** el texto de la casilla dice *«con check `aria-live`, título,
líneas secundarias y acción»*, y eso admite dos lecturas — «un **check** (marca visual) y
`aria-live`» o «el **check de** `aria-live`». Bajo la segunda, la casilla está cumplida: el anuncio
está en los dos (`role="status" aria-live="polite"` web `:45`; `accessibilityLiveRegion="polite"`
mobile `:33`) con test en ambos. **No inflo el conteo de falsos con una ambigüedad del contrato**:
va como pedido de aclaración + hallazgo de accesibilidad (`§5.1`, `H-COLORSOLO`).

Matiz que sí es real y no condena: la **API es asimétrica** — web tipa `lineas` y `accion`, mobile
los recibe por `children` (`TarjetaFacturaPropuesta.tsx:142-146` mete `DatosComprobante` y
`AccionesComprobante`). A nivel render la acción existe; a nivel contrato del componente, no.

### 3.6 `BL-J9` — **FALSO ✅ (1 de 3)** · falta la mitad «el replay intacto» de la casilla 4

La casilla 4 pide *«test de regresión en el motor con ambos órdenes **y el replay intacto**»*.

- **Los dos órdenes: están.** `motor/backend/agent/test_gate_card_precedencia_bloquea.py` (102 líneas)
  tiene **4** tests: `:73` control sólo-sugerencia, `:80` sugerencia→conexión, `:87`
  `test_CONTRATO_conexion_primero_sugerencia_despues_gana_conexion`, `:95` dos que bloquean.
- **El replay: no existe.** `grep -in replay` en ese archivo → **0**. Control positivo del mismo
  grep en el mismo directorio → **6 archivos** lo usan. El instrumento ve; la mitad falta.

**Por qué importa y no es formalismo:** la precedencia vive bajo
`workflow.patched("gate-card-precedencia-bloquea")` (`conversation_workflow.py:654-670`), y
`memoria/patched-se-memoiza-por-run-un-fix-con-patch-no-llega-a-sesiones-vivas.md` documenta que
`patched()` **se memoiza por run**: el `False` del replay se pega hasta el `continue-as-new`. El
mecanismo que la casilla manda a probar es exactamente el que ya mordió en el caso A3 (#607 anidado
bajo #570). **Residuo: un test de `Replayer` en el motor. No necesita device ni VPS.**

> **Y una nota sobre mi propio instrumento:** mi primer `grep -c '^def test'` sobre ese archivo dio
> **0** y casi reporté «el archivo no tiene tests». El ancla `^` no matchea `async def`. Lo cazó el
> control positivo (26 en otro test del motor). Está en `§6`.

### 3.7 `BL-J11` — **FALSO ✅ (2 de 3)** · casilla 4: en web «Cerrar sesión» no está en su propio grupo

La casilla dice, sin ambigüedad: *«Cerrar sesión queda en su propio grupo.»*

- **Mobile cumple:** `apps/mobile/src/modules/ajustes/PantallaCuenta.tsx:101-110` lo pone en un
  `FilaBotones testID="cuenta-salir-botones"` aparte.
- **Web no:** `apps/copiloto-web/src/modules/account/AccountScreen.tsx` tiene **10
  `account-screen__row` hermanas y planas** (`:133, :140, :148, :162, :170, :179, :200, :209, :216,
  :223`) dentro de **un solo** `<div className="account-screen__list">` (`:131`). No hay `<section>`,
  no hay `__group`, no hay segunda lista. El CSS confirma que es **un tile único**:
  `account.css:110-116` (`display:flex; border-radius; border; overflow:hidden`) con
  `.account-screen__row:last-child { border-bottom: none }` (`:128-130`). «Cerrar sesión» es la
  última fila del mismo tile, distinguida **sólo por color** (`.account-screen__row-label--danger
  { color: var(--danger-fg) }`, `:156-158`, y el chevron en `--danger-fg`).

**Residuo: agrupar la fila destructiva en web. CSS + JSX, sin device.** Es además incumplimiento de
la casilla 6 de `§0.4` (paridad), medido: mobile agrupa, web no.

**Lo que NO es falso en este ítem, y casi lo reporté como tal:** la casilla 6 («los 8 tests contra
GoTrue real corren en **cada** `gate.sh`») **está cumplida**. `scripts/gate.sh:205-219` provisiona
una GoTrue efímera con `test-gotrue.sh --export`, hace `eval` de los exports y es **fail-closed de
verdad** — leí la rama de error: `else echo "$GOTRUE_EXPORTS" >&2; RESULTADO[backend]="failed"`. El
`skipif` sigue en los tests y `scripts/ci/backend.sh` no define la variable, pero bajo `gate.sh` la
variable existe. **Mi grep por el nombre `UC_TEST_GOTRUE_URL` en `scripts/` devolvió 0 y me habría
hecho declarar la casilla falsa**: la variable **nace de un `eval`** de la salida de otro script, así
que no aparece escrita en ninguna parte de `scripts/`. Ver `§6`.

La casilla 1 («cambiar mail») está **diferida por firma**: `[DIFERIDO_CIERRE_B]` en
`CambiarCredenciales.tsx:93` (web) y `:68` (mobile), *«falta SMTP real + ruta `/auth/v1/verify` en
Caddy. Dueño: operador»*. Deliberado y nombrado ⇒ por `§2` no condena.

### 3.8 `BL-B1` — **FALSO ✅ (3 de 3)** · casilla 4: el instrumento confirma por AUSENCIA, no por la activity

La casilla (A3, `H-A3-8`) pide que el VERDE **discrimine por la activity ejecutada**
(`execute_tool` con `confirmed:true` después del restart). Lo que hay, en
`scripts/e2e_g6_durabilidad_worker_restart.py:159-176`:

```python
repite_confirm = any(c.get("value", "").startswith("confirm:")
                      for r in replies for c in (r.get("choices") or []))
cayo_en_rama_sin_gate = any((r.get("reply_text") or "") == _TEXTO_CALLBACK_SIN_GATE for r in replies)
return not repite_confirm and not cayo_en_rama_sin_gate
```

`grep -n 'execute_tool\|confirmed'` en todo el script → **0 hits** (control positivo:
`_reply_resolvio_el_gate` → **5**). Mejoró respecto de A2 (ya no da verde con el texto de la rama de
fallo), pero **sigue confirmando por la ausencia de dos firmas**: cualquier otro `reply_text` sin
`choices` —un «Listo 👍»— lo pone en verde sin que la activity se haya ejecutado.

**Por qué es el peor de los cuatro:** este es el instrumento que acredita **la durabilidad**, que es
el moat del producto. Un instrumento que confirma por ausencia sobre la propiedad que diferencia al
producto es la clase `instrumentos-que-confirman-en-vez-de-verificar`. Agravante medido: el script
**ya tiene** `--control-negativo` (≈`:288`) que manda el callback sin gate y debe dar ROJO — **y
nadie lo corrió**. Lo que sí está cumplido es la casilla 3: el cableado a `deploy.sh` existe,
bloqueante, con opt-out (`deploy.sh:24-33, 408-426, 518`).

**Residuo: hacer que el verde exija la firma positiva de la activity, y correr el control negativo
que ya existe. VPS, sin device.**

### 3.9 `BL-O6` — **FUERA del punto 2 por acta firmada** · dos defectos VIVOS que el punto 2 no mide

> **🔻 Reclasificado el 08/10, después de mergear este doc.** Lo publiqué como **falso ✅ (4 de
> 4)** y **no lo es**, por alcance y no por medición: la fila final del `§1` del acta del **21/09**
> difiere `BL-O6` a Cierre B *(«**no se enciende todavía**: backups, **legal propio**, horario de
> soporte»)* y **lo nombra por id** en su columna de ítems, junto a `BL-O5` y `BL-O7`. Verificado
> por mí en la fuente, no aceptado de una cita: `2026-09-21-acta-decisiones-beta-odobi.md:29`, y
> repetido en `2026-09-21-plan-implementacion-beta-odobi-autonomo.md:49`. Con `DEC-16` firmado hoy
> (*«un ítem con diferimiento firmado cuenta como FUERA de este cierre»*) y mi propio `§2`
> (*«no es falso ✅ lo diferido por firma nombrada»*), **las dos vías de abajo salen de la cuenta
> del punto 2.**
>
> **Lo que NO cambia:** las dos mediciones siguen siendo correctas y los dos defectos siguen
> **vivos en el producto**. `H-O6CLAVEFISCAL` y `H-O6MOBILEACEPTA` quedan en `§5.1` con dueño.
> Un diferimiento mueve **dónde se mide un ítem**; no borra un texto legal publicado que afirma un
> tratamiento de datos que no ocurre. Por eso esto se reclasifica, no se tacha.

**(a) Casilla 1 — el texto legal publicado afirma un tratamiento de datos que el código no hace.**
`packages/core/src/legal.ts:109-111` («5. Tu clave fiscal.») dice:

> *«Si activás facturación, tu certificado **y clave fiscal** de ARCA **se guardan cifrados** y se
> usan sólo para emitir comprobantes en tu nombre.»*

La frase **mezcla dos secretos con tratamiento opuesto**, y la mitad que nombra la clave fiscal es
falsa. `apps/copiloto/afip_credential_store.py:9-20`:

> *«`AfipCredentialStore` — certificado + clave privada, cifrados. Es lo **ÚNICO** que persiste para
> facturar. […] La clave fiscal de AFIP **NO se almacena** (decisión del operador, 2026-07-21): se
> usa una vez para generar el certificado y se descarta.»*

Existe `AfipSecretHandoff` **precisamente** para que la clave fiscal nunca quede en el event history
de Temporal (claim-check con TTL corto, lectura-y-borrado atómico); `afip_gateway.py:193` repite «no
se guarda en ningún lado». Y la casilla 1 pedía textualmente enunciar **«qué se guarda (la clave
fiscal no)»** — el texto publicado dice lo contrario de lo que la casilla pide **y** de lo que el
código hace. **Severidad alta: es copy legal de cara al usuario, no un comentario interno.**
Verificado que **no está en vías de arreglo**: la rama viva de fe2 toca `legal.ts` y **no cambia**
esa frase.

**(b) Casilla 2 — la aceptación legal no se registra en mobile.** Web sí:
`SignupScreen.tsx:71` llama `api.aceptarLegal(LEGAL_VERSION)` → `web.py:1143` `POST /me/legal/aceptar`
(409 si la versión no es la vigente) → `tenant_legal_store.aceptar()` escribe `legal_version` /
`legal_aceptado_en`. En mobile: `grep -rnE 'legal/aceptar|aceptarLegal' apps/mobile packages` → **0
hits**, con control positivo en web que sí da. Mobile sólo **lee** (`app/legal.tsx`,
`PantallaLegal.tsx`). **Nadie escribe el registro en mobile** — y la regla del repo es grepear quién
**escribe**, no quién lee. La auditoría A4 ya lo había registrado; acá queda re-medido en `00a14413`.

La casilla 3 (retirar el aviso «plantilla genérica») **no condena**: `legal.ts:12-16,27` dicen que
retirarlo es **decisión del operador**, firmada el 2026-09-28 con `LEGAL_DESCARGO` provisorio.

### 3.10 `BL-Q3` — NO falso · los 11 destinos existen; la salvedad es de forma

Casilla 3 («cada diferencia encontrada, ítem nuevo en este backlog»): **no se perdió ninguna
diferencia**. 9 de 11 destinos existen como encabezado `### ` (`BL-X10`, `BL-D4`…`BL-D8`, `BL-W11`,
`BL-W12`, `BL-X8`); `BL-V17` y `BL-V18` existen como **fila de la tabla post-beta `§12`**
(líneas 1039 y 1040), no como `### `. Control con id inventado (`BL-ZZ99`) → 0: el instrumento está
sano. Si la casilla exige encabezado es cuestión de forma, y la decido **no falsa**: el trabajo
—que la diferencia quede registrada y asignable— está hecho. Las casillas 1 y 2 son device.

---

## 4. Veredicto

> ## El punto 2 de `§13` **NO CIERRA**.
>
> **3 de los 10 ítems muestreados** tienen residuo real, asignable hoy, que el cierre trata como
> no-asignable: **`BL-J9`** (casilla 4, la mitad del replay) · **`BL-J11`** (casilla 4, el grupo de
> «Cerrar sesión» en web) · **`BL-B1`** (casilla 4, el verde por ausencia en el instrumento de
> durabilidad).
>
> **Un cuarto, `BL-O6`, lo publiqué como falso y lo retiré de la cuenta el mismo día** (`§3.9`,
> `§8`): sus dos defectos están medidos y **vivos**, pero el acta del 21/09 lo difirió a Cierre B
> y **el punto 2 no lo mide**. Se mantiene fuera de la cuenta **aunque sea el más vistoso de los
> cuatro** — texto legal publicado — porque el alcance lo decide la firma, no la gravedad.
>
> Ninguno de los tres es una casilla de device, así que el veredicto **no depende** de cómo se lea
> `§0.4`.5 (ver `§2`). El control positivo **`BL-Q1` salió verde**, así que los rojos no son un
> artefacto del método.

**Lo que esto refuta, textualmente:** el punto 2 afirma *«residuo verificado fila por fila, 0
asignables»*. Con sesgo adversarial, **3 de 10** tienen residuo asignable — y el peor es el
instrumento que **acredita la durabilidad**, o sea el moat. La tasa no se
extrapola (la muestra está sesgada a propósito hacia donde es difícil), y **no hace falta
extrapolarla**: el punto afirma **0**, y encontrar **1** ya lo refuta.

**Lo que NO afirmo:** que los 53 ítems estén mal, ni que los 6 ítems sanos del muestreo prueben que
el resto lo está. El muestreo mide **la afirmación del punto 2**, no la calidad del backlog.

⚠️ **Y esto retira un veredicto mío de hoy más temprano** — un `cierre_` de esta misma sesión puso el
punto 2 en *«✅ en sustancia, 0 asignables»* con la evidencia de **4 filas**, cuando el punto son
**53 ítems**. Las 4 filas siguen bien medidas; la frase que las reportaba hablaba de un universo más
grande que el que medí. Está en `§7`, con el por qué.

**Por qué la cláusula de corte de `DEC-18` no se le aplica a este veredicto.** La cláusula, en su
versión **corregida** (`#977`, `00a14413` — que es además el SHA que medí), dice que un hallazgo
bloquea sólo si **nombra un punto** *y* **invalida la evidencia de un punto ✅**. El punto 2 **no es
un punto ✅**: lo dice planificación en esa misma corrección, enumerando las 6 filas que lo nombran
— *«el punto 2 **no está ✅**: está en muestreo. No se puede reabrir lo que está abierto»*. Entonces
esto no es un `H-*` cayendo sobre algo cerrado, y no necesita la cláusula para valer: **es la
medición que el punto 2 estaba esperando.** La cláusula sigue intacta para lo que fue escrita.

---

## 5. Lo que queda, con dueño — filas, no trabajo que yo abra

Por el contrato: *«Si un ítem sale falso, **no lo arregles** — nombralo y lo enruto.»* No toqué
ninguno de los ítems medidos.

### 5.1 Filas nuevas para que planificación asigne

| id sugerido | qué | dueño natural | device? |
|---|---|---|---|
| `H-J9REPLAY` | test de `Replayer` para `gate-card-precedencia-bloquea` en el motor (la mitad que falta de `BL-J9` c4) | backend/motor | no |
| `H-J11GRUPO` | «Cerrar sesión» en su propio grupo en web (hoy es la última fila del tile plano; mobile ya lo agrupa) | frontend web | no |
| `H-B1FIRMA` | el VERDE de durabilidad debe exigir la firma positiva de la activity (`execute_tool confirmed:true`), y correr el `--control-negativo` que **ya existe** | backend | no |
| `H-O6CLAVEFISCAL` | **(fuera del punto 2 — `BL-O6` diferido por acta; el defecto sigue vivo)** `legal.ts` §5 afirma que la clave fiscal se guarda cifrada; el código la **descarta** (`afip_credential_store.py:13`). Separar los dos secretos en el texto | fe2 (rama viva de legal) + operador (es copy legal) | no |
| `H-O6MOBILEACEPTA` | **(fuera del punto 2 — `BL-O6` diferido por acta; el defecto sigue vivo)** mobile no registra la aceptación legal (0 hits de `aceptarLegal`); incumple paridad `§0.4`.6 | mobile | no |
| `H-C6ALTAEXENTA` | el guard de CUIT exime el alta inicial y el adversarial sólo cubre la rama guardada; el comentario justifica UX, no autorización ⇒ `[UNVERIFIED]` por la regla dura del repo | backend | no |
| `H-COLORSOLO` | la distinción destructiva/éxito se comunica **sólo por color** en tres lugares medidos (los dos `Recibo` y la fila «Cerrar sesión» web) — WCAG 1.4.1 | frontend ambas | no |
| `H-F1CHECKAMBIGUO` | zanjar si `BL-F1` c1 pide una **marca visual** o el **`aria-live`**: hoy el check visual es 0 en las dos plataformas, el `aria-live` está en las dos | planificación (redacción) | no |
| `H-F1APIASIM` | la API de `Recibo` es asimétrica: web tipa `lineas`/`accion`, mobile los recibe por `children` | frontend ambas | no |

### 5.2 Datos, no hallazgos

- **`abierto/` tiene 49 mensajes** (1 del 10-05, 8 del 10-06, 17 del 10-07, 23 del 10-08) → janitor.
- **`BL-Q1`: cifras envejecidas** — baseline **473** (el ítem dice 484); ids dinámicos **662**
  (407/255) contra 656 (402/254). Y su casilla 1 dice «inventario versionado»: `--inventario`
  imprime a **stdout** aunque el docstring diga «a archivo», y no hay artefacto commiteado
  (`git ls-files | grep -i 'inventario.*testid'` → 0).
- **`BL-Q3` c3:** `BL-V17`/`BL-V18` existen como fila de tabla `§12`, no como `### `.
- **`BL-W11`:** «ofrece reconectar» es texto, sin botón ni link.
- **`BL-F1`:** `comprobante.tsx` no quedó «absorbido» como dice su nota de Evidencia — se **compone**
  como `children` dentro de `<Recibo>`. Y mobile `TarjetaLinkDeCobro.tsx:31-66` mantiene su propio
  `Tile` terminal, aunque no está en la lista de la casilla 2.

### 5.3 Citas del backlog que envejecieron (6 medidas)

| el backlog cita | hoy está en |
|---|---|
| `afip_web.py:183-209` | **`:208-217`** (183-209 hoy es `leer_perfil`/`guardar_perfil`) |
| mobile `PantallaAfipSetup.tsx:550-553` (`setCuitBloqueado(false)`) | **ya no existe**; sólo `setCuitBloqueado(true)` |
| `BotonVoz.tsx:193-207` | **`:265-267`** |
| `inteligencia_queries.py:210` | **`:217`** (210 hoy es un comentario) |
| `caja.ts:63-64` | **`:70-71`** |
| `e2e_g6_durabilidad_worker_restart.py:134-138` | **`:159-176`** |

---

## 6. Lo que este muestreo aprendió sobre sus propios instrumentos

Tres veces el instrumento estuvo a punto de producir un falso **de la auditoría**, y las tres las
cazó un control positivo. Se escriben porque la próxima medición los va a volver a necesitar.

1. **`^` no matchea `async def`.** `grep -c '^def test'` sobre
   `test_gate_card_precedencia_bloquea.py` dio **0** en un archivo con **4** tests. Iba a reportar
   «el archivo no tiene tests» — una acusación falsa. Lo cazó el control positivo (26 en otro test
   del motor). **Contá la forma, no el ancla que te resulta cómoda.**
2. **Una variable que nace de un `eval` es invisible a un grep por su nombre.**
   `grep -rn UC_TEST_GOTRUE_URL scripts/` → **0**, y de ahí iba a concluir que `gate.sh` no la define
   y que los 8 tests de GoTrue se saltean siempre. La define: `gate.sh:209-210` hace
   `eval "$(test-gotrue.sh --export)"`. El grep case-insensitive por **`gotrue`** sí la encontró.
   **Grepeá el mecanismo, no el identificador.**
3. **Un 0 con control positivo en 0 no es un hallazgo.** Mi primer intento de medir el check de
   `BL-F1` dio 0, pero su control positivo (`'Icono'` en el design-system web) también dio **0** ⇒ el
   instrumento no probaba nada. Recién al leer los dos archivos **enteros** (81 y 54 líneas) y correr
   un control que da **96 archivos** el 0 pasó a ser medida. Es
   `memoria/vacio-no-es-hallazgo-correr-el-control.md`, pagado otra vez.
4. **El control de vigencia va ANTES de publicar.** `origin/main` se movió de `52b5cd18` a
   `00a14413` mientras medía, y la rama viva de fe2 toca `legal.ts`. `git log <sha-medido>..<main> --
   <path>` y el diff contra la rama viva son lo que separa «hallazgo» de «noticia vieja». Hoy
   salieron en verde; el día que salgan en rojo, el hallazgo era de antes de mi propia base.
5. **El control de vigencia que corrí vigilaba los paths de la EVIDENCIA, y lo que cambió fue el
   ALCANCE.** Los 6 paths del punto 4 son código y tests — lo que mide el residuo. **El acta y el
   backlog no estaban en la lista**, y ahí vive quién está adentro del punto 2. Salió verde y aun
   así publiqué un ítem **diferido por firma desde el 21/09** (`§8`). Un veredicto envejece porque
   cambió **lo que mide** o porque cambió **quién está adentro de lo que mide**; el punto 4 sólo ve
   la primera.
6. **Una afirmación sobre el instrumento puede ser más amplia que el patrón del instrumento.**
   Publiqué *«en todo el acta, las filas sin `DEC-*` que nombran ids nombran exactamente tres»*
   midiendo con `^| — |`, que sólo ve el guion largo **literal**. Con el patrón amplio son **26
   filas** en 5 actas, en **dos clases** (`§8`). La cifra que dependía de eso **no se movió**, pero
   su razón sí. **Los tres primeros casos de esta lista son del instrumento; estos dos son del
   enunciado**, y no los caza medir otra vez — los caza preguntar **de qué conjunto estoy
   hablando** antes de publicar.

---

## 7. Retiro un veredicto mío anterior sobre este mismo punto — y la razón no es que las filas estuvieran mal

Hoy, más temprano, esta misma sesión emitió
`cierre_auditoria-a-planificacion_punto-2-de-13-verificado-el-residuo-de-4-filas-da-CERO-asignables`
(doc `2026-10-08-punto-2-del-criterio-13-el-residuo-de-4-filas-verificado-una-por-una.md`, medido en
`origin/main @ 557907ea`), y en su recómputo de `§13` escribió:

> | 2 · familias `BL-*` con su DoD | ✅ **en sustancia**, 0 asignables | — |

**Eso queda retirado por este doc.** Y lo importante es **por qué**, porque no es que las filas
estuvieran mal medidas:

- **La evidencia de ese cierre eran 4 filas**, las que `ALCANCE-CIERRE-BETA.md:140-158` marcaba con
  🚨 *«estas 4 filas NO se asignan sin verificarlas una por una»*: `BL-B3`, `BL-B5`, `BL-Q1`,
  `BL-Q3`. Las 4 **siguen bien medidas** — y dos de ellas reaparecen hoy confirmando: `BL-Q1` es el
  **control positivo** de este muestreo y salió **verde**, y `BL-Q3` sale **no falso** otra vez.
- **La afirmación que publiqué era sobre el punto 2 entero**, que son **53 ítems**. 4 filas
  verificadas no autorizan una conclusión sobre 53. **El defecto no está en la medición: está en el
  alcance de la frase que la reporta** — es
  `memoria/dos-causas-suficientes-el-test-no-atribuye` del lado del reporte, y sobre todo
  `de-dos-artefactos-con-distinta-precision-gana-el-que-circula`: si no retiro esa línea, circulan
  dos veredictos sobre el punto 2 y el más optimista es el que ya está archivado como cerrado.
- **La cronología lo confirma, no lo excusa:** `DEC-18` se firmó **después** de ese cierre, y se
  firmó precisamente porque ni tildar casillas ni verificar 4 filas eran la medida del punto 2. El
  método de hoy existe como respuesta a esa insuficiencia; este doc es su primera corrida.

**Qué hago con eso, operativamente:** el `cierre_` de hoy lo dice explícitamente (no lo dejo sólo
acá), y la fila del punto 2 en `§13` **no la toco** — es de planificación, y pisarla sería editar el
artefacto de otra sesión. Lo que entrego es la medición y el retiro de mi propia línea.

**La pregunta que me habría frenado antes de escribirla:** *¿el universo que medí es el universo del
que estoy hablando?* Cuatro filas y cincuenta y tres ítems no son el mismo sujeto, y la frase no lo
decía.

---

**Medido en `origin/main` @ `00a14413`** · sesión AUDITORÍA · 2026-10-08 · método firmado en `DEC-18`.

---

## 8. Corrijo mi propia cuenta el mismo día que la publiqué: eran 4 falsos, son 3

**Qué pasó, en orden y con hora.** Este doc se mergeó a `main` en `dd7a0de9` (**21:02Z**). A las
**21:03Z** entró `#979` (`88bc6f9a`), que entre otras cosas anotó en el ítem `BL-O6` un
diferimiento **firmado el 21/09**. Lo encontré corriendo el control de vigencia **sobre el main
posterior a mi propio merge** — leyendo qué había cambiado, no esperando que alguien me avisara.

**Pero la causa no es `#979`, es mía y es anterior.** El diferimiento no nació ayer: está en la
fila final del `§1` del acta del **21/09**, que nombra **`BL-O5`, `BL-O6` y `BL-O7` → Cierre B**.
Verificado por mí en la fuente y no aceptado de la cita de `#979`:
`2026-09-21-acta-decisiones-beta-odobi.md:29`, repetido en
`2026-09-21-plan-implementacion-beta-odobi-autonomo.md:49`. Es decir: cuando armé el muestreo,
`BL-O6` **ya estaba fuera del cierre por firma del operador, nombrado por id, desde hacía tres
semanas**. Mi `§1`.4 dice *«excluidos con firma»*, y escribí en la tabla de los 10 que `BL-O6` era
*«el único `BL-O` con señal **no** excluido por firma»*. Esa celda era falsa.

### Por qué el filtro no lo vio — y la forma del agujero

El alcance del punto 2 vive en **tres capas**, y yo consulté las dos derivadas:

| capa | qué es | indexa por | ¿tenía `BL-O6`? |
|---|---|---|---|
| el **acta** del 21/09 | la firma del operador | ítems, en la última columna | **sí**, con `BL-O5` y `BL-O7` |
| `§12.bis` del backlog | el índice de lo diferido | **`DEC-*`** | **no** |
| el cuerpo del punto 2 | el criterio que se lee al cerrar | **`DEC-*`** | **no** (decía lo contrario) |

La fila del acta que difiere `BL-O6` tiene la **columna de decisión en «—»**: es una decisión
firmada **sin número**. Y las dos capas que yo consulté se indexan por número. **Una decisión
firmada sin id no entra en ningún índice que se consulte por id**, y entonces no es que esté mal
copiada: es que **no hay nada que copiar**. `BL-O7` sobrevivió sólo porque su ítem cita esa fila
textual a mano; `BL-O5` porque alguien la anotó. `BL-O6` no, y durante tres semanas el criterio del
cierre lo leyó como incumplido.

**La forma del agujero, medida sobre las 5 actas del repo** (`2026-07-02`, `2026-07-22`,
`2026-09-21`, `2026-09-29`, `2026-10-06`) — y son **dos clases** de invisibilidad, no una:

- **Sin id alguno** (primera celda «—»): **1 sola fila** en todo el universo, y es la que nombra
  `BL-O5`, `BL-O6`, `BL-O7`. De los tres, **dos** estaban anotados en su ítem y **uno** no. Esta es
  la que me mordió, y mi muestreo adversarial fue a buscar justo ahí: el sesgo que el contrato
  pedía me llevó al único ítem donde el índice mentía.
- **Con id en otro espacio de nombres:** **18** filas `DA-1`…`DA-10` en el acta del 21/09, **6** en
  la del 29/09 (indexadas por **número de punto del cierre**) y **1** en la del 06/10. Tienen id,
  pero **no `DEC-*`** — así que son **igual de invisibles** a un índice que se consulte por `DEC-*`.
  Y una de ellas **sí difiere**: el punto ~~5~~ tachado del acta del 29/09 saca del Cierre A el
  «APK `preview` build #2 en el device + barrido `BL-Q3`». No me cambia nada (juzgué `BL-Q3` **no
  falso**), pero quien barra el resto del backlog con este control tiene que barrer **las tres
  formas**, no sólo la celda «—».

**Y un segundo registro de `BL-O6`, anterior a mi medición:**
`2026-10-06-lo-que-espera-tu-decision.md:21` ya lo clasificaba **`CIERREB (BL-O6)`** el 06/10. Su
pertenencia a Cierre B estaba escrita en **dos** lugares antes de que yo midiera, y **ninguno de los
dos era el índice que consulté**. Eso hace el diferimiento más sólido y mi error más claro.

### Y una tercera corrección, esta vez sobre el instrumento — por qué el **3** es firme

Lo de arriba salió de correr el **control de ceguera sobre mi propio grep**, después de publicar la
cifra 3. Mi patrón era `^| — |`: sólo veía la celda con el guion largo **literal**. Con el patrón
amplio —cualquier fila de tabla cuya primera celda no sea un `DEC-\d` y que nombre un `BL-*`—
aparecen **26 filas**, no una. **La frase que publiqué sobre mi instrumento era más amplia que el
patrón que el instrumento usaba.**

Eso obliga a cambiar la **razón** por la que el 3 es firme, no el 3. Con el instrumento no ciego,
grepeados los tres falsos contra las **5** actas: **`BL-B1`** aparece en **1** fila — el punto 4 del
criterio del Cierre A (*«smoke verde y `BL-B1` verde sobre el último deploy»*), que es el
**criterio**, no un diferimiento — y en **0** filas con lenguaje de diferimiento; **`BL-J9`** y
**`BL-J11`**, en **0** filas. **Control positivo** del mismo grep sobre `BL-O6`: **2 hits**.

> El 3 **no** se sostiene en «el agujero tenía un solo ocupante» — se sostiene en que **ninguna de
> las 5 actas difiere a ninguno de los tres**, que es la afirmación que de verdad medí.

**Y van tres en un día, las tres sobre el sujeto y ninguna sobre la medición:** `§7`, el universo de
mi afirmación era **más grande** que el medido (4 filas → 53 ítems) · `§8`, el universo que medí
incluía un ítem que la **firma ya había sacado** · y esto, donde la afirmación sobre **el
instrumento** era más amplia que su patrón. El defecto no vive en el dato: vive en **el salto del
dato al enunciado**, y por eso el control que lo caza no es medir otra vez — es preguntar **de qué
conjunto estoy hablando**.

### El control que faltaba, y por qué el que corrí no podía cazarlo

Corrí un control de vigencia **antes** de publicar, y está en la cabecera: `git log <base>..<main>`
sobre **los 6 paths de los falsos**. Ese control vigila los paths de la **evidencia** — el código y
los tests que miden el residuo. No podía ver esto, porque lo que cambió no fue la evidencia: **fue
el alcance**, que vive en el acta y en el backlog, dos paths que nunca puse en la lista.

> **Control nuevo, y corrido ahora para los 10:** antes de meter un ítem en un muestreo del punto 2,
> grepear **su id en el acta**, no en `§12.bis`. Resultado: el acta nombra 3 de mis 10 — `BL-C6`
> (con `DEC-9`, que es decisión **activa**, no diferimiento), `BL-Q3` (en prosa de contexto, sin
> decisión) y `BL-O6` (diferido). **Los tres falsos que quedan dan 0 hits en el acta**, con control
> positivo del mismo grep: el acta nombra **33 ids** distintos. Por eso el 3 es firme y no estoy
> corrigiendo una cifra para volver a corregirla mañana.
>
> **Y el control de vigencia se amplía:** la lista de paths vigilados incluye desde ahora el acta y
> el backlog, no sólo los paths del código medido. Un veredicto puede envejecer porque cambió lo
> que mide **o** porque cambió **qué está dentro de lo que mide**.

### Lo que no hago: tachar

`BL-O6` sale de la **cuenta del punto 2**. Sus dos defectos siguen medidos y **vivos en el
producto**: el texto legal publicado sigue diciendo que la clave fiscal «se guarda cifrada» cuando
el código la descarta, y mobile sigue sin registrar la aceptación. `H-O6CLAVEFISCAL` y
`H-O6MOBILEACEPTA` se quedan en `§5.1` con dueño. **Un diferimiento mueve dónde se mide un ítem; no
desaparece un defecto.** Y se mantiene fuera de la cuenta **aunque sea el más vistoso de los
cuatro** — copy legal de cara al usuario —, porque el alcance lo decide la firma y no la gravedad:
inflar el conteo con un ítem diferido es el mismo error que tildar casillas, con mejor prensa.

### El patrón, que es el de `§7` otra vez y ya van dos en un día

`§7` retiró un veredicto mío porque **el universo que medí no era el universo del que hablaba** (4
filas → 53 ítems). Esto es la misma falla por el otro lado: **el universo del que hablaba incluía un
ítem que la firma ya había sacado**. Las dos veces la medición estaba bien y el **sujeto** estaba
mal. La pregunta que cierra las dos no es *¿medí bien?* sino **¿de qué conjunto estoy hablando, y
quién decide quién está adentro?** — y para el punto 2 eso lo decide un acta, no un índice.
