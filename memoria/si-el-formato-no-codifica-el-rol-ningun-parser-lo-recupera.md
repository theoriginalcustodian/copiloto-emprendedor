---
name: si-el-formato-no-codifica-el-rol-ningun-parser-lo-recupera
description: Un extractor no puede distinguir un path citado como FUNDAMENTO de uno que es el ENTREGABLE si el formato escribe los dos igual — no es falta de ingenio del parser, la información no está en el texto. La raíz es el protocolo, y protocolo + parser cambian en el MISMO PR
metadata:
  type: feedback
---

**El caso (2026-09-29).** `scripts/plan-drift-check.sh` quedó en `rc=1` marcando `FACTIDFIX` como
drift. Falso positivo: la fila de `PLAN.md` citaba un archivo de `memoria/` **como fundamento** («esto
se decidió por tal lección»), no como **entregable**. El parser extrae artefactos de la fila y los
compara contra lo que `main` tocó; un path citado por fundamento parece un entregable sin cambios.

**La lista negra obvia —excluir `memoria/`— ciega las filas cuyo entregable *sea* una lección**, y
convierte un falso positivo en falso negativo. El positivo grita; el negativo no avisa nunca. Peor
cambio.

## Las dos hipótesis de discriminador que refuté, midiendo

| hipótesis | medición | veredicto |
|---|---|---|
| **posición de columna**: el fundamento va siempre en la última | citas en 6/7, 6/7 y 4/6 — las tablas no comparten cantidad de campos | ✗ no discrimina |
| **edad / precedencia**: el fundamento es viejo, el entregable es de hoy | los dos archivos nacieron hoy (`427b5e3e` el fundamento, `5278a169` el entregable) | ✗ no discrimina |

## La raíz

**El formato no codifica el rol.** `memoria/x.md` se escribe igual en los dos casos, así que la
información que el parser necesita **no está en el texto** — no hay extractor, por bueno que sea, que
la recupere. Perseguir un discriminador más astuto es trabajar sobre el síntoma.

**El arreglo es del protocolo, y va con el parser en el MISMO PR:**

- toda cita de **fundamento** en una fila se escribe `(ver: <path>)`; el path a secas queda reservado
  para el **entregable**;
- el parser descarta los segmentos `(ver: …)` antes de extraer;
- **los dos controles en el mismo commit**: una fila-fixture que cite en `(ver: …)` un archivo que
  `main` tocó hoy **no** debe marcar, y otra que lo cite como entregable **sí** debe marcar. Sin el
  segundo, la exclusión podría estar cegando todo y saldría verde igual
  ([[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]).

Separarlos en dos PRs deja una ventana en la que el parser ya descarta `(ver: …)` y nadie lo escribe
todavía, o al revés: el formato cambió y el parser sigue marcando. **El protocolo y su parser son un
solo cambio.**

## El corolario que ya pagamos

Esta misma lección se aprendió el 28/09 y **se perdió**, porque quedó escrita sólo en
`coordinacion/`, que **no está versionado**: un clon no la tiene. Por eso el formato nuevo se
documenta en el **docstring del script**, que sí se versiona, además de en `COORDINACION.md`. Una regla
que vive sólo en el buzón no sobrevive al clon.

Emparentado: [[el-nombre-es-una-hipotesis-sobre-el-contenido]] (el nombre no dice el contenido),
[[un-id-que-fabrica-el-instrumento-no-puede-parecerse-a-uno-real]] (el mismo problema de roles, del lado
de quien escribe), [[un-control-a-nivel-archivo-no-ve-la-divergencia-adentro]].
