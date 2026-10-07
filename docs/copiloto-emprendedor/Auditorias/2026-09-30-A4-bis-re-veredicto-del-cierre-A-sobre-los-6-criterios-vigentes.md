# A4-bis · Re-veredicto del Cierre A — sobre los **6 criterios vigentes**, no los 4 de A4

**2026-09-30** · **Emite:** auditoría · responde
`2026-09-30_contrato_planificacion-a-auditoria_A4-bis-los-tres-motivos-del-cierre-A-resueltos-re-emitir-veredicto.md`

**SHA medido:** `origin/main` @ `e147e873` (2294 archivos en el árbol).
**Prod medido:** deploy `2026-09-29T20:02:39Z`, backend anclado a `8c3dbede`
(`DEPLOY-MANIFEST.jsonl`, último de 4); `apps/copiloto-web`, `packages/core` y `deploy/*` salieron del
working tree con `archivos_sucios_en_paths_no_verificados: 0`. Bundle vivo: `index-bwqf9TEQ.js`
—distinto del `index-BXDl2uCf.js` que midió A4—, o sea **prod cambió desde el 22/09**.

---

## 0 · Corrección de forma, antes del veredicto: el contrato pide medir un Cierre A **derogado**

El contrato dice «re-emitir el veredicto del Cierre A **con sus 4 criterios**». Esos 4 son los del
contrato del **22/09**. Medido sobre `origin/main`:
`docs/copiloto-emprendedor/2026-09-29-acta-redeclaracion-cierre-a-y-plan-de-cierre.md:36` **re-declaró
el Cierre A con 6 criterios** («El Cierre A re-declarado — 6 criterios, todos medibles hoy»), sacando el
nº5 con este motivo, que es el mismo que uso más abajo: «**un criterio de cierre que contiene algo
declarado fuera de alcance no puede cumplirse nunca**» (`:15`).

**Mido los 6 vigentes.** Un veredicto sobre los 4 viejos habría salido verde en más filas y no habría
significado nada.

**Y una colisión de numeración que conviene no heredar:** los «ítems **#9 / #2 / #6**» del contrato son
ítems del *backlog de cierre*, no los criterios §13. **#2** (texto legal) y **#6** (contrastes `--core`)
son **dos BL del criterio 2**, no dos criterios. Leer «#2 resuelto» como «criterio 2 resuelto» es el
error que esta numeración invita a cometer.

---

## 1 · Veredicto binario: **el Cierre A NO cierra** — 3 criterios en ❌

| # | criterio (acta 29/09 §2) | veredicto medido hoy |
|---|---|---|
| 1 | Todos los `DEC` con acta | 🟢 **13 de 13** actas (`DEC-1..DEC-13`, ids distintos en el acta). ⚠️ Ver H-A4b-4: `DEC-11` está firmado «sin excepción» y **no se aplicó** — pero el criterio pide *acta*, y la hay; el incumplimiento cae en el criterio 2. |
| 2 | Todos los ítems de §3.1 cerrados con su DoD | ❌ **3 de 66** ítems `BL-*` tienen DoD completo · **16 casillas tildadas contra 217 vacías**. Y la cifra **no mide trabajo**: ver §2.2. |
| 3 | Matriz `BL-Q5` ✅ en web **y mobile** para los 54 spec | ❌ El `54 de 54 (100%)` mide **una de las dos** dimensiones que el criterio exige. Ver §2.1. |
| 4 | `smoke_beta_e2e.py` verde contra prod (`BL-Q2`) **y** durabilidad (`BL-B1`) | ❌ **por mitades:** `BL-Q2` ✅ **37/37 PASS · 0 FAIL · BETA-READY**, corrido por auditoría hoy 11:11:17Z. `BL-B1` ❌ — ver §2.3. |
| ~~5~~ | ~~APK preview en device~~ | ⚫ fuera del Cierre A (acta 29/09), reafirmado por la orden del operador. |
| 6 | `*.otf` vacío · gitleaks verde | 🟢 **0 `.otf` de 2294** archivos (control positivo del lector: **748** `.ts/.tsx` ⇒ no está ciego) + gitleaks `no leaks found` en el `pre-push` de hoy sobre esta rama. |
| 7 | Runbook de Cierre B (§13) en `main` | 🟢 **con deuda viva:** el token de 60fps.design que el operador retiró de la cola el 29/09 sigue nombrado en el plan (**2 menciones**). El acta ya lo declaraba como deuda; no se corrigió. |

---

## 2 · Los tres ❌, con la medición que los sostiene

### 2.1 · Criterio 3 — el número que lo declara cumplido no mide lo que el criterio pide

La fuente canónica es explícita:
`docs/copiloto-emprendedor/2026-09-21-backlog-beta-odobi-con-dod.md:1041` — «la matriz re-medida
(`BL-Q5`) da ✅ en **web y mobile** para todas las pantallas marcadas spec … **54 ids**».

El `54 de 54 (100%)` que el PLAN y el contrato citan sale de `scripts/evidencia/contar-veredictos.py`.
**Medido: ese script no distingue plataforma.** Un grep insensible de `mobile|plataforma|platform`
sobre sus 1480 líneas devuelve **4 hits, todos** nombres de archivo del corpus o comentarios en prosa —
**cero uso estructural**. Un id con veredicto en web y nada en mobile cuenta como cubierto.

> ⚠️ **CADUCÓ el 2026-10-05, medido por el mismo rol que lo escribió.** El párrafo de arriba era correcto el 30/09 y hoy **ya no**: `contar-veredictos.py` **sí** distingue plataforma desde **`515d50f6`** (el squash de #770, del 2026-10-05), que agregó el campo `agregado_por_plataforma`. La señal del cambio está en el propio tamaño del archivo: acá se midió sobre **1480 líneas** y el de `main` tiene **2591**.
>
> **El veredicto ❌ del criterio 3 NO cambia — cambia la causa.** Con el campo ya publicado, la cifra por plataforma es **web 50 de 54 (92%)** y **mobile 13 de 54 (24%)**, y la que el acta pide —web **y** mobile— es **9 de 54**, u **8 de 54** exigiendo comparación real en ambas. Lo que falta hoy no es que el lector distinga: es que **mobile no tiene cierre** (`mobile_*` aparece 0 veces en el script contra 10 de `web_*`: sin techo, sin faltantes nombrados, sin acción). Detalle y controles → `2026-10-05-la-cifra-que-declara-cerrado-el-criterio-3-es-la-que-el-instrumento-rotula-no-es-la-cifra-del-criterio.md`.

**Y la dimensión mobile no se puede contar con el corpus de hoy.** Lo intenté dos veces y **las dos
veces el control positivo salió rojo**, así que no publico ninguna cifra:

| intento | qué medía | por qué no sirve |
|---|---|---|
| v1 | el id y la palabra «mobile» en la misma fila | **falso positivo masivo**: `apps` dio **111** filas, porque el path `apps/mobile/…` trae los dos tokens. Y **falso negativo**: el doc de FE1 titulado «5 ids» aportó **1** fila. |
| v2 | columna `plataforma` localizada por cabecera | **11 tablas / 40 filas** en 2085 `.md`; el doc de FE1 aportó **0** — no usa esa columna. |

La causa es una convención partida: FE2 declara `| plataforma |` con valor `web`/`mobile`
(`cierre_frontend2…BL-Q3-v2-lote-B-11-de-11-completo.md`), y FE1 lo escribe dentro de `medido_contra`
—«`leido@` (mobile, código de hoy)»— con columna `dimension`
(`2026-09-29_cierre_frontend1…poblacion-C-mobile-5-ids-y-correccion-de-mapeo.md`). **Con dos formatos y
ningún lector común, la cobertura mobile no tiene número**, y el que se cita en su lugar es de web.

Lo que **sí** queda medido, y corrige las dos puntas: el backlog anota «**mobile entero en 0**»
(`:985`), y eso **ya no es cierto** —FE1 midió 5 ids en mobile el 29/09 y FE2 declaró 7 como «ambas»—
pero **54 tampoco lo es**.

### 2.2 · Criterio 2 — el backlog no se tilda cuando el trabajo cierra

Medido sobre `origin/main`, **66 de 66** ítems `BL-*` con sección propia, contando la casilla en
cualquier posición de la línea (el backlog usa **dos** formatos: lista `- [ ]` e **inline**
`- **DoD:** [x] …; [x] …`):

```
DoD COMPLETO (>=1 [x], 0 vacias) : 3 de 66   -> BL-P4 BL-P7 BL-Q1
con al menos una casilla VACIA   : 61 de 66
SIN ninguna casilla de DoD       : 2 de 66   -> BL-J1 BL-X8
casillas: 16 marcadas / 217 vacias
control POSITIVO 1 — BL-P4 (el acta afirma "[x] con evidencia"): marcadas=2 vacias=0  ok
control POSITIVO 2 — BL-B1 (leido a mano como "[ ]")          : marcadas=0 vacias=4  ok
control NEGATIVO  — BL-ZZ9 inventado: False                                          ok
```

**Mi primer lector dio `1 de 66` y era falso**: exigía la casilla al inicio del ítem y no veía el
formato inline. Lo cazó el control contra el acta, que afirma `BL-P4`/`BL-P7` tildados — el v2 encuentra
**exactamente esos dos**, más `BL-Q1`.

**Pero la cifra correcta tampoco mide trabajo.** A4 verificó ✅ `BL-D4…D8`, `W11`, `W12`, `X8` con
evidencia el 22/09 y **sus casillas siguen vacías**. O sea: **el criterio 2 es inauditable con su propio
instrumento** — 16 casillas de 233 en un sprint donde el 21/09 se mergearon 85 PRs en un día no describe
el trabajo, describe el tildado. Es la patología que el backlog **ya se había nombrado a sí mismo** en
`BL-Q5:985`: «sería el DoD envejeciendo en silencio».

### 2.3 · Criterio 4 — `BL-Q2` cierra hoy; `BL-B1` es el moat sin evidencia

**`BL-Q2` ✅, medido por mí:** `bash scripts/run-smoke-prod.sh`, con los blobs de
`deploy/copiloto/smoke_beta_e2e.py` y `scripts/run-smoke-prod.sh` verificados **idénticos a
`origin/main` por hash** antes de correr (`3fa38ef4…` / `03a47c7a…`).

```
# smoke beta e2e · 2026-09-30T11:11:17Z · host=unreal-copilot
total=37 pass=37 fail=0
VEREDICTO: BETA-READY (criticos verdes)
[cleanup] tenant rows borrados=1 · trauma fabricado borrado=1 · gotrue user borrado
```

Cubre alta con invite-token fail-closed (403 sin token), login, `/me`, catálogo, `/warm`, chat simple y
ReAct, OAuth de Composio y MP, refresh, **7 adversariales de admin → 403**, la consola completa con 2
mutaciones auditadas y su fila de auditoría íntegra, reintento de trauma, y 3 artefactos del bundle
**con control negativo horneado** (string imposible → 0 ocurrencias).

**`BL-B1` ❌.** Leí las **37** líneas `[PASS]` completas (control positivo: el lector ve 37 de 37) y
**ninguna ejercita durabilidad** — no hay restart de worker, continue-as-new ni corte. Y el backlog lo
dice sin ambigüedad (`:775-781`): DoD `[ ]` sin marcar, «el disparador era *el próximo deploy de backend
que reinicie el worker por mérito propio*. Desde el 13/08 hay **10 commits** desplegados y
`scripts/e2e_g6_durabilidad_worker_restart.py` **nunca se corrió después**. Es la evidencia del moat del
producto.»

**No lo corrí yo, y el motivo es de lane, no de pereza:** el DoD exige un restart **real** del worker de
prod con una conversación y un HITL en vuelo. Es una mutación del único entorno vivo, y `BL-B1` declara
**Plataforma: backend**. Auditoría mide; no reinicia prod por iniciativa propia. Fila con dueño y
disparador exacto en §3.

---

## 3 · Hallazgos — filas para asignar (auditoría no abre trabajo)

| # | Sev. | Qué | Dueño · disparador |
|---|---|---|---|
| **H-A4b-1** | **alta** | El criterio 3 se declara cumplido con un instrumento que no mide su dimensión mobile, y la dimensión mobile no tiene lector común (dos convenciones). O el criterio se acota a web, o hace falta una convención única de plataforma **exigida al escribir** (primero el que escribe la declara, después el que lee la usa). | instrumento y convención: **planificación** · acotar el criterio: **operador** (cambia la definición de terminado) |
| **H-A4b-2** | **alta** | `BL-B1` sin evidencia: el script existe y no corre desde el 13/08. Es el moat del producto. | **backend** · disparador: el próximo restart de worker (un deploy), corriendo `scripts/e2e_g6_durabilidad_worker_restart.py` con conversación + HITL en vuelo |
| **H-A4b-3** | media | El backlog no se tilda al cerrar: 16 de 233 casillas, con trabajo verificado ✅ por A4 cuyas casillas siguen vacías ⇒ criterio 2 inauditable. | **planificación** · tildar contra la evidencia ya publicada, o declarar que el criterio 2 se mide por otra vía |
| **H-A4b-4** | media | `DEC-11`, firmado «sin excepción» el 21/09, **no se aplicó**. Medido: `apps/mobile/src/modules/chat/BotonVoz.tsx:323-325` sigue con `glass.accent2 → color.acento → color.acento` e isotipo en `acentoTexto`, mientras su hermano `HudGrabacion.tsx:60` ya usa `[tema.glass.ub1, tema.glass.ub2]`. El fix existe en el repo y no se replicó. El acta lo declara en su actualización del 29/09: «no es deuda de documentación». | **FE1** (código) · la elección de camino, si se aparta del fix de fill, es del **operador** |
| **H-A4b-5** | baja | `apps/copiloto-web/src/auth/login.css:34` documenta «4,38:1» — el ratio del token **viejo**. Medido con fórmula WCAG (control positivo negro/blanco = 21,00:1; negativo, color contra sí mismo = 1,00:1): `--core` vigente `#A5462B` sobre `--bg #EFE6D2` = **4,82:1**; el reemplazado `#B04A2E` = **4,38:1**; el oscuro `#DE7250` sobre `#1E1610` = **5,63:1** (dentro del 5,33-6,30 declarado). El ítem #6 **cierra mejor** de lo declarado, pero su cita de evidencia apunta a un comentario caducado, y un comentario así confirma para siempre lo que ya no es. | **FE2** · actualizar el comentario al token vigente |
| **H-A4b-6** | info | El contrato atribuye las 2 mediciones al **PR #751**; medido: #751 está MERGED 07:16:26Z con **9 archivos, todos código y tests** (`TarjetaComprobante.tsx`, `facturacion.css`, `api/afip.ts`, 5 `.test.*`) — **ninguna medición ni captura**. Las mediciones **sí existen**, en `cerrado/2026-09-30/…cierre_frontend2…C3-2-mediciones-mas-A2b…` (`A-1 factura/wizard` y `A-2 card-presu`, ambas **FUERA-DE-REFERENCIA**, con evidencia y el detalle de que `presupuesto-230` hoy converge por TTL, no por el bug). El ítem #9 se sostiene; la cita no. Y el propio contrato declara el hueco: ese `cierre_` está **fuera del corpus** que da 54/54. | **planificación** · citar el `cierre_`, no el PR |

---

## 4 · Lo que NO afirmo

- **No re-medí ninguna pantalla.** Los veredictos de `factura`/wizard y `card-presu` son de frontend2;
  los leí, no los reproduje.
- **No afirmo que falte trabajo en los 61 ítems con casillas vacías.** Afirmo lo contrario de lo que
  parece: que la casilla no informa. Cuántos están realmente abiertos no lo mide este instrumento.
- **No corrí `BL-B1`**, ni toqué prod más allá del smoke, que tiene cleanup propio verificado.
- **No conté la cobertura mobile.** Dos lectores, dos controles positivos rojos, cero cifras publicadas.
- **No verifiqué los 5 `a-todos` restantes** ni re-medí el criterio 7 más allá de la presencia del §13 y
  las 2 menciones del token retirado.
- **No re-medí el criterio 1 más allá de las actas.** Que las 13 existan no dice que las 13 decisiones
  se hayan aplicado — `DEC-11` es la prueba de que son cosas distintas.
