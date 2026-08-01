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

Una vez por día y por tenant, a las 04:00, toma **un** trauma pendiente de la DLQ, intenta un parche,
lo audita, corre la suite completa en un sandbox, y **deja una propuesta que una persona revisa**.
Nunca mergea nada.

## Qué NO hace, y conviene tenerlo presente

- **No repara transitorios.** Sólo `business_error`. Un 503 de Composio o un timeout no tienen código
  que reparar: ya se reintentan solos.
- **No toca el dominio fiscal** (`afip_*`, `mp_credential_store`). El efecto de un reintento ahí es
  irreversible y externo.
- **No demuestra que el parche arregle el bug.** El gate verifica **no-regresión**: que la suite
  completa siga verde. Un trauma de producción está en un camino que ningún test ejercita, así que no
  hay test rojo que poner verde. **Por eso el PR se revisa mirando el cambio, no el verde.**
- **No abre PRs** salvo que se declare `COPILOTO_AUTOSANACION_REPO_GIT` apuntando a un clon distinto
  del repo desplegado. Sin eso deja un archivo `.patch` y listo — deliberado: el VPS tiene `gh`
  autenticado y un proceso automático no puede ramificar sobre producción.

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
| `COPILOTO_AUTOSANACION_TOPE_DIARIO` | 5 | reparaciones propuestas por día y por tenant |
| `COPILOTO_AUTOSANACION_HORA` | 4 | hora del disparo (el paso caro es una suite completa) |
| `COPILOTO_AUTOSANACION_ARTEFACTOS` | `/tmp/autosanacion` | dónde quedan los `.patch` |
| `COPILOTO_AUTOSANACION_REPO_GIT` | (no seteada) | clon donde abrir PRs; **nunca el repo desplegado** |
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
