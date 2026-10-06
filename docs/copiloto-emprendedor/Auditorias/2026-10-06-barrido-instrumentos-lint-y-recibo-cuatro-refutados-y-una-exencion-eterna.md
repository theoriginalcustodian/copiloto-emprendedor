# Barrido de los instrumentos del `lint` y del recibo: **cuatro refutados, una exención eterna, y el patrón que el repo debería copiar**

**Auditoría · 2026-10-06** · sobre `testid_paridad.py`, `idemkey_paridad.py`, `.gitleaksignore`,
`recibo-cubre.sh`, `gate.sh` (campo `sucio`) y `medir-indice-memoria.py` · medido en **`origin/main`**,
después de mergear #853 (`d101ab7c`).

**Veredicto: los instrumentos de esta pasada RESISTEN.** Cuatro candidatos murieron al medirlos y queda **una
fila, baja**. Lo entrego igual —y sobre todo el positivo— porque después de un día de hallazgos, saber **qué
está bien construido y por qué** es lo que hace replicable el diseño.

---

## 1 ✅ El patrón positivo del día: **una exención que caduca por ESTADO, no por fecha**

`testid_paridad.py` perdona **473** ids de paridad testID↔data-testid. Eso suena a baseline inauditable —465
son del 2026-09-22, con el mismo motivo— y es lo contrario, por **`:172-180`**:

```python
for clave in excepciones:
    if "::" not in clave:                              errores.append("[FORMA] …")
    elif not existe_en_algun_lado(clave, mobile, web): errores.append("[STALE] el id ya no existe …")
    elif clave not in drift:                           errores.append("[STALE] ya tiene su par …")
```

**Un trinquete bidireccional:** cada excepción declarada tiene que **seguir siendo drift real, en la misma
pantalla**. Si el id desapareció → rojo. Si **ya se arregló** → rojo. Las dos ramas con **control positivo
propio** (`test-testid-paridad.sh:96` y `:110`), más `[FORMA]` (`:136`) y fail-closed si el JSON no parsea
(`:160-162`). Las 473 tienen `id`, `motivo`, `fecha` y `pantalla`: **0 sin motivo, 0 sin fecha**.

> **Por qué es el diseño correcto y es generalizable:** una exención con dos años que **sigue** siendo drift
> real es legítima; una de ayer que ya se arregló es ruido. El trinquete distingue las dos **sin que nadie se
> acuerde de revisar**. Es el antídoto exacto de la exención que envejece sola
> (`[[un-umbral-calibrado-es-una-foto-del-sistema-de-ese-dia]]`) y de los 34 exentos que citaban un acta de 2
> casos (`[[exencion-sin-autoridad]]`). **Una caducidad por FECHA habría sido peor:** habría tirado
> exenciones todavía válidas y conservado las obsoletas.

Y un detalle que casi reporto como hallazgo: el mensaje final imprime `"0 excepciones obsoletas"` como
**literal**, que es justo la forma de un control que no mide. Acá es **correcto**: esa línea sólo se alcanza
después del `if errores: return 1`. El literal es la consecuencia lógica, no una afirmación sin respaldo.

## 2 — Los cuatro candidatos, y por qué murieron

| busqué | murió porque |
|---|---|
| las 473 excepciones son una foto que nadie revisa | **el trinquete de `:172-180`**, con control positivo de las dos ramas |
| `.gitleaksignore` declara dos veces los mismos hallazgos, por descuido | **es deliberado y está justificado en el archivo**: con `depth=1` el modo git re-detecta el mismo contenido bajo un **SHA nuevo** que la allowlist no puede prever — lo demostró el CI real de #601. De ahí el doble formato (con SHA / sin SHA) |
| el recibo compara **árboles**, así que un archivo **untracked** cambia la corrida sin cambiar el árbol | **`gate.sh:36`** usa `git status --porcelain` —que **sí** lista untracked— y su comentario nombra el caso: *«o un archivo nuevo entra a la corrida sin estar en ningún árbol»*. Además `sucio` va **por job** y acumula (`:220-222`), para que *«una corrida sucia de ayer no quede tapada por el `sucio:false` de la corrida limpia de hoy de otro job»* |
| el `⚠️` del índice de memoria es una alarma sin dueño que nadie atiende | **HISTORIA.md creció +7,3 KB en 6 días** (54.598 → 58.344 → 60.457 → **61.954**) mientras el índice oscila pegado al techo (23.4k–23.9k). **Alguien baja entradas a diario**: el `⚠️` no es una alarma desatendida, es el **indicador de presión** de un sistema que trabaja al 99% del presupuesto **por diseño** |

El medidor del índice merece una nota aparte: es el instrumento **más autocrítico** del repo. Lleva escritos,
en sus propios comentarios, los errores que ya pagó — medir **chars** donde el límite es **bytes**
(`23875/24000 [OK]` sobre un índice que en disco pesaba más), el guard que **falla abierto en su caso de
activación** (24000/24000 exactos con exit 0), y una atribución equivocada por **dos causas suficientes**
(adjudicó al límite de líneas lo que también explicaba el de bytes). Hoy mide
`peso = len(texto.encode("utf-8"))` y tiene **control negativo del parser** (`<10` refs ⇒ «el parser está
roto»). Estado medido: **23.793/24.000 bytes · 180/200 líneas · 374 entradas, todas alcanzables · margen: 1
línea**.

## 3 🔴 La fila: `IGNORESINTRINQUETE` — **baja**

Dos mecanismos de exención en el mismo repo, y sólo uno caduca.

Las exenciones de historia de `.gitleaksignore` son `commit:archivo:regla:línea`: si el contenido cambia, el
fingerprint deja de matchear y **no exime nada** — inofensivo. Pero las de **árbol** son
**`archivo:regla:línea` sin SHA**:

```
docs/copiloto-emprendedor/2026-07-23-harness-e2e-cierre-sprint-device-al-dia.md:generic-api-key:37
memoria/checkpoints/checkpoint_2026-06-30_2008_copiloto_b_skeleton_merged.md:generic-api-key:55
```

⇒ **Eso perdona «lo que caiga en la línea 37 de ese archivo bajo `generic-api-key`», no el identificador que
se revisó a mano.** Es un doc, y los docs se editan: si en esa línea queda algún día un secreto **real** que
la regla cazaría, **el guard lo exime en silencio**. El perdón está anclado a una **posición**, no al **hecho
revisado**.

Y lo que lo vuelve fila: **nada audita esas 5 líneas.** El único uso de `.gitleaksignore` en todo el repo es
pasárselo a gitleaks (`secretos-check.sh:60`). **No existe el equivalente del trinquete del §1** — y es el
mecanismo de exención del guard **fail-closed** de un repo **público**, mientras el otro mecanismo del mismo
repo se auto-limpia.

**DoD (dueño: planificación), reusando lo que ya existe:**

1. El trinquete copiado de `testid_paridad.py:172-180`: correr el escáner **sin** `--gitleaks-ignore-path`,
   listar los fingerprints reales, y exigir que **cada línea declarada siga correspondiendo a un hallazgo
   real**. Una que no → rojo `[STALE]` con «sacala». ~15 líneas, patrón ya escrito y testeado.
2. Control positivo de las dos ramas: (a) un fingerprint inventado en un `.gitleaksignore` de fixture → rojo;
   (b) el `.gitleaksignore` real de hoy → **verde**. El (b) es el que prueba que no grita en el caso normal.
3. La alternativa más barata, si se prefiere: anclar la exención de árbol al **contenido** revisado en vez de
   a `archivo:línea` (fingerprint por contenido, o mover el identificador a un fixture de nombre estable). El
   hueco desaparece sin necesidad del trinquete.

## 4 — Lo que NO medí, explícito

- **No corrí `gate.sh` completo**: su job `backend` toma el candado del stage en el VPS, y ese estado
  compartido no es de esta sesión.
- **No toqué `.gitleaksignore`, `scripts/` ni `memoria/MEMORY.md`**: son de planificación. El índice lo
  **corrí**, no lo edité — y los tres refuerzos de memoria de hoy fueron **adentro** de entradas existentes,
  con `MEMORY.md` en 0 líneas de diff, justamente porque el margen es de una línea.
- **`idemkey-paridad-excepciones.json` tiene 0 excepciones** hoy, así que su trinquete no se ejercitó contra
  datos reales; su test sí lo cubre (`test-idemkey-paridad.sh:91`).
