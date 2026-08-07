---
name: el-chequeo-de-tipos-que-compilaba-el-proyecto-vacio
description: El paso `npx tsc --noEmit` del job web del CI nunca chequeó un solo archivo — el tsconfig.json de copiloto-web es de REFERENCIAS ("files":[]), así que tsc compilaba el proyecto vacío y salía exit 0
metadata:
  type: project
---

**LEER antes de confiar en que un `tsc --noEmit` verde significa algo.**

`scripts/ci/web.sh` (y antes `tests.yml`, de donde se portó fiel) corría:

```bash
cd apps/copiloto-web
npx tsc --noEmit      # <- exit 0 SIEMPRE, mirando cero archivos
```

`apps/copiloto-web/tsconfig.json` no es un proyecto: es un archivo de **referencias**.

```json
{ "files": [], "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }] }
```

Sin `-p` ni `--build`, `tsc` toma ese `tsconfig.json`, ve `"files": []`, compila **nada**, y sale 0.
Ni un aviso. Arreglado el 2026-08-07 con `npx tsc --build --force --noEmit`.

## El diferencial que lo probó (con 10 errores de tipo reales en el árbol)

| comando | resultado |
|---|---|
| `npx tsc --noEmit` | **exit 0**, sin una línea de salida |
| `npx tsc --build --noEmit` | **exit 2**, los 10 errores enumerados con archivo y línea |

Misma máquina, mismo árbol, mismo segundo. La diferencia entera está en si `tsc` sabe **qué**
compilar.

## Cómo apareció (y por qué no antes)

Agregué un campo obligatorio a `MeResponse` **contando con que `tsc` me enumerara las fixtures rotas**
— es la razón por la que lo hice obligatorio y no opcional. Corrí el chequeo esperando ~11 errores y
salió **vacío**. Ese vacío no era un hallazgo: era una pregunta ([[vacio-no-es-hallazgo-correr-el-control]]).
El control tardó 30 segundos y dio vuelta el diagnóstico.

Nadie lo notó en meses porque **un chequeo de tipos que pasa siempre es indistinguible de un
código que siempre tipa bien**. El fallo era hacia el "sí", que es el que no protesta —
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] al revés: acá el mecanismo roto hacia el **sí**
tampoco da síntoma, porque lo que produce es exactamente lo que esperás ver.

## Lo que generaliza (y es lo caro)

**Un runner puede correr, salir 0 y no haber mirado nada.** No es propio de TypeScript: es de todo
comando que recibe *qué mirar* de un archivo de configuración —`pytest` con un `testpaths` que no
matchea, `eslint` sobre un glob vacío, `rg` sobre un path que no existe—. Los tres salen 0 y ninguno
dice "no encontré nada que hacer".

**La pregunta que lo caza no es "¿pasó?" sino "¿sobre cuántos elementos miró?"**
([[instrumento-que-no-mira-nunca-falla]]). Todo gate necesita reportar su denominador, o al menos
haber sido visto fallar **una vez a propósito** — el control diferencial de arriba es exactamente eso.

**Y el detalle del porte:** `scripts/ci/web.sh` copió el comando **tal cual** de `tests.yml`
(era el criterio correcto para ese contrato: portar fiel, no mejorar de paso). Portar fielmente
preserva el comportamiento **incluido el roto**. Un porte fiel no es una verificación.

## Alcance medido

Sólo `copiloto-web`. `apps/mobile` y `packages/core` tienen `include` real en su tsconfig y sí
chequean — verificado leyendo los tres archivos, no asumido por analogía.

## Detalle

`--force` va a propósito: sin él, `--build` usa `.tsbuildinfo` y se saltea lo que "no cambió". Un
gate que mide la caché en vez del árbol es otra forma del mismo problema.
