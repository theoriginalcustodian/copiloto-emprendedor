# ADR-001 — La definición de la suite sale de GitHub: gate propio local+VPS, GitHub como respaldo

- **Fecha:** 2026-08-06
- **Estado:** `PROPUESTO` → pasa a `ACCEPTED` cuando esté el control diferencial en rojo (ver §7)
- **Decide:** operador (es MAYOR: cambia la arquitectura del gate del repo)
- **Autor del borrador:** sesión de planificación
- **Primer ADR del repo.** Convención heredada del `CLAUDE.md` global: `YYYY-MM-DD_ADR-XXX_slug.md`.

---

## 1. Contexto — lo que pasó, medido

El 2026-08-06, GitHub Actions estuvo en incidente `critical` durante **más de 5 horas**
(abierto 15:22 UTC, sin resolver al cierre de este ADR). El parte oficial, textual:

> *"Webhook triggers are currently **throttled**… we are processing approximately **15% of
> webhooks**, so many events such as pushes and pull requests are **not triggering workflow runs**."*
>
> *"Of jobs queued, approximately **65% are succeeding**, improved from a low of 30 to 40%."*
>
> *"Customers using **self-hosted runners** may see errors or rate limiting when runners register."*

Consecuencias medidas en este repo ese día:

| Hecho | Evidencia |
|---|---|
| 6 PR mergeados, **1 solo** con CI verde propio | `gh pr list --state merged` × `runs?branch=main` |
| 3 mergeados con **cero** runs | #283, #287, #288 |
| 1 run `failure` que **no era código** | #285: `core` y `backend` salieron `cancelled`; `mobile`/`lint`/`web` pasaron |
| 4 vías de relanzamiento probadas, **4 fallaron** | `rerun` (limbo incancelable), `close`+`reopen`, SHA nuevo por API, `gh workflow run` (no existe el trigger) |

Durante esas 5 horas, la política de facto fue *"corré la suite local y pegá la salida"* — es decir,
**una evidencia que un humano o un agente transcribe**. Eso es testimonio, no medición.

## 2. El problema, en una frase

**No es que GitHub se haya caído. Es que la definición de la suite vive dentro de `tests.yml`**
(comandos inline, `.github/workflows/tests.yml:71-168`), en un formato que sólo GitHub sabe ejecutar.

De ahí salen dos dependencias distintas, y la segunda es la que muerde:

1. **De ejecución** — si Actions no corre, nadie mide. Visible, molesta, temporal.
2. **De formato** — aunque tuviéramos runners propios, la *especificación* seguiría atrapada allá.
   Escribir un gate propio hoy sería **reimplementarla**, y dos definiciones de "la suite" **divergen
   en silencio**. Ésta es la cara peligrosa: un gate que difiere del CI es **peor que no tener gate**,
   porque da verde sobre algo que nadie corrió.

Ese mismo patrón ya se pagó en este repo y está documentado en el header del propio workflow: el
backend corría una **lista hardcodeada de 11 archivos** sobre los 108 que existían, y
`test_errores_web.py` —el guard de los códigos de error— **nunca corrió**. Una lista se desactualiza
en silencio y sigue dando verde. Dos definiciones de la suite son la misma enfermedad, un nivel más
arriba.

## 3. Fuerzas

- Regla 2 del proyecto: **los tests de backend corren en el VPS**, no en la PC (no tiene `temporalio`
  ni `psycopg2`). Cualquier diseño tiene que respetarlo.
- La PC **sí** tiene toolchain de JS (`node v22.23.1`, `npm 11.6.2`) → 4 de los 5 jobs pueden correr
  local sin infraestructura.
- Tres sesiones paralelas comparten repo y VPS → el gate no puede asumir exclusividad.
- Ya existe la mitad del trabajo, y **es mejor que el CI** (ver §4).
- El gate tiene que ser rápido o se saltea con `--no-verify`, y entonces no existe.

## 4. Lo que ya existe (inventario medido contra `origin/main`)

| Pieza | Dónde | Estado |
|---|---|---|
| Postgres 17 efímero para tests | `deploy/copiloto/test-db.sh` | idempotente, `--recreate` |
| **Rol `copiloto_app` NO-superuser** | ídem, header L11-17 | **superior al CI** |
| Correr pytest en el VPS | `deploy/copiloto/sync-test-backend.sh` | idempotente, parametrizado |
| Los 5 jobs y sus comandos | `.github/workflows/tests.yml:71-168` | **inline — el problema** |
| Gate de pre-push | `.githooks/pre-push` | hoy **sólo sincroniza el grafo**; no corre un test |

**El punto que decide este ADR:** `test-db.sh` corre con `copiloto_app` NOSUPERUSER NOBYPASSRLS,
porque un superuser **saltea RLS incluso con `FORCE`**. Ese cambio destapó que **72 de 77 tablas no
filtraban nada** mientras el CI daba verde. O sea: **el instrumento propio ya es más severo que el de
GitHub.** No estamos degradando el gate para independizarnos — estamos promoviendo el bueno.

## 5. Decisión

**Mover la definición fuera del workflow y convertir a GitHub en un consumidor más.**

1. **`scripts/ci/{backend,core,web,mobile,lint}.sh`** — un script por job, con los comandos que hoy
   están inline. Idempotentes, parametrizados, corribles a mano.
2. **`tests.yml` pasa a ser un wrapper**: `run: bash scripts/ci/<job>.sh`, y nada más.
3. **`scripts/gate.sh`** — despachador, sin lógica de test propia:
   - `core`, `web`, `mobile`, `lint` → **PC, local**
   - `backend` → **VPS**, vía `sync-test-backend.sh` + `test-db.sh`
4. **Recibo atado al SHA**: `gate.sh` escribe `.ci-recibos/<sha>.json` con el veredicto por job. Lo
   escribe **el script**, no quien reporta. Un merge cita el recibo de **su** SHA; si no existe, o es
   de otro SHA, **no hay evidencia**.
5. **Mirror del repo en el VPS**: hoy `git remote -v` da **sólo `origin`**. Un remoto bare adicional
   elimina el punto único de fallo del código, no sólo del CI.

**Alcance de esta decisión (v1).** El gate lo dispara quien pushea o mergea. Un runner propio
automático (`post-receive` en el mirror) queda **fuera** — ver §6.

## 6. Alternativas consideradas, y por qué no

### (a) Runners self-hosted en el VPS — ❌ **refutada con evidencia del mismo día**

Es la respuesta obvia y **no resuelve el problema**. El parte de GitHub dice que los self-hosted
también fueron afectados (*"errors or rate limiting when runners register"*), y sobre todo: con los
**webhooks al 15%**, el job **nunca se despacha**. Tener el ejecutor propio no sirve si el disparador
es de un tercero. La independencia tiene que no atravesar GitHub **ni para disparar ni para
ejecutar**.

### (b) Migrar a otro CI SaaS (GitLab CI, CircleCI, Buildkite) — ❌

Cambia el nombre del dueño, no la dependencia. Y la definición seguiría en un formato propietario:
volveríamos a estar a un incidente de distancia, con el costo de una migración de por medio.

### (c) Escribir un gate propio desde cero, dejando `tests.yml` como está — ❌ **la peor**

Es lo que parece más rápido y es lo que hay que evitar: **dos definiciones de la suite**. Divergen en
silencio, sin error, sin síntoma — hasta que el gate propio da verde sobre algo que el CI habría
puesto rojo. Es el bug de la lista hardcodeada de 11 archivos, otra vez.

### (d) No hacer nada, esperar a que GitHub se recupere — ❌

Es lo que hicimos hoy, y el costo fue 5 h de trabajo mergeado sin medición. La probabilidad de que
vuelva a pasar no es baja, y el costo crece con el tamaño del repo.

### (e) v2 — runner automático propio (`post-receive` en el mirror) — ⏸️ **diferido, no descartado**

Es la continuación natural, pero **sin el paso 1 no tiene sentido**: sería montar infraestructura
(cola, concurrencia entre 3 sesiones, retención de logs) alrededor de una definición que sigue
secuestrada en `tests.yml`. Con la definición afuera, v2 se vuelve casi trivial. **Se decide después
de v1, con v1 funcionando.**

## 7. Cómo se verifica (y qué convierte este ADR en `ACCEPTED`)

**Un gate que nunca vio un rojo no está verificado.** Es el modo de fallo propio de todo mecanismo
fail-closed: su rotura se ve idéntica a su funcionamiento — silencio en ambos casos. Este repo ya lo
pagó con un gate de no-regresión que **nunca corrió un test** en producción (`python3` sin pytest) y
nadie lo notó.

Por eso el criterio de aceptación es **diferencial**, no "corre y da verde":

- [ ] Cada `scripts/ci/<job>.sh` corre solo y a mano, y **da verde** sobre `main` sano.
- [ ] **Se rompe un test a propósito** ⇒ `scripts/ci/<job>.sh` **rojo** Y `gate.sh` **rojo**.
      Sin esta demostración, el gate queda `[UNVERIFIED]` y este ADR **no pasa a `ACCEPTED`**.
- [ ] `tests.yml` sin un solo comando inline.
- [ ] Guard anti-drift: un test que **falle** si `tests.yml` vuelve a tener `run:` con algo que no
      sea `bash scripts/ci/*.sh`. Sin este guard, la decisión se erosiona en la primera urgencia.
- [ ] `gate.sh` escribe `.ci-recibos/<sha>.json` y **falla** si algún job falla.
- [ ] Mirror `vps` configurado y probado con un push real, y un check de divergencia entre remotos.

## 8. Consecuencias

**A favor**

- El trabajo deja de frenarse por un tercero: hoy fueron 5 h, y la próxima vez puede ser peor.
- El gate pasa a ser **más severo**, no menos: `copiloto_app` NO-superuser en vez del rol laxo.
- Los comandos se vuelven **corribles a mano**, que es lo que hoy no son. Depurar un job deja de
  requerir un push.
- **Dos instrumentos independientes** midiendo lo mismo valen más que uno — siempre que ejecuten la
  **misma** definición. Ésa es la condición, y es todo el diseño.

**En contra, y hay que decirlo**

- Superficie nueva que mantener: 6 scripts. Mitigado porque son extracciones, no lógica nueva.
- El riesgo de drift **no desaparece**, se traslada: alguien puede editar `tests.yml` inline en una
  urgencia. Por eso el guard anti-drift es parte del DoD, no un extra.
- El recibo local es **falsificable por quien tiene la máquina**. No es un modelo de confianza
  criptográfico y no pretende serlo: sirve contra el error honesto (pegar una salida vieja, citar
  otro SHA), no contra un actor malicioso. Con tres sesiones agénticas, el error honesto es el riesgo
  real.
- El gate local puede tentar a saltear GitHub del todo. **No se apaga el CI**: pasa de único juez a
  segundo, y su valor es justamente ser un instrumento que no comparte fallas con el nuestro.

## 9. Reparto

| Quién | Qué | Cuándo |
|---|---|---|
| Backend | pasos 1, 2, 4, 5 + `scripts/ci/backend.sh` (dueño de `deploy/` y del VPS) | después de CONS0a/CONS0b |
| Frontend | `scripts/ci/{core,web,mobile,lint}.sh` (portar `tests.yml:117-168` tal cual) | después de la barra lateral |
| Planificación | este ADR + el guard anti-drift | ahora |

## 10. Referencias

- Contrato operativo: `coordinacion/abierto/2026-08-06_contrato_planificacion-a-todos_CI-PROPIO-…md`
- Incidente: `githubstatus.com` — *Incident with Actions*, 2026-08-06T15:22:49Z, impacto `critical`
- `memoria/suite-local-en-vps-con-rol-no-superuser.md`
- `memoria/rls-activado-que-no-filtraba-el-dueno-esta-exento.md`
- `memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md`
- `memoria/instrumentos-que-confirman-en-vez-de-verificar.md`
