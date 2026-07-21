# Formato de coordinación de tres sesiones — diseño

> **Fecha:** 2026-07-21 · **Estado:** APROBADO (marco aprobado por el operador; pendiente implementar)
> **Sesión autora:** planificación (la tercera pata) · **Alcance:** montar el formato. **NO** se acomete
> trabajo atrasado en esta iteración.

---

## 1. El problema

Tres sesiones de Claude Code trabajan sobre `copiloto-emprendedor`: **planificación** (esta),
**backend** y **frontend/app**. Se comunican por una carpeta `coordinacion/` que cada una poletea con
un cron cada 3 minutos.

El transporte funciona. Lo que falta es todo lo demás:

1. **No hay plan, sólo reacción.** El trabajo aparece como consecuencia de un bug encontrado en
   device. La cola de qué construir vive en la cabeza del operador. *(Es el dolor que el operador
   nombró: «que la planificación no viva en mi cabeza y que el sistema no dependa de mi control».)*
2. **No hay estado, sólo historial.** 26 archivos en dos días, planos. Saber «¿qué pedido espera
   respuesta ahora?» exige leer los 26 y reconstruirlo mentalmente.
3. **La junta backend↔frontend no tiene dueño.** Éste es el hallazgo central del diagnóstico.

### 1.1 El patrón detrás de los incidentes del 2026-07-21

Los intercambios de ese día no son bugs distintos: son la misma falla repetida.

| Incidente | Qué pasó realmente |
|---|---|
| *Apps era un catálogo de papel* | El endpoint vivía hacía meses; la UI nunca se cableó. Cada lado verificó su mitad. |
| `disconnect_path` | Nadie definió el contrato → frontend asumió un path y lo marcó `[ASSUMED_PENDING_VERIFY]`. |
| El 405 del catch-all | Comportamiento del front-door (`web.py:141`) que ningún lado documentó; se descubrió probando. |
| *«El quinto era mío»* | Un defecto rebotó entre sesiones antes de encontrar dueño. |

Las dos sesiones son rigurosas **dentro** de su mitad. Por eso los defectos no aparecen adentro:
aparecen en la costura. Y como el descubrimiento ocurre en device, el costo es el máximo posible —
implementar, chocar, negociar por buzón, reimplementar.

**Conclusión de diseño:** el rol de la sesión de planificación no es repartir tareas, es **ser dueña
de la junta**. Si el contrato baja definido, las dos sesiones implementan en paralelo contra la misma
verdad y se encuentran funcionando la primera vez.

---

## 2. Lo que NO se toca (ya funciona)

- **El transporte.** Cron de 3 minutos sobre la carpeta. No se rediseña.
- **La convención tipada de nombres** (`pedido_`, `respuesta_`, `hallazgo_`, `dato_`, `listo_`,
  `cierre_`, `addendum_`). Las dos sesiones ya la entienden; se documenta, no se cambia.
- **La cultura de DoD binario con evidencia** (`docs/copiloto-emprendedor/2026-07-20-DoD-sprint-autonomo-e2e.md`):
  criterios verificables, `[DIFERIDO]` explícito, evidencia en `_evidencia/` o no está cerrado.
- **La calidad del contenido de los mensajes.** Contratos leídos, controles corridos, commits citados.

## 3. Origen del diseño: portar, no inventar

El patrón ya existe y está probado en producción por el mismo operador, en **documed**:
`~/.claude/coordination/documed/COORDINACION_SESIONES.md`. Aporta seis piezas que se portan
adaptadas: quién-es-quién · reglas duras de git · estado compartido con dueño único · tabla de
handshakes de contrato · invariantes compartidas · protocolo.

Aporta además la solución a la tensión worktrees↔buzón (§4).

---

## 4. Decisión: el buzón sale del repo

### 4.1 El problema mecánico

`coordinacion/` **está versionada hoy** (commits `docs(coordinacion): …`). `git worktree add`
materializa una copia física de todo lo versionado en cada worktree. Si las sesiones se aíslan en
worktrees, cada una tendría su propia `coordinacion/` y el mensaje de una no existiría para la otra
hasta commit + push + pull. El cron leería una carpeta que nunca cambia.

### 4.2 La decisión

`coordinacion/` **se saca del versionado**: entra a `.gitignore` y se quita del índice con
`git rm -r --cached`, lo que además la elimina del remoto en GitHub. Los archivos quedan en disco.

La carpeta pasa a ser lo que el operador ya la consideraba: **una carpeta física única, independiente
del repo**, apuntada por los tres crones vía **ruta absoluta**:

```
C:\Proyectos\Claude\Claude code\copiloto-emprendedor\coordinacion\
```

**Consecuencias:**
- A prueba de worktrees: no se versiona, no se duplica, no se parte.
- Independiente de la rama activa: cambiar de rama no altera el buzón.
- No ensucia la historia del repo con ~15 mensajes por día.
- **Se pierde el historial versionado de los mensajes.** Aceptado explícitamente por el operador
  («la carpeta no es parte del repo y se puede eliminar de GitHub»). El valor duradero —planes,
  contratos, cierres— se preserva en `docs/`, no en el buzón.

**Caveat a registrar en `COORDINACION.md`:** si alguna sesión llega a trabajar en un worktree y hace
`pull` de la rama donde se ejecutó el `git rm --cached`, git borrará su copia local de
`coordinacion/`. Por eso el buzón **canónico es uno solo** —el del checkout principal— y los crones
apuntan a esa ruta absoluta, nunca a una relativa al `cwd` de la sesión.

### 4.3 Aislamiento del código en worktrees — fuera de alcance

Es una decisión **separable** que no bloquea el formato. Se difiere. El riesgo actual (tres sesiones
en el mismo checkout y la misma rama, con WIP de backend visible en el árbol de las demás) queda
registrado como deuda deliberada en `COORDINACION.md`, con su mitigación: ninguna sesión usa
`git add -A`, `git checkout`, `git pull` ni `gh pr merge --delete-branch`.

---

## 5. Estructura del buzón

```
coordinacion/                          (gitignored · ruta absoluta fija · buzón canónico único)
├── COORDINACION.md                    reglas del juego — se lee al arrancar y antes de cada commit
├── PLAN.md                            backlog priorizado + contratos de junta · dueño: planificación
├── abierto/                           lo pendiente. PLANO SIEMPRE. El estado ES un `ls` de acá.
│   └── 2026-07-21_contrato_desconexion-de-apps.md
└── cerrado/                           histórico, particionado por día
    ├── 2026-07-20/
    └── 2026-07-21/
```

### 5.0 Por qué `abierto/` es plano y `cerrado/` es por día

Son dos problemas distintos y merecen tratamiento distinto.

`abierto/` es lo pendiente: por definición son pocos. Si algún día tuviera cientos de archivos, el
problema no sería la carpeta sino que nadie está cerrando nada — y eso **tiene que verse**.
Particionarlo por día lo escondería: habría que abrir siete carpetas para saber qué falta, y se
pierde la propiedad que justifica todo el diseño (*el estado es un `ls`*). Efecto secundario
deseable: un mensaje del martes que sigue en `abierto/` el viernes grita, sin ningún instrumento.

`cerrado/` es donde están los miles de archivos, y ahí sí se parte por día. La fecha de archivo es
**la del propio mensaje**, que ya viaja en el nombre (`2026-07-21_pedido_…`), así que al cerrar no hay
nada que decidir: `2026-07-21_*` va a `cerrado/2026-07-21/`. Los crones sólo miran `abierto/`, de modo
que el histórico crece sin costo de polling.

### 5.1 Estado por ubicación

Un mensaje pendiente vive en `abierto/`. **Quien lo resuelve lo mueve a `cerrado/<fecha-del-mensaje>/`.**
Saber qué falta es `ls abierto/`.

**Por qué así y no un tablero:** un tablero que alguien debe acordarse de actualizar se desincroniza,
y entonces **miente** — es exactamente el instrumento que confirma en vez de verificar. Un `mv` no
puede desincronizarse: o el archivo está en `abierto/` o no está. El estado es observable, no
declarado.

**Descartado:** tablero derivado por script que parsea frontmatter. Más rico (bloqueos, antigüedad),
pero es software que hay que escribir, mantener y correr, y exige frontmatter disciplinado en cada
mensaje. Sobreingeniería para tres sesiones.

### 5.2 Línea base

Los 26 mensajes actuales se mueven **todos** a `cerrado/`. No se trian: el operador acotó el alcance a
montar el formato. Lo que siga realmente abierto se re-declara en `abierto/` cuando se acometa ese
trabajo.

---

## 6. `COORDINACION.md` — las reglas

Portado de documed y adaptado al copiloto. Secciones:

1. **Quién es quién** — tabla `sesión · dueña de (globs) · rama · directorio`. Cero solapamiento: una
   sesión nunca edita la carpeta de otra; si necesita un cambio del otro lado, **lo pide**.
2. **Reglas duras de git** — qué es seguro (`push`, `gh pr create`, `fetch`) y qué pisa el árbol ajeno
   (`git add -A`, `git checkout`, `git pull`, `gh pr merge --delete-branch`). Con el caveat de §4.2.
3. **Estado compartido con dueño único** — los worktrees (o el checkout compartido) aíslan el código,
   **no** el estado externo. Dueño único para: migraciones y `provision_tables.py` · deploy al VPS ·
   memoria del proyecto (`memoria/`) · numeración de ADRs · `docs/**`.
4. **Invariantes del copiloto** — las que ninguna skill de frontend conoce y que ganan siempre:
   orquestación durable con Temporal (el moat) · aislamiento multitenant real (nada de `cliente_id`
   desde env) · contrato `POST /chat` fire-and-forget + polling `GET /reply` · cero secretos en repo ·
   tests corren en el VPS, no en la PC.
5. **Convención de nombres y tipos de mensaje** — §7 de este spec.
6. **Protocolo** — §8 de este spec.

## 7. Tipos de mensaje

Formato de nombre: `YYYY-MM-DD_<tipo>_<origen>-<slug-en-kebab>.md`

| Tipo | Quién lo emite | Para qué | Cierra cuando |
|---|---|---|---|
| `contrato_` | **planificación** | Baja la junta cerrada antes de que nadie implemente. **Artefacto nuevo, el corazón del formato.** | Ambos lados reportan `listo_` contra él |
| `pedido_` | backend / frontend | Pide algo del otro lado que no puede resolver solo | Llega su `respuesta_` |
| `respuesta_` | backend / frontend | Contesta un `pedido_` | Se emite (mueve el `pedido_` a `cerrado/` junto con ella) |
| `hallazgo_` | cualquiera | Algo verificado que la otra sesión necesita saber | La otra sesión acusa recibo o lo incorpora |
| `dato_` | cualquiera | Información operativa (credencial de prueba, ruta, id) | Se consume |
| `listo_` | backend / frontend | Reporta implementado **con evidencia** | Se verifica del otro lado |
| `cierre_` | cualquiera | Cierra un frente completo con su DoD en verde | Se emite |
| `addendum_` | cualquiera | Amplía un mensaje anterior sin reemplazarlo | Con el mensaje que amplía |

Todo mensaje nace en `abierto/`, salvo `cierre_`, que nace en `cerrado/` porque no espera nada de
nadie. Un `dato_` nace en `abierto/` si espera acuse de recibo, y en `cerrado/` si es puramente
informativo.

## 8. Protocolo

1. **`COORDINACION.md` se lee al arrancar la sesión** y antes de cualquier commit o push.
2. **Un cambio de contrato se acuerda antes de codearse de los dos lados.** Si una sesión necesita
   inventar la forma de un endpoint para avanzar, eso es codificar la esperanza: emite `pedido_` y
   marca su código `[ASSUMED_PENDING_VERIFY]` hasta que llegue la respuesta.
3. **Nadie declara «listo» sin evidencia verificable.** Autoevaluación no cuenta.
4. **Quien resuelve, mueve el archivo a `cerrado/`.** Es el único ritual del formato.
5. **`PLAN.md` tiene una sola dueña** (planificación). Backend y frontend lo leen; si quieren
   proponer algo, emiten `pedido_` — no lo editan.

---

## 9. `PLAN.md` — el backlog

Dueño único: la sesión de planificación. Estructura:

```markdown
# PLAN — Copiloto del Emprendedor
> Cola priorizada. Dueña: sesión de planificación. Backend y frontend LEEN; para proponer, emiten `pedido_`.

## En curso        ← lo que alguna sesión está implementando ahora, con su contrato asociado
## Siguiente       ← priorizado, con contrato listo o pendiente de escribir
## Bandeja         ← entra sin priorizar; sale a "Siguiente" cuando lo decidimos
## Descartado      ← con el motivo. Que no vuelva a proponerse.
```

Cada ítem declara: **objetivo** (una línea, en términos de lo que el emprendedor puede hacer) ·
**capas que toca** (backend / app / ambas) · **contrato** (link al mensaje `contrato_`, o «no
requiere» si es de una sola capa) · **DoD binario**.

`PLAN.md` se crea con la estructura completa y los frentes ya conocidos volcados en **Bandeja**, sin
priorizar (desconexión de apps, PDF de notas de crédito, tope de consumidor final, rotación de
`DATABASE_URL` de fusion). Listarlos no es acometerlos: es exactamente «sacar el plan de la cabeza del
operador», que es el objetivo declarado. Priorizarlos es una sesión posterior.

## 10. Plantilla de `contrato_`

El artefacto que elimina el ida y vuelta. Baja **cerrado** — si una sección no se puede completar, el
contrato no está listo para despacharse.

```markdown
# CONTRATO — <qué habilita, en términos del emprendedor>
> De: planificación · Fecha: YYYY-MM-DD · Implementan: backend + app

## 1. Por qué                 Qué puede hacer el emprendedor cuando esto exista. Una línea.
## 2. Endpoint                Método · path · auth · quién es el tenant y de dónde sale.
## 3. Request                 Forma exacta. Cada campo: tipo, obligatoriedad, ejemplo real.
## 4. Response OK             Forma exacta + ejemplo real. Nada de "y otros campos".
## 5. Estados                 Si el recurso tiene ciclo de vida: los estados y sus transiciones.
## 6. Errores                 Código HTTP → significado → qué hace la app. Incluye el caso "todavía
                              no desplegado" (ver §11: hoy eso es 405, no 404).
## 7. Quién es dueño de qué   Qué decide el backend y qué decide la app. Sin zonas grises.
## 8. DoD binario             Criterio verificable de cada lado. Sin evidencia no está cerrado.
## 9. Fuera de alcance        Lo que este contrato NO cubre, para que nadie lo asuma.
```

## 11. Invariante que este formato hereda del 405

Documentada en `COORDINACION.md` porque aplica a **todo** endpoint futuro: el front-door monta
`@app.get("/{full_path:path}")` para servir el SPA (`apps/copiloto/web.py:141`). Consecuencias:

- Una ruta no desplegada responde **405**, nunca 404, ante `POST`/`DELETE`/`PATCH`.
- Un `GET` a una ruta inexistente devuelve **200 con el HTML del SPA**, no 404.

Un chequeo de «¿está vivo?» por GET diría que sí sobre una ruta que no existe.

**Corregido el 2026-07-21**, tras el matiz de FRONTEND (medido) confirmado por BACKEND (autor de esos
códigos). La primera formulación —*404/405/501 → «no disponible»*— era exacta para rutas no
desplegadas y **rompía cuando el endpoint existe y define su propio 404**: en la desconexión de apps,
`404` significa *«no había nada que revocar»*, o sea **éxito idempotente**. Mapearlo a «no disponible»
le diría al usuario que la función no existe sobre una baja que de hecho está hecha.

Formulación vigente: **`405`/`501` → no desplegado** · **`404` → lo define el endpoint** (tratarlo como
«no desplegado» sólo en rutas GET sin segmento dinámico) · **`400`** → valor fuera de la policy. El
control que distingue las ramas: **pedir algo inválido a propósito**; si el valor inventado da `400` y
el recurso ausente da `404`, el endpoint está vivo y discrimina.

**Consecuencia para el formato:** todo `contrato_` debe declarar qué significa cada código **en su
endpoint**. La regla general no alcanza — y ésta es justamente la clase de detalle que, si no baja
escrito, se descubre en device.

---

## 12. Implementación

Todo ocurre en el checkout principal. **No se toca código de `apps/`**: hay WIP sin commitear de la
sesión de backend (`mp_credential_store.py`, `web.py`, `tests/test_connect_endpoints.py`). Se usa
`git add` con rutas explícitas, **nunca `-A`**.

| # | Paso | Detalle |
|---|---|---|
| 1 | `.gitignore` | Agregar `coordinacion/` con comentario del porqué |
| 2 | Desversionar | `git rm -r --cached coordinacion/` |
| 3 | Estructura | `mkdir coordinacion/abierto coordinacion/cerrado` |
| 4 | Línea base | Mover los 26 mensajes a `cerrado/` |
| 5 | `COORDINACION.md` | Escribir (§6) |
| 6 | `PLAN.md` | Escribir con estructura + Bandeja sembrada (§9) |
| 7 | Commit + push | Sólo `.gitignore`, el borrado del índice y este spec. Elimina el buzón de GitHub |
| 8 | Avisar por el buzón | Un `dato_` en `abierto/` anunciando el formato nuevo a las dos sesiones |

**Fuera del alcance de esta sesión** (requiere acción del operador): repuntar los tres crones a la
ruta absoluta del buzón, si hoy usan una ruta relativa al `cwd`.

## 13. Criterio de aceptación

Binario, verificable:

1. `git status` no muestra `coordinacion/` y `git ls-files coordinacion/ | wc -l` devuelve **0**.
2. La carpeta y sus 26 mensajes **siguen en disco** tras el commit.
3. `ls coordinacion/abierto/` devuelve exactamente el `dato_` de anuncio del paso 8.
4. `COORDINACION.md` y `PLAN.md` existen, sin secciones `TBD`.
5. Las otras dos sesiones acusan recibo del `dato_` de anuncio por el buzón — prueba de que el
   transporte sigue vivo con la estructura nueva. **Es el control: sin esto, el formato está
   declarado pero no verificado.**

## 14. Fuera de alcance

- Trabajo atrasado de cualquier tipo (acotado por el operador).
- Priorizar la Bandeja de `PLAN.md`.
- Aislar las sesiones en worktrees (§4.3).
- Cualquier script generador de tableros o métricas (§5.1).
