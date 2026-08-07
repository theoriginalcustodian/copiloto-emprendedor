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
