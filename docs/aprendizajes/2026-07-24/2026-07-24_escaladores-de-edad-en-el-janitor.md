---
sprint: IN + mobile-first (hitos 7, 8, 9, C, P)
nivel: 1
dueño: planificación
---
# El trabajo listo que nadie toma no produce ningún error: produce un archivo quieto

**Evidencia:** un `contrato_` de 13 K llevaba **47+ h en `abierto/`** sin que nadie lo tomara, y un
archivo de `en-curso/` llevaba **72+ h** (inventario del buzón, 2026-07-24). El janitor archiva por
edad pero **no escala** por edad. Hallazgo de la auditoría externa, §2 P5.

**Qué falla:** el protocolo detecta silencio de una **sesión**, no abandono de una **tarea**. Un
contrato con su disparador cumplido que nadie movió a `en-curso/` no dispara ninguna alarma: no hay
excepción, no hay error, hay un archivo con `mtime` viejo. Falla en silencio, que es la clase más cara.

**Gancho a construir:** tres reglas en el janitor (**script, no modelo** — el dato ya está gratis en el
`mtime` y la carpeta, porque el estado es la ubicación):
- `contrato_` con disparador cumplido y >2 h sin pasar a `en-curso/` → genera un `urgente_` automático.
- `pedido_` sin su `respuesta_` en >30 min → alarma nombrando a la sesión deudora.
- `en-curso/` sin `avance_` en el umbral declarado por el contrato → alarma al dueño del frente.

**DoD binario:**
- Dejar un `contrato_` con disparador cumplido en `abierto/` y adelantar su `mtime` 3 h → aparece un
  `urgente_` automático nombrando a quién le toca.
- **Control negativo:** un `contrato_` cuyo disparador **NO** está cumplido, con la misma antigüedad →
  **no** genera nada. Escalar lo que legítimamente espera convierte la alarma en ruido de fondo.

---

## ✅ IMPLEMENTADO — 2026-07-24

**Gancho:** `scripts/escaladores-buzon.sh` (rama `chore/vigilancia-sin-modelo`). Extiende el patrón
de `scripts/archivar-buzon.sh` (mtime + ubicación = estado, misma clase "obligación abierta") y el
contrato de exit-code de `scripts/cola-check.sh`. Acepta el buzón por parámetro/env var
(`BUZON_DIR`), precondición para poder probarse sin tocar el real.

**Convención "disparador cumplido"** (decisión táctica, documentada en el propio script): el buzón
real hoy no tiene un campo estructurado para esto — verificado por grep, "disparador" sólo aparece
en prosa. Se adoptó: CUMPLIDO por default, salvo línea explícita `DISPARADOR: pendiente` en el
cuerpo. Así los contratos reales de hoy (sin el campo) siguen escalando, y uno que declara que
espera algo, no.

**DoD, corrida real contra un buzón de prueba** (`buzon-test-gancho3/`, 6 archivos: 1 positivo + 1
control negativo por cada una de las 3 reglas):

```
$ bash scripts/escaladores-buzon.sh buzon-test-gancho3
CONTRATO SIN TOMAR (180min >= 120): ...test-cumplido.md -> le toca a backend
   -> generado .../2026-07-24_urgente_vigilancia-a-backend_contrato-sin-tomar-....md
PEDIDO SIN RESPUESTA (40min >= 30): ...test-viejo.md -> deudora: frontend
EN-CURSO SIN AVANCE (100min >= 90): ...test-en-curso-viejo.md -> dueño del frente: frontend
EXIT=1
```

Los tres controles negativos del mismo fixture (contrato con `DISPARADOR: pendiente`, pedido de 5
min, en-curso de 10 min) **no generaron ninguna línea** — verificado leyendo la salida completa, no
sólo el exit code. **Idempotencia:** segunda corrida sobre el mismo fixture → sigue reportando las 3
alarmas (son reales, no se resolvieron solas) pero **no duplica** el `urgente_` (`ls *_urgente_*.md
| wc -l` → `1`, antes y después). **Buzón vacío** (control adicional) → `ESCALADORES: nada que
escalar.`, exit 0.

**Contra el buzón REAL, sólo lectura** (`--dry-run`, que por diseño no escribe nada — confirmado:
`abierto/` tenía 47 archivos antes y 47 después):

```
$ bash scripts/escaladores-buzon.sh --dry-run coordinacion
CONTRATO SIN TOMAR (227min >= 120): 2026-07-21_contrato_planificacion-a-todos_contabilidad.md -> le toca a todos
CONTRATO SIN TOMAR (1675min >= 120): 2026-07-23_contrato_..._narra-sin-hacer-....md -> le toca a backend
PEDIDO SIN RESPUESTA (231min >= 30): 2026-07-24_pedido_backend-a-planificacion_hito9-....md -> deudora: planificacion
EN-CURSO SIN AVANCE (4030min >= 90): 2026-07-21_contrato_backend-perfil-negocio-y-presupuestos.md -> dueño del frente: desconocido
... (17 líneas en total)
EXIT=1
```

El buzón vivo **hoy mismo** tiene backlog real que el gancho anterior no veía: contratos de hasta
**37 h** sin tomar y archivos en `en-curso/` de hasta **67 h**. Es evidencia de producción, no un
caso sintético — el problema que el pendiente describía existe ahora mismo en `coordinacion/`.

**Integración:** consumido por `scripts/vigilancia-check.sh` (Gancho 1) como una de sus tres señales
de alarma.
