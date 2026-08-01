# Runbook — ciclo de auto-reparación (Fase 3)

> Para el operador, cuando el ciclo esté corriendo solo. Todo lo de acá se probó en el VPS el
> 2026-07-31; los comandos son los que se ejecutaron, no una reconstrucción.

---

## 🛑 Lo primero: cómo apagarlo

```bash
ssh unreal-copilot
set -a; . /etc/unreal-copilot/copiloto.env; . /etc/unreal-copilot/fusion-pg.env; set +a
cd /opt/uc-repos/copiloto/deploy/worker
/opt/uc-copiloto-venv/bin/python verificar_autosanacion.py --pausar-todo
```

Surte efecto **en el momento** y verifica el resultado releyendo del servidor. Para reanudar,
`--reanudar-todo`.

⚠️ **`COPILOTO_AUTOSANACION_OFF=1` NO es inmediato.** systemd fija el entorno del proceso al
arrancar, así que esa variable exige `systemctl restart uc-copiloto-worker`. Sirve como apagado
permanente (sobrevive a que alguien reanude los Schedules), no como freno de emergencia
([[kill-switch-por-env-no-es-inmediato-bajo-systemd]]).

---

## Qué hace, en una línea

Una vez por día, a las 04:00, **para toda la app** (un solo Schedule: `autosanacion-global`), toma
**un bug** pendiente de la DLQ, intenta un parche, lo audita, corre la suite completa en un sandbox,
y **deja una propuesta que una persona revisa**. Nunca mergea nada.

> **Un bug, no una ocurrencia** (2026-08-01, decisión del operador). Antes había un Schedule por
> tenant — 19 disparos, y 5.000 el día que haya 5.000 emprendedores, todos reparando el mismo
> defecto de nuestro código. El tenant es un atributo de la *ocurrencia*; la unidad de reparación es
> el *bug*. Como el índice único de la DLQ es `(cliente_id, fingerprint)`, un solo defecto que toca N
> tenants deja N filas: el ciclo toma **un representante por `fingerprint`** (el de mayor
> `dedupe_count` — se repara primero lo que más duele) y, si llega a proponer PR, **cierra también a
> los hermanos**, para no volver a proponer el mismo parche un día por tenant afectado.
>
> Corre con un rol propio, `copiloto_autosanacion` (`BYPASSRLS`, permisos sobre **una sola** tabla),
> que se provisiona **una vez** con `deploy/copiloto/provision-rol-autosanacion.sh`. Sin su DSN
> (`COPILOTO_AUTOSANACION_DSN`) el worker arranca igual y el ciclo queda **apagado**, diciéndolo en
> el journal — nunca cae de vuelta a la conexión por tenant, que arrancaría verde midiendo mal.

## Qué NO hace, y conviene tenerlo presente

- **No repara transitorios.** Sólo `business_error`. Un 503 de Composio o un timeout no tienen código
  que reparar: ya se reintentan solos.
- **No toca el dominio fiscal** (`afip_*`, `mp_credential_store`). El efecto de un reintento ahí es
  irreversible y externo.
- **No demuestra que el parche arregle el bug.** El gate verifica **no-regresión**: que la suite
  completa siga verde. Un trauma de producción está en un camino que ningún test ejercita, así que no
  hay test rojo que poner verde. **Por eso el PR se revisa mirando el cambio, no el verde.**
- **Abre PRs desde un clon aparte** (`/opt/uc-autosanacion-repo`, provisionado 2026-08-01), nunca
  desde el repo desplegado: el ciclo hace `checkout -b` + `commit` sobre lo que se le declare, y
  apuntarlo a producción movería el código que el worker está sirviendo, en caliente.
  Si `COPILOTO_AUTOSANACION_REPO_GIT` falta o `gh` no está autenticado, degrada a dejar un `.patch`
  en `/tmp/autosanacion`. **Ese degradado no protesta**: hay que mirar el desenlace del workflow
  (`modo: "artefacto"` en vez de `"pr"`), porque un ciclo que deja parches en un /tmp que nadie
  visita se ve exactamente igual que uno que anda.

## Dónde mirar

| Qué | Dónde |
|---|---|
| ¿Corrió? ¿Qué decidió? | Temporal, workflows tipo `AutosanacionWorkflow` |
| Estado de los Schedules | `verificar_autosanacion.py` (sin flags, cero efectos) |
| Propuestas | `/tmp/autosanacion/trauma-<id>-<fingerprint>.patch` (o `COPILOTO_AUTOSANACION_ARTEFACTOS`) |
| Por qué se rechazó un trauma | columna `contexto->>'ultima_nota'` de `uc_factory.copiloto_traumas` |
| El worker, ¿lo tiene encendido? | `journalctl -u uc-copiloto-worker \| grep autosanacion` → `ON` / `OFF` |

## Desenlaces posibles y qué significan

| `estado` | Significa | ¿Hay que hacer algo? |
|---|---|---|
| `sin_traumas` | la DLQ estaba vacía | no, es lo normal |
| `rechazado_por_gate` | kill switch, dominio prohibido, tope diario, categoría no reparable, o sin `origen` | no; el motivo queda en `ultima_nota` |
| `sin_parche` | el modelo no produjo un parche aplicable en 3 intentos | no; el trauma vuelve a `pendiente` |
| `rechazado_por_auditor` | el parche tocaba lo que no debía | no |
| `rechazado_por_tests` | el parche rompía tests que pasaban | no; las regresiones quedan en el resultado |
| `rechazado_por_tests` + **`NO_EVALUABLE`** en el motivo | **el gate no pudo medir** — no es lo mismo que rechazar | **sí**: leé el motivo. Si dice *"no corrió NINGÚN test"*, el problema es el intérprete o el `PYTHONPATH` del sandbox, no el parche |
| `pr_propuesto` | **hay algo para revisar** | sí: mirar el artefacto o el PR |

Todos menos el primero dejan su motivo escrito. Un trauma que rebota tres veces con el mismo motivo
es información, no ruido.

## Parámetros

| Variable | Default | Para qué |
|---|---|---|
| `COPILOTO_AUTOSANACION_OFF` | (no seteada) | apagado permanente; **exige reiniciar el worker** |
| `COPILOTO_AUTOSANACION_DSN` | (no seteada) | conexión del rol con `BYPASSRLS`; **sin ella el ciclo no corre** |
| `COPILOTO_AUTOSANACION_TOPE_DIARIO` | 5 | reparaciones propuestas por día, **en toda la app** (el tope acota los PRs que le caen al revisor, y el revisor es uno) |
| `COPILOTO_AUTOSANACION_HORA` | 4 | hora del disparo (el paso caro es una suite completa) |
| `COPILOTO_AUTOSANACION_ARTEFACTOS` | `/tmp/autosanacion` | dónde quedan los `.patch` |
| `COPILOTO_AUTOSANACION_REPO_GIT` | `/opt/uc-autosanacion-repo` | clon donde abrir PRs; **nunca el repo desplegado**. Lo provisiona `deploy/copiloto/provision-repo-autosanacion.sh` (idempotente), que además **verifica** que no sea el desplegado en vez de confiarlo a este renglón |
| `COPILOTO_FORJADOR_MODELO` | `gpt-4o-mini` | modelo del forjador |
| `COPILOTO_SANDBOX_PYTHON` | el intérprete del worker | override del python del sandbox. **No la toques sin necesidad:** el default es `sys.executable`, que es el venv del worker por construcción. Apuntarla a un python sin `pytest` deja el gate mudo, y un gate mudo **no da error** — rechaza todo y parece prudente |

## Si algo se comporta raro

1. **Pausá los Schedules** (arriba). Es reversible y cuesta un comando.
2. Mirá el último desenlace en Temporal y la `ultima_nota` del trauma.
3. Si el auditor está degradado, el ciclo se apaga **solo**: `verificar_auditor()` le pasa 3 parches
   rotos conocidos antes de auditar nada, y si aprueba alguno no audita. Eso aparece como
   `rechazado_por_auditor` con el motivo *"el AUDITOR está degradado"*.

## Cómo verificar que sigue vivo

```bash
python verificar_autosanacion.py --disparar
```

Dispara un Schedule y espera el desenlace. Es la **única** prueba de que el worker tiene el workflow
registrado: Temporal no expone esa lista, y un workflow que nadie registró no da error — la ejecución
queda encolada y desde afuera se ve igual que "todavía no le tocó".
