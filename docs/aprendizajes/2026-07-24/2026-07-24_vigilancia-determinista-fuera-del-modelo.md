---
sprint: IN + mobile-first (hitos 7, 8, 9, C, P)
nivel: 1
dueño: planificación
---
# La vigilancia determinista la hace un modelo caro, turno a turno

**Evidencia:** en 12 h, **465 turnos disparados por cron contra 149 por una persona (76 %)**, y
planificación consumió el **52,6 % de los tokens del sprint sin escribir una línea de producto**.
Medido con `scripts/metricas-sesiones.py`.

**Qué falló:** cada latido despierta al modelo para ejecutar pasos que son deterministas —listar el
buzón, medir antigüedades, comparar contra umbrales. El juicio (¿qué hago con esto?) sí necesita
modelo; la medición no. Y el cron tiene una inversión propia: **no puede interrumpir un turno en
curso**, así que dispara más cuanto menos trabaja la sesión.

**Gancho a construir:** que el cron ejecute **un script** que produzca el reporte y **sólo despierte al
modelo cuando hay alarma**. Sin alarma, no hay turno. `scripts/ultimas-acciones.sh` y
`scripts/no-ocio-check.sh` ya hacen la medición: falta el paso que decide si vale la pena despertar a
alguien.

**DoD binario:**
- Ventana sin alarmas → **cero turnos** de modelo por vigilancia (verificable en el transcript).
- Alarma real → el turno ocurre y trae el reporte del script, no una medición reconstruida.
- **Control negativo:** inyectar una condición de alarma conocida (una sesión sin actividad más allá
  del umbral) → debe despertar. Si no despierta, el ahorro es ceguera.

---

## ✅ IMPLEMENTADO — 2026-07-24

**Gancho:** `scripts/vigilancia-check.sh` (rama `chore/vigilancia-sin-modelo`). Compone piezas ya
existentes en vez de reinventarlas: `scripts/cola-check.sh` (tal cual, sin tocar — su contrato
`--quiet` de "sólo imprime si hay algo" ya era la señal que hacía falta), `scripts/escaladores-buzon.sh`
(Gancho 3, exit 0/1 real) y una medición de VIDA por transcript que reutiliza la técnica de
`etiqueta_transcript()` de `no-ocio-check.sh` (rotular por el marcador que el propio prompt del cron
inyecta, validada 8/0/0 el 2026-07-24) — **sólo esa mitad**: la mitad que infiere productividad
(`GIRA EN VACÍO`) y que falló 6 veces queda deliberadamente afuera y prohibida
(`.claude/commands/monitoreo.md`).

**Hallazgo real durante la construcción (spike-first pagó):** la primera versión medía "cualquier
`.jsonl` <4h" sin rotular por rol, y contra el repo real disparó **15 falsas alarmas** — transcripts
de ventanas ya cerradas pero técnicamente <4h de antigüedad. Se corrigió filtrando por el marcador de
rol antes de medir `mtime`; contra el mismo buzón real, la versión corregida bajó a **2** alarmas
(FRONTEND y PLANIFICACIÓN, no BACKEND) — una señal creíble, no ruido.

**DoD, corrida real contra fixtures controlados:**

```
CASO 1 (sin novedades: buzón limpio + transcript fresco con marcador BACKEND) -> EXIT=0
  VIGILANCIA: sin novedades — 2026-07-24 15:07.

CASO 2 (alarma real por escalación: buzón con 3 condiciones del Gancho 3) -> EXIT=1
  ESCALADORES:
  CONTRATO SIN TOMAR (188min >= 120): ...test-cumplido.md -> le toca a backend
  PEDIDO SIN RESPUESTA (48min >= 30): ...test-viejo.md -> deudora: frontend
  EN-CURSO SIN AVANCE (108min >= 90): ...test-en-curso-viejo.md -> dueño del frente: frontend

CASO 3 (CONTROL NEGATIVO del DoD: transcript BACKEND mudo 35min + buzón limpio) -> EXIT=1
  SESION MUDA: BACKEND sin escribir hace 35min (umbral 30min).
```

`--quiet` en el caso sin alarma: confirmado que **no imprime nada** (salida vacía, `EXIT=0`) — es la
condición que el prompt del Cron 1 usa para cerrar el turno en una línea.

**Evidencia REAL (no sintética) contra el buzón y los transcripts vivos**, con `--dry-run` (que por
diseño no escribe nada — confirmado: `abierto/` con 47 archivos antes y después de esta corrida):

```
$ bash scripts/vigilancia-check.sh --dry-run --quiet
SESION MUDA: FRONTEND sin escribir hace 142min (umbral 30min).
SESION MUDA: PLANIFICACION sin escribir hace 55min (umbral 30min).
EXIT=1
```

**Integración:** `.claude/commands/monitoreo.md` — el prompt del Cron 1 ahora corre este script como
PASO 0 y, si sale 0, cierra el turno en una línea sin ejecutar nada más (se retiró la instrucción de
"listar carpetas y comparar mtimes a mano").

**Lo que queda pendiente de verificación EN VIVO** (`[REQUIRES_LIVE_VALIDATION]`, honesto sobre el
límite de esta sesión): el DoD pide "verificable en el transcript" que una ventana sin alarmas
produce cero turnos de trabajo profundo. Lo que se verificó acá es que **el script decide
correctamente en los tres casos** (incluido el control negativo) y que el prompt del cron **quedó
cableado** para respetar esa decisión — pero el primer ciclo real del Cron 1 con este prompt todavía
no ocurrió (requiere el merge a `main` y que la sesión de planificación real lo recoja vía
`/monitoreo`). Cerrar ese último tramo es un chequeo de 2 minutos la próxima vez que ese cron
dispare: mirar el transcript y confirmar que un ciclo sin alarma es, en efecto, una tool call + una
línea.
