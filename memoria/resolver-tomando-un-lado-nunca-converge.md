---
name: resolver-tomando-un-lado-nunca-converge
description: Cuando dos ramas arreglan cosas DISTINTAS en el mismo archivo, elegir un lado del conflicto siempre deja una mitad rota — y el CI reporta el mismo error round tras round
metadata:
  type: project
---

**LEER antes de resolver un conflicto donde las dos ramas tocaron el MISMO archivo por motivos
distintos.** Caso raíz: PR #265 (ODOBI hito 2), **4 rounds de CI**, los tres primeros la misma familia.

## Qué pasó

`GlassIcon.test.tsx` fue tocado por dos ramas que arreglaban cosas **ortogonales**:

| Rama | Qué agregó |
|---|---|
| `main` (hito 5, #266) | el `it.each` sobre los **21 nombres Odobi** |
| `odobi/hito2-relieve` | el render envuelto en **`<ThemeProvider>`** (el componente pasó a consumir el contexto) |

La resolución tomó **un lado** — y el archivo quedó con el catálogo viejo (`folder`, `mic`) **y sin**
provider. Medido sobre la punta de la rama:

```
grep -c "ThemeProvider"  → 0   ← el fix de esta rama, perdido
grep -c "conversacion"   → 0   ← los 21 nombres de main, perdidos
```

Cada round arregló **una** mitad y el merge siguiente la pisó. Por eso el CI mostraba el **mismo
error** tres veces seguidas: no era que el fix estuviera mal, era que nunca estaban las dos mitades
a la vez.

## La regla

Si las dos ramas arreglan cosas **distintas** en el mismo archivo, `--ours` / `--theirs` /
"aceptar el bloque de arriba" **nunca converge** — por construcción, cualquiera de los tres
descarta una mitad necesaria. Hay que **escribir el archivo combinado a mano**.

## El control: UN grep POR CADA MITAD, no uno solo

Un solo grep verde es exactamente lo que hace que la mitad faltante pase desapercibida.

```bash
grep -c "<marca de la mitad A>" <archivo>   # ≥1
grep -c "<marca de la mitad B>" <archivo>   # ≥1
```

Si uno da 0, todavía es una mitad — no lo pushees. Y el positivo del test aparte: que **falle** si
sacás el wrapper; si pasa con y sin él, envolviste algo que no era y el verde no mide nada.

## La barata que ahorró 3 rounds

`npx jest <archivo>` local antes de pushear: tarda segundos y evita 3 minutos de CI por round.
Ojo con el falso verde local del round 1: la suite pasaba porque `node_modules` **todavía tenía en
disco** el paquete (`expo-blur`) que la otra rama ya había sacado de `package.json`.

Relacionado: [[el-control-corrido-contra-la-base-equivocada]] ·
[[amend-en-checkout-compartido-pisa-el-commit-de-otro]] · [[orden-de-merge-por-el-estado-intermedio]]

## Refuerzo 2026-10-06 — dos APPENDS al final del mismo archivo, el mismo día: conflicto garantizado que ninguno de los dos lados ve venir

Appendée un `## Refuerzo 2026-10-06` al final de `memoria/instrumento-que-no-mira-nunca-falla.md`.
Planificación appendeó **otro**, distinto, al final del **mismo** archivo, el **mismo** día, y entró a
`main` en su #827. Resultado: `git merge origin/main` dio **un solo conflicto en todo el repo**, y fue
ese archivo — `web.py`, `types.ts` y `mock.ts` auto-mergearon sin ruido.

**Las dos mitades eran buenas y distintas** (la mía: «dos formas de no mirar»; la suya: «un archivo de
test que se LLAMA como la ruta da impresión de cobertura que no tiene»). `--ours` o `--theirs` habría
borrado una contribución entera y el repo no mostraría ningún síntoma: un archivo de memoria con un
bloque menos se lee perfectamente bien. **Resolución correcta: los dos bloques, en orden**, y el control
es contar — `grep -c '^## Refuerzo 2026-10-06'` → **2**, y 0 marcadores.

**Y el agravante, que es la parte nueva:** una hora antes yo había escrito en un mensaje a planificación
que su refuerzo **«no está escrito en el archivo»**. Lo afirmé mirando **mi copia**, que era vieja. O
sea que el append ciego no sólo produce el conflicto: **produce una afirmación falsa sobre el trabajo de
la otra sesión**, con tono de medición.

**Dos reglas operativas:**
1. **Antes de prometer que no hay colisión, corré `git merge-tree --write-tree --name-only HEAD
   origin/main`.** Predice los conflictos **sin tocar el working tree** — nada de merge de prueba, nada
   de stash. Es la medición que me faltaba.
2. **Un append al final de un archivo compartido es el patrón de máxima colisión.** Si dos sesiones
   escriben el mismo archivo el mismo día, el conflicto es casi seguro y **ninguna lo ve desde su lado**.
   Cuando sea posible, anclá la inserción a una sección propia en vez del final del archivo.

Ver [[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]] y
[[amend-en-checkout-compartido-pisa-el-commit-de-otro]].

---

## ⚠️ REFUERZO 2026-11-02 — la EXCEPCIÓN: si el artefacto es GENERADO, tomar un lado es inocuo

La regla de arriba vale para artefactos **escritos**. Hoy encontré su excepción, y conviene no
confundirlas porque el procedimiento es opuesto.

**Lo medido.** El backlog del sprint tiene una **tabla-índice generada** por
`scripts/sprint-estado.py --tabla`. Dos ramas la tocaron (yo bajando `SM-N10/N11/N12`, frontend2
marcando `SM-N9`) y el conflicto cayó **sólo ahí** — los bullets del cuerpo mergearon solos, porque
cada ficha vive en su propio bloque. Resolví tomando el lado `HEAD`, donde `SM-N9` figuraba
`DOD-PARCIAL`, y **después de regenerar la fila quedó `✅ TERMINADO` con los dos shas de frontend2**.
Pasó **dos veces** en la misma tarde (main se movió otra vez entre mi push y el merge).

**Why:** en un artefacto generado el lado que elegís no contiene información — es una **proyección**
del cuerpo. Descartar la mitad del otro ahí no pierde nada, porque la mitad real nunca estuvo en la
tabla: estaba en el bullet que mergeó limpio. Lo que convierte «tomar un lado» en pérdida es que el
texto elegido **sea** la fuente; cuando es una derivación, la fuente sobrevive intacta y el
instrumento la vuelve a proyectar.

**How to apply:** ante un conflicto, la primera pregunta no es «qué lado conservo» sino **«este
bloque es fuente o es derivado?»**. Si hay un comando que lo produce —tabla, índice, lockfile,
snapshot, `--tabla`, un `generated` en el encabezado— resolvelo **corriendo el comando**, no
eligiendo: `git checkout --ours <doc>` (da igual el lado) y después el generador, y el control es
que las **dos** mitades aparezcan en la salida. Si es fuente, sigue valiendo todo lo de arriba: un
grep por cada mitad. Y si el conflicto cae en los **dos** tipos de bloque en el mismo archivo, son
dos problemas distintos en el mismo diff — tratalos por separado.
