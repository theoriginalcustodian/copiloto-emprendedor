# D9 — el timeout global no era la causa

> **Fecha:** 2026-08-19 · **Dueño:** frontend · **Estado:** 🔴 **D9 SIGUE ABIERTA**, con causa
> re-localizada y con la hipótesis anterior refutada por medición.
> **Fila de origen:** `2026-08-12-G8-INFORME-DE-CIERRE-de-la-ronda.md` (#401), D9.

---

## 0. Titular

**El `testTimeout` global nunca fue la causa del flake, y subirlo dejó de mitigarlo.** En 22
timeouts observados bajo contención, **ninguno** fue del timeout global: los 22 fueron de `30000 ms`,
el override específico de dos suites. La falla está localizada en **2 archivos de 83**, siempre los
mismos, y ya se les subió el presupuesto tres veces (5000 → 15000 → 30000) sin resolverla.

Lo que este hallazgo corrige no es un número: es un **diagnóstico escrito en el código** que decía lo
contrario y que el próximo lector iba a creer.

---

## 1. Qué afirmaba el diagnóstico anterior

`apps/mobile/jest.config.js` sostenía, desde el 2026-08-13:

> *"el default de Jest (5000ms) es frágil para CUALQUIER test de montaje pesado bajo contención real
> de esta máquina — **no es específico de un archivo**"*

y citaba como prueba a tres archivos sin relación con voz —`PantallaInteligencia`,
`PantallaIngresos`, `PantallaPresupuestos`— que habrían fallado con `Exceeded timeout of 5000 ms`.
De ahí salió el fix: subir el default del proyecto a `20000`.

Ese fix quedó **declarado pero nunca re-verificado bajo carga**. El propio comentario lo admitía:

> *"los 2 describes de gesto de voz mantienen su override específico a 30000ms porque ESE valor ya
> se re-verificó bajo carga forzada (10/10 limpio) y **este no**."*

Esta auditoría fue a cerrar esa verificación pendiente. Encontró otra cosa.

---

## 2. Método

Worktree aislado sobre `origin/main` (`e182aca5`), `npm install` propio, 20 cores.
Carga = N procesos de CPU en busy-loop levantados antes de la corrida y matados después.
**Log completo de cada corrida a su propio archivo** — nunca pipeado por `tail`, que borra justo la
evidencia del fallo ([gotcha ya registrado](../../../memoria/pipear-un-proceso-largo-por-tail-borra-la-evidencia-del-fallo.md)).

### 2.1 Controles del instrumento, antes de medir nada

| Control | Resultado |
|---|---|
| ¿Jest aplica el `testTimeout` del archivo? | `--showConfig` → `globalConfig.testTimeout = 20000` ✅ |
| **Control negativo**: `testTimeout` movido dentro de `projects[]` | → `None` + `Validation Warning: Unknown option` ✅ **discrimina** |
| ¿El flag `--testTimeout=5000` se aplica? | `--showConfig` → `globalConfig.testTimeout = 5000` ✅ |
| `cacheDirectory` scopeado al worktree | `…/wt-d9/apps/mobile/node_modules/.cache/jest` ✅ (fix de la clase EPERM, vivo) |
| **Control positivo**: ¿el montaje puede dar rojo? | carga 4/12/24 → verde · **carga 40 → ROJO** ✅ **piso encontrado** |

El control positivo es el que hace legible todo lo demás: un `0/10` de un montaje que nunca puede
fallar no es evidencia de nada. Recién con carga=40 el montaje demostró discriminar.

---

## 3. Datos

| Condición | Corridas | Resultado |
|---|---|---|
| Basal, sin carga | 1 | 744/745 verde · **76s** (caché frío) |
| Carga 4, config real | 10 | **0/10 rojas** · 13-16s (caché caliente) |
| Carga 4 / 12 / 24, `--testTimeout=5000` | 1 c/u | verde |
| **Carga 40, `--testTimeout=5000`** | 1 | **741/745 pasan** — el default "frágil" alcanza |
| **Carga 40, config real de `main`** | 5 | **3/5 rojas** |

### 3.1 Los 22 timeouts

```
     22 Exceeded timeout of 30000 ms
```

**Cero de 20000 ms. Cero de 5000 ms.**

### 3.2 Las suites culpables — las mismas 3 de 3 veces

```
      3 FAIL src/modules/soporte/PantallaSoporte.test.tsx
      3 FAIL src/modules/chat/ChatView.test.tsx
```

Ambas son las de gesto de voz (hold-graba / soltar-envía / deslizar-fija).

### 3.3 Duración: bimodal, no degradación gradual

| Corridas verdes | Corridas rojas |
|---|---|
| 42s, 47s | 82s, 138s, **160s** |

Las otras 81 suites juntas corren en ~14s con caché caliente. `ChatView.test.tsx` sola tardó
**48.7s** y `PantallaSoporte.test.tsx` **69.9s** en la corrida donde fallaron.

---

## 4. Qué queda establecido y qué no

**Establecido:**

1. El `testTimeout` global **no participa** de este flake. Ningún test que dependa de él falló en
   ninguna condición, ni forzado a 5000ms bajo la carga máxima.
2. La falla es **local a 2 suites de 83**, reproducible al 3/5 con carga 40.
3. **Subir el timeout ya no mitiga**: 30000ms es el valor que se excede.
4. Los 3 archivos citados por el diagnóstico anterior **no fallaron ni una vez** con 10x la carga
   del experimento que los reportó.

**NO establecido — límite honesto de este experimento:**

- La carga aplicada es **CPU pura**. La contención original descrita (3 sesiones + ~20 worktrees
  corriendo `jest`) incluía **I/O y memoria**. Este experimento **no refuta** aquella observación:
  establece que *por CPU sola* el cuadro es distinto. Un `PantallaIngresos` que falle por I/O sigue
  siendo posible y este montaje no lo vería.
- Por eso `testTimeout = 20000` **se conserva**. No hay dato que lo justifique ni que lo refute.

---

## 5. Lo que sigue — y es decisión de diseño, no táctica

La causa está adentro de `ChatView.test.tsx` y `PantallaSoporte.test.tsx`. Ningún valor de timeout
la va a resolver: **ya se probó tres veces**. Lo que corresponde es entender por qué esas dos suites
tardan 48-70s cuando el resto de la app entera tarda 14s.

Hipótesis a validar (ninguna medida todavía — **no tratar como diagnóstico**):

- **H-A · timers + gesto.** Son las únicas suites que combinan gesto Pan de RNGH con audio. Si
  esperan por tiempo real en vez de avanzar timers falsos, la contención las escala linealmente.
- **H-B · `waitFor` en cascada.** El propio `jest.config.js` documenta que sin `await` en
  `fireEvent` los casos siguientes leen estado viejo y **cada uno agota su `waitFor`** — patrón que
  ya costó un sprint acá. Si sobrevive en estas dos suites, explicaría el 48-70s.
- **H-C · montaje repetido.** Cuántos `render` completos hace cada describe.

**Estas hipótesis requieren spike antes de tocar código** y la elección entre rediseñar los tests o
aislarlos del gate es del operador. Esta auditoría no la toma.

---

## 6. Reproducir

Los tres scripts usados viven en el scratchpad de la sesión y son idempotentes. El núcleo:

```bash
# piso de contención (control positivo) — escala hasta que el montaje discrimine
for CARGA in 4 12 24 40; do
  for _ in $(seq 1 $CARGA); do ( while :; do :; done ) & done
  npx jest --testTimeout=5000 > "carga-$CARGA.log" 2>&1   # log COMPLETO, sin tail
  kill $(jobs -p) 2>/dev/null
done

# veredicto — config real, sin flags, al piso encontrado
npx jest > "corrida-$i.log" 2>&1
grep -ho "Exceeded timeout of [0-9]* ms" corrida-*.log | sort | uniq -c
```

Verificar SIEMPRE el valor efectivo antes de creerle al archivo:

```bash
npx jest --showConfig | python -c "import json,sys; print(json.load(sys.stdin)['globalConfig']['testTimeout'])"
```
