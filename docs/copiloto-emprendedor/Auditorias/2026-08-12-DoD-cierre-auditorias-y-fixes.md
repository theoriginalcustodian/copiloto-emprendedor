# DoD — cierre de auditorías **y** de sus fixes, hasta e2e funcionando

**Redactado:** 2026-08-12 12:02 · **planificación** · **modo: autónomo, sin operador presente.**
**Estado:** documento **normativo**. Los contratos del buzón lo citan; no lo repiten.

> **Para qué existe.** El operador se retiró con una orden: *"cada auditoría arrojará datos para luego
> implementar los fixes… hay que terminar todo, auditorías e implementación, dejar todo listo, probado
> e2e y funcionando"*. Una auditoría que produce un informe y no un sistema arreglado **no cumple** esa
> orden. Este archivo fija el criterio binario de "terminado" para todo el ciclo, para que cada sesión
> sepa cuándo parar sin preguntarle a nadie.

---

## 0. La regla que gobierna a todas las demás

**Un hallazgo no cierra cuando se documenta. Cierra cuando el sistema real deja de tenerlo y algo lo
prueba.**

Corolario operativo, aplicable sin excepción:

| Estado | Qué significa | ¿Cierra? |
|---|---|---|
| Documentado | está escrito en un informe | ❌ |
| Arreglado | el código cambió | ❌ |
| Testeado | hay un test verde | ❌ **si el test pasa igual sin el fix** |
| **Verificado** | hay un test que **falla sin el fix y pasa con él**, + evidencia contra el sistema real | ✅ |

El precedente propio: [[no-romper-no-es-arreglar]] — un gate que sólo comprueba "no rompe" da verde
sobre un sistema que no arregló nada. Y [[instrumentos-que-confirman-en-vez-de-verificar]]: 5 de 35 PRs
de un frente entero existieron porque el instrumento mentía, no porque hubiera features.

**Prueba de control negativo (obligatoria en todo fix de esta ronda):** revertir el fix mentalmente o
con `git stash`, correr el test, **ver que falla**. Si no falla, el test no prueba el fix — se reescribe.
Esa observación se asienta en el `avance_`, en una línea. Sin ella, el ítem queda `[UNVERIFIED]`.

---

## 1. DoD **global** — cuándo está "todo listo" (binario, 8 ítems)

Esto es el techo. Nadie declara el ciclo terminado sin los 8.

- [ ] **G1.** Las 3 pasadas de auditoría corrieron y cada una dejó su informe en
      `docs/copiloto-emprendedor/Auditorias/` con hallazgos con `path:línea`.
- [ ] **G2.** Los **11 hallazgos del backlog histórico** están en estado terminal: `RESUELTO+VERIFICADO`
      o `DIFERIDO` con dueño, fecha y entrada de deuda. **Ningún ⚠️ PARCIAL sobrevive** — parcial no es
      un estado terminal, es un pendiente disfrazado.
- [ ] **G3.** Todo hallazgo **nuevo** de las pasadas 1–3 clasificado P0/P1/P2 y con el mismo trato: los
      P0 y P1 arreglados y verificados; los P2 con dueño + fecha.
- [ ] **G4.** **C4.1 cerrado** (registro abierto). Es bloqueante de beta por sí solo: sin esto no se
      declara nada listo, aunque los otros 7 ítems estén verdes.
- [ ] **G5.** Gate propio **6/6 verde** sobre el `main` final, con recibo `.ci-recibos/<sha>.json`.
- [ ] **G6.** Desplegado a prod **y** smoke e2e contra prod pasando, con el usuario canónico
      `e2e-device@copiloto.test` (ver §4).
- [ ] **G7.** **Cero regresión funcional**: todo lo que la beta ya hacía, lo sigue haciendo. Los fixes de
      seguridad son los de mayor riesgo acá (un gate mal puesto rompe el login).
- [ ] **G8.** Informe de cierre único que consolide las 3 pasadas + el estado final de los 11 + los
      nuevos, y actualice el `README.md` de `Auditorias/`.

---

## 2. DoD **por fase** — el ciclo que cada hallazgo recorre

Todo hallazgo, venga de donde venga, atraviesa las mismas 4 fases. Un contrato del buzón nombra el
hallazgo y la fase; el criterio no se re-escribe.

### Fase A — Hallazgo (lo produce la sesión de auditorías)

Un hallazgo es aceptable **sólo si trae las 4 cosas**:

1. **`path:línea`** contra `origin/main` (`git show origin/main:<path>`, **nunca** el working tree — hay
   checkouts 200+ commits atrasados en este filesystem).
2. **Escenario de fallo concreto:** entradas/estado → salida incorrecta o daño. No "podría ser inseguro".
3. **Severidad** P0 (bloquea prod) / P1 (bloquea beta ampliada) / P2 (deuda con fecha).
4. **Clase, no sólo instancia:** ¿el mismo defecto está en otros N lugares? El grep que lo responde va
   en el hallazgo. Un fix de instancia sobre un defecto de clase es un parche —
   regla de oro nº2, *resolver de raíz*.

**Se rechaza sin discusión:** hallazgo sin `path:línea`, hallazgo teórico sin escenario, y hallazgo que
re-descubre algo ya documentado en `2026-08-12-reverificacion-beta.md` (eso es quemar tokens, no auditar).

### Fase B — Contrato (lo baja planificación)

Un hallazgo aceptado se convierte en contrato en `coordinacion/abierto/` con: evidencia, sesión dueña,
severidad, DoD binario, y **fuera de alcance** explícito. Sin dueño nominado, un hallazgo no avanza:
queda en el informe para siempre.

### Fase C — Fix (lo ejecuta la sesión dueña)

- [ ] Causa **raíz**, no síntoma. Si hay un gemelo sano en el código, el fix se alinea con él en vez de
      inventar un tercer patrón.
- [ ] **Test que falla sin el fix** (control negativo de §0, asentado en el `avance_`).
- [ ] Si el hallazgo es de **clase**: todas las instancias arregladas, o las no arregladas listadas con
      motivo. Un barrido a medias reabre el hallazgo dentro de un mes.
- [ ] **Si es un control de autorización/aislamiento** → **test adversarial de integración obligatorio**
      (actor A intenta el recurso de B → espera denegación), contra Postgres real, no mocks. Regla dura
      del `CLAUDE.md` global §Seguridad. Sin él, el control queda `[UNVERIFIED]` **aunque esté
      desplegado**: el happy-path verde pasa igual si el aislamiento no existe.
- [ ] Gate 6/6 + PR mergeado.

### Fase D — Verificación (cierra el hallazgo)

- [ ] Desplegado a prod.
- [ ] **Probado contra prod vivo**, no sólo en CI.
- [ ] Estado actualizado a `RESUELTO+VERIFICADO` en el informe de la pasada.
- [ ] `avance_` en el buzón con la evidencia — **no la autoevaluación**. "Anduvo bien" no es evidencia;
      el output del comando sí.

---

## 3. Reparto por sesión — quién es dueño de qué

Cuatro sesiones en paralelo sobre el mismo repo. El reparto evita el choque de la mañana, donde dos
sesiones trabajaron el mismo frente sin verse ([[el-buzon-no-ve-lo-que-otra-sesion-ya-hizo-en-main]]).

| Sesión | Dueña de | Regla de borde |
|---|---|---|
| **auditorías** | Pasadas 1, 2 y 3. Produce hallazgos (Fase A). **Read-only sobre el código.** | **No implementa fixes.** Corre con modelo caro: no re-deriva lo ya sabido, no explora sin scope. |
| **backend** | Fixes en `apps/copiloto/`, `motor/`, `deploy/`, tests. Dueña de **C4.1**. | Única que aplica migraciones y toca prod. |
| **frontend** | Fixes en `apps/copiloto-web/` y `apps/mobile/`. Dueña de **C6**. | No toca backend. |
| **planificación** (yo) | Triaje, contratos, prioridad, informe de cierre, memoria. | **No implementa código.** |

**Estado compartido (una sola dueña):** migraciones, servicios vivos, prod, memoria del proyecto y
numeración de ADRs → **backend**. Cualquier otra sesión que necesite tocarlos escala por buzón; no
asume exclusividad.

**Regla anti-colisión, obligatoria al abrir cualquier frente y otra vez antes de pushear:**
`git fetch && git log origin/main --oneline -10 && gh pr list --state all --limit 10`.
El buzón refleja lo que alguien **anunció**; `main` refleja lo que alguien **hizo**.

---

## 4. DoD de la verificación e2e (§G6) — qué significa "probado e2e"

Un smoke que sólo verifica que el server levanta no es e2e. El mínimo aceptable, con el usuario canónico
**`e2e-device@copiloto.test`** (ninguna sesión elige otro):

- [ ] **Login** por email/password **y** por Google — el camino bueno sigue vivo **después** del gate de
      C4.1. Es el control positivo: el riesgo nº1 de esta ronda es blindar el registro y romper el acceso.
- [ ] **Chat** ida y vuelta con respuesta del agente (el producto).
- [ ] **Un flujo de negocio completo** de punta a punta (factura AFIP o presupuesto), incluyendo su
      persistencia.
- [ ] **Aislamiento multi-tenant vivo:** un segundo tenant no ve nada del canónico. Adversarial, contra
      prod, no en test unitario.
- [ ] **Durabilidad:** una conversación sobrevive a un restart del worker — es *el moat* del producto; si
      no se prueba, no se está probando lo que nos diferencia.
- [ ] Salida pegada en el `avance_`. Sin output, no ocurrió.

---

## 5. Autonomía — cómo se decide sin operador

El operador no está. **El default es ejecutar, no esperar** ([[ejecutar-autonomo-no-esperar-si-dale]]):
merges y deploys están autorizados de forma permanente, y toda decisión **táctica** la toma la sesión
dueña con criterio, sin pedir permiso.

**Lo que NO se decide en ausencia** (es MAYOR): cambiar el alcance de la beta, tirar abajo una decisión
ya tomada por el operador, romper compatibilidad de un contrato externo, o gastar dinero.
→ No bloquea: se **estaciona** en `coordinacion/abierto/` como `decision_<tema>.md` con opciones y
recomendación, se sigue con lo demás, y el operador lo resuelve al volver.

**Ante duda de severidad, se elige la mayor y se sigue.** Un P1 tratado como P0 cuesta tiempo; un P0
tratado como P2 cuesta la beta.

**Anti-ocio:** una sesión sin trabajo asignado no espera — toma el siguiente ítem de su columna en §3, o
pide por buzón. Girar en vacío es el failure mode caro de esta arquitectura de 4 sesiones.

---

## 6. Lo que este DoD deliberadamente NO exige

Para que nadie infle el alcance en ausencia del operador:

- **No** exige cobertura de tests por porcentaje. Exige tests que *fallen sin el fix*.
- **No** exige refactors de arquitectura. Los hallazgos de diseño se documentan como deuda con dueño.
- **No** exige performance óptima. Exige que no haya cotas ausentes ni fugas de recursos (Pasada 2).
- **No** exige cerrar los frentes MAYORES abiertos (OAuth propio de Google, ingesta real al grafo).
  Están fuera de esta ronda y requieren decisión del operador.

---

## 7. Índice de contratos de esta ronda

| Contrato | Sesión | Estado |
|---|---|---|
| `contrato_planificacion-a-backend_C4-1-cerrar-signup-abierto` | backend | 🔴 abierto (P0) |
| `contrato_planificacion-a-auditoria_pasada-1-seguridad` | auditorías | por bajar |
| `contrato_planificacion-a-auditoria_pasada-2-robustez` | auditorías | por bajar |
| `contrato_planificacion-a-frontend_C6-cotas-de-lista` | frontend | por bajar |

Planes de cada pasada:
[Estrategia](2026-08-12-ESTRATEGIA-tres-pasadas-de-auditoria.md) ·
[Pasada 0](2026-08-12-pasada-0-triaje-y-capas-de-CI.md) ·
[Pasada 1](2026-08-12-pasada-1-seguridad.md) ·
[Pasada 2](2026-08-12-pasada-2-robustez.md) ·
[Pasada 3](2026-08-12-pasada-3-pulido-y-eficiencia.md) ·
[Re-verificación pre-beta](2026-08-12-reverificacion-beta.md)
