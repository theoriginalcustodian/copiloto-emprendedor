# Dependabot: las 106 alertas desagregadas (triage read-only, sin bumps)

> **Medido el 2026-11-05 @ `2235f543`** (`origin/main`): `gh api repos/{owner}/{repo}/dependabot/alerts?state=open` devuelve **106 abiertas**.
> Pregunta que responde: *¿qué contienen las 106 y cuáles pesan?* No aplica ningún bump (van por lote, no por alerta).
> Instrumento: script de clasificación sobre el JSON de la API + `package-lock.json` de `origin/main` (versión instalada y padres).

## Titular (corregido dos veces el 2026-11-05)

**Las 106 abiertas son todas npm de tooling/frontend; la superficie python (la que corre en el request path) NO tiene alertas abiertas, y eso es cierto, no ceguera del instrumento.** Dos lecturas previas estaban mal y se retiran:

- ~~«Dependabot no mira pip»~~: **falso.** Dependabot SÍ alertó sobre python: **24 alertas pip** (PyJWT ×13, anyio ×3, urllib3 ×3, cryptography, certifi, brotli, y variantes de nombre) que pasaron a `fixed` el 2026-11-05 09:51Z al mergear el bump (#1669), y abrió los PRs #1664-#1667 (pyjwt 2.15.0, certifi, urllib3, brotli) el 2026-11-05 01:30Z. La cifra «0 pip» de las abiertas es el estado **posterior** al arreglo. (Mi primera comprobación con `state=all` devolvió vacío por un error de consulta; la correcta es `state=fixed`.)
- ~~«cero alertas = ausencia de instrumento»~~: se sostenía solo en esa consulta errónea y queda retirada.

Evidencia python:
- **2026-11-04 (baseline pre-bump):** `pip-audit 2.10.1` sobre `requirements.txt`, 49 dependencias; vulnerables PyJWT 2.13.0 (15 advisories, fix minor), cryptography 49.0.0, anyio 4.14.1, certifi, urllib3. `Seguridad/evidencia/2026-11-04/deps/pip-audit.json`.
- **Remediado:** `requirements.txt` en `main` con PyJWT 2.15.0, cryptography 50.0.0, anyio 4.14.2, certifi 2026.10.18, urllib3 2.8.0 (#1669, `SEC-B1-2` en `BITACORA.md`), desplegado en el venv de prod con smoke 43/43.
- **2026-11-05 (post-bump):** `pip-audit` sobre el `requirements.txt` actual → 49 dependencias, **0 vulnerables**; control positivo en la misma corrida: `PyJWT==2.13.0` → 15 advisories.
- El grafo de dependencias lista 49 paquetes `pkg:pypi` (incl. `pyjwt@2.15.0`).
- **No hay bump de PyJWT pendiente:** ya está en 2.15.0.

## Hallazgos del triage npm

1. **Cero alertas de pip** (ver titular: las 24 alertas pip ya estaban `fixed` tras el bump).
2. **Ninguna alerta está en el camino de request del backend.** Lo npm es el frontend web (`apps/copiloto-web`, 32), el workspace mobile/raíz (72) y dos manifests de vitest (2).
3. **«runtime» de GitHub no significa «se envía al usuario».** El campo sale del lockfile (paquete no marcado `dev`). En el lock raíz, los paquetes «runtime» cuelgan de `@expo/cli`, `metro`, `react-devtools-core`, `@expo/plist`, `xcode`, `query-string`: **tooling de build/dev server de Expo**. Verificado por padres en el lock. **No verificado** si alguno termina en el bundle de la app.

## Desagregado

| Eje | Cifra |
|---|---|
| Severidad | critical 5 · high 55 · medium 36 · low 10 |
| Scope según GitHub | runtime 59 · development 47 |
| Manifest | lock raíz (mobile) 72 · lock `apps/copiloto-web` 32 · `packages/core/package.json` 1 · `apps/mobile/package.json` 1 |
| Sin parche publicado | 3 |

**Las 5 critical son 2 paquetes:** `tinypool` ×4 (dev, vía vitest; el parche exige major 1→2) y `shell-quote` ×1 (marcado runtime, pero su padre es `react-devtools-core` = tooling; parche minor 1.10→1.11).

## Por paquete (consolidado por manifest; «bump» = distancia entre versión instalada en el lock y primer parche)

| Manifest | Scope | Paquete | Alertas | Máx. sev. | Bump |
|---|---|---|---|---|---|
| raíz | runtime | @xmldom/xmldom | 23 | high | minor/patch |
| raíz | runtime | node-forge | 12 | high | patch |
| raíz | runtime | brace-expansion | 5 | high | **major** (la rama 1.x) |
| raíz | runtime | browserslist, compression, nanoid, postcss, source-map-js | 6 | high | patch |
| raíz | runtime | decode-uri-component, shell-quote, baseline-browser-mapping | 4 | critical/high | minor |
| raíz | runtime | image-size, js-yaml, uuid, zod, glob, minimatch | 8 | high | **major** |
| raíz | runtime | deepmerge | 1 | low | sin parche |
| raíz | dev | vite ×5, js-yaml ×2, brace-expansion | 8 | high | patch |
| raíz | dev | tinypool ×2, vitest, @vitest/mocker ×2 | 5 | critical | **major** |
| web | dev | fast-uri ×11, vite ×5, postcss ×2, browserslist, source-map-js | 20 | high | patch |
| web | dev | tinypool ×2, vitest, @vitest/mocker ×2, minimatch, brace-expansion ×3 | 9 | critical | **major** |
| web | dev | baseline-browser-mapping, serialize-javascript, deepmerge | 3 | medium/low | minor / sin parche |
| mobile, core | dev | vitest | 2 | medium | **major** |

## Qué se resuelve cómo (para decidir por lote)

- **Patch/minor sin cambio de contrato (la mayoría por volumen):** `@xmldom/xmldom`, `node-forge`, `fast-uri`, `vite`, `postcss`, `browserslist`, `compression`, `nanoid`, `source-map-js`, `js-yaml` 3.x en dev. Un `npm update` acotado + `npm audit` + gate. Subir solo `@xmldom/xmldom` cierra 23 alertas.
- **Major = decisión, no tarea:** `vitest` 3→4 (arrastra `tinypool` critical y `@vitest/mocker`; 12 alertas, todas dev), `zod` 3→4, `uuid` 7→11, `image-size` 1→2, `brace-expansion`, `glob`, `minimatch`, `js-yaml` 4. Varios son transitivos de Expo: se mueven subiendo el SDK de Expo, no a mano. Empata con **SEC-D11** (requiere build EAS).
- **Sin parche:** `deepmerge` (low): aceptar o esperar.

## Lectura de riesgo

- Las **5 critical son tooling** (vitest/tinypool en dev; shell-quote en react-devtools-core). Ninguna en el camino de request del backend.
- El grueso «high» de runtime son parsers de la cadena de Expo CLI (xmldom, node-forge, image-size). Importan si alguien corre `expo` con entrada no confiable (plist, imagen, certificado). El build es del equipo y el repo es público: exposición baja, no cero. El riesgo de CI disparado por PR externo **no se midió**.
- «106» no tiene unidad: son 38 combinaciones paquete×manifest, y el conjunto de bumps patch/minor que cierra la mayoría de las high es corto.

## Preguntas abiertas (no se afirman)

1. ~~¿Dependabot escanea pip?~~ **Resuelta:** el grafo cubre pip; el vacío era de la base de avisos. Pendiente de decisión (no hecho): correr `pip-audit` de forma recurrente (hoy solo corridas puntuales de evidencia). Se agregó `.github/dependabot.yml` (version updates de pip y npm, semanal, sin majors) como gobernanza día 0; ver nota abajo.
2. **¿Algún «runtime» llega al bundle de la app?** Verificarlo con el análisis del bundle de Metro, no por el lock.
3. No se midieron las alertas cerradas/descartadas (solo `open`).

## No hecho

Ningún bump, ningún `dismiss`, ninguna PR de Dependabot tocada.

## Nota: `.github/dependabot.yml` y su control positivo

Creado con tres jobs semanales (pip raíz, npm raíz, npm `apps/copiloto-web`), agrupados en minor/patch y sin majors. **Control positivo exigido:** que exista no prueba que dispare. Se comprueba, tras el merge, con (a) una corrida «Dependabot Updates» en Actions por cada ecosistema y (b) al menos un PR de `dependabot[bot]` de pip. **Resultado medido (2026-11-06 ~02:50Z):** corridas «Dependabot Updates» creadas para los tres ecosistemas (npm `apps/copiloto-web` success, pip e npm raíz en curso al medir) y PR #1721 de `dependabot[bot]` abierto para npm web. El PR de pip no se había visto al cierre de esta medición: pendiente de comprobar.
