# Auditoría — las TERMINADO del sprint de correcciones, contra su propia evidencia

- **Fecha:** 2026-11-03
- **Sesión:** auditoría
- **Contrato:** `2026-11-03_contrato_planificacion-a-auditoria_TU-FRENTE-auditar-los-66-TERMINADO-…` (buzón).
- **Corpus:** `docs/copiloto-emprendedor/2026-11-02-BACKLOG-sprint-correcciones-mapa.md`, leído siempre con `git show origin/main:…`, nunca del checkout compartido.
- **SHAs medidos:**
  - el barrido mecánico, @`f038b989`;
  - la lectura DoD contra Cierre, @`f038b989` → `9225e4ee`;
  - SM-N52 y el instrumento, @`4bd2df64`.
- **Qué NO hace este doc:** no marca fichas ni toca producto. Cada hallazgo es una fila para que planificación la asigne.

## Veredicto

**Cobertura: 63 de 63 TERMINADO leídas @`9225e4ee`, más SM-N52 @`4bd2df64`.**
- El contrato decía 66. Durante la auditoría, planificación bajó 5 a `DOD-PARCIAL` por hallazgos de este mismo trabajo: J1, J4, N13, N19 y N32.
- El 63 sale del conjunto real, no del contrato. Control: el cruce de los ids nombrados en los 13 lotes contra el conjunto da 0 sin nombrar.

| Clase | N | Ids |
|---|---|---|
| CONFIRMADO | 9 | H1 G4 · H3 L3 · H4 J1 · H8 N13 · H10 N19 · H12 J4 · H14 N32 · H15 N25 · H18 N52 |
| PLAUSIBLE | 3 | H7 N18 · H11 N43 · H17 K5 |
| Clase transversal | 4 | H6 · H9 · H13 · H15-clase |
| Retractado por mí | 3 | H2 · H5 · H16 (ver «Errores del auditor») |

Unidad: **hallazgo** = un punto del DoD de una ficha sin evidencia que lo acredite, o una evidencia que no puede acreditarlo. No es «ficha mal marcada»: una ficha puede tener más de uno.

## Hallazgos confirmados

Formato: **FICHA** · qué dice el Cierre · qué le falta · prueba.

- **H1 · SM-G4.**
  - **Qué dice el Cierre:** `sin-codigo`, «Veredicto: DEMORA».
  - **Qué le falta:** el DoD dice «**Se corrige igual en los dos casos**», y no hay corrección. Se midió en dev-client, no en release.
  - **Prueba:** los literales de las fichas SM-G4 y SM-I6.
- **H3 · SM-L3.**
  - **Qué dice el Cierre:** «El DoD se RETIRA, no se declara satisfecho».
  - **Qué le falta:** un DoD retirado por decisión no es un DoD cumplido, y la cifra TERMINADO lo cuenta.
  - **Prueba:** de acá sale la distinción que planificación adoptó. Un DoD que contempla la salida negativa se cumple al tomarla (SM-N47, SM-K9). Un DoD retirado se cancela (SM-L3).
- **H4 · SM-J1.**
  - **Qué dice el Cierre:** el dock en 80c5ef21.
  - **Qué le falta:** la mitad D4, documentar en el mapa «Te deben» y BUSCAR.
  - **Prueba:** `git grep -il "te deben" origin/main -- "Prototipo frontend/odobi-ui/"` da 0, con el control positivo `"Mi d"` = 5.
  - **Estado:** ya está DOD-PARCIAL.
- **H8 · SM-N13.**
  - **Qué le falta:** el DoD 4, «Corrido en el VPS… con el conteo pegado en el `cierre_`».
  - **Prueba:** no está ni en el Cierre, ni en el commit 7811aad1, ni en el `cierre_`. Control: el `cierre_` de N8 sí trae «93 passed».
  - **Estado:** ya está DOD-PARCIAL.
- **H10 · SM-N19.**
  - **Qué le falta:** el DoD 3, el test «rojo si se persiste sin confirmación» (`git grep SM-N19 -- apps packages` = 0), y el DoD 4, dictar → card → **corregir** → confirmar.
  - **Prueba:** la corrida de `evidencia/SM-N19.md` termina en «Descartar».
  - **Estado:** ya está DOD-PARCIAL.
- **H12 · SM-J4.**
  - **Qué le falta:** el DoD 3, la captura del caso `facturas_atribuibles: false` con el «—». El caso existe en prod, en el tenant `48a9d75f`.
  - **Estado:** ya está DOD-PARCIAL.
- **H14 · SM-N32.**
  - **Qué le falta:**
    - DoD 4: «la barra del tope con la línea del monotributo» quedó «FUERA del sprint y escalado». Es la forma de SM-L3.
    - DoD 6: entrada 42 del corpus, 0 menciones.
    - DoD 3: la decisión de FACTURACIÓN.
  - **Estado:** ya está DOD-PARCIAL.
- **H15 · SM-N25.**
  - **Qué dice el Cierre:** «a6600880 es la procedencia del codigo».
  - **Qué es ese sha:** `a6600880` es `feat(inteligencia): … (SM-N45) (#1520)`, que no toca el chat. Los commits reales son `6335f883` (#1440) y `fafd7cdb` (#1444), los dos en main.
  - **Qué le falta:** además, los DoD 1 (ANTES/DESPUÉS) y 2 (flotando, demostrado scrolleando) no tienen evidencia en el Cierre ni en los commits.
- **H18 · SM-N52.**
  - **Qué le falta:** el DoD 3, «al menos uno de esos 9 tests da ROJO si se le quita el aislamiento».
  - **Prueba:** 0 menciones de `DoD 3|rojo|positivo|mutante` en el Cierre, 0 en el cuerpo de b45ab84f y ningún `cierre_` en el buzón.
  - **Por qué pesa:** es un control de **seguridad**, y que el `skipped` baje prueba que los tests corren, no que muerden.
  - **Además:** el DoD 2 dice «exactamente 9 (80 → 71)», cuando el 9 eran lecturas de `environ.get` según el propio `Medido:`. El Cierre da -35 atribuible, pero no enmienda el DoD: leído literal, el DoD 2 da rojo.

## Plausibles

- **H7 · SM-N18.**
  - **Qué hay:** el DoD 3 pide la decisión sobre las tarjetas persistidas de toolkits no soportados. La única evidencia es que la fila `instagram` de `48a9d75f` pasó a `hecha` (`evidencia/SM-N18.md:7`).
  - **Por qué es PLAUSIBLE:** una fila que cambió no dice qué pasa con la próxima. No medí por qué cambió.
- **H11 · SM-N43.**
  - **Qué hay:** tres cifras de hex sin denominador común: el DoD dice 75, el Cierre 30 y el commit 14. `tokens.ts` tiene 122 ocurrencias @main.
  - **Qué le falta:** una frase que diga sobre qué conjunto cuenta cada una.
- **H17 · SM-K5.**
  - **Qué hay:** las dos capturas versionadas están en piel oscura y son previas al fix b3667d01, así que el punto «el fondo blanco sobresale de las tiles» no se puede ver en ellas. «desde …» no aparece.

## Clases transversales

- **H6 · la evidencia de un DoD vive sólo en el buzón.**
  - `coordinacion/` no está versionado (`.gitignore`) y muere en un clon.
  - **Cota superior: 40 de 67**, con precisión medida a mano de 3 de 6. No convertí la cota en una estimación.
  - Planificación ya la hizo norma: `2026-11-03-norma-la-evidencia-de-un-DoD-vive-en-un-doc-versionado-no-en-el-buzon.md`.
- **H9 · sondas sin versionar.**
  - `git ls-tree -r --name-only origin/main | grep -i probe_` da 0.
  - Quedan fuera las sondas que acreditan DoD de N1, N2, N8 y N13, que piden «la MISMA sonda» antes y después. Control: `scripts/sonda_cobro_llm_sm_n21.py` sí está versionada.
- **H13 · capturas de device del 03-11 sin versionar.**
  - **Al menos 10 TERMINADO** citan capturas `b1-*`, `b3-*` y `n*-canonico` que no están en origin/main. Esa cifra es una cota inferior, porque la regex sólo ve nombres con `canonico`/`local`.
  - Contraste: la pasada del 02-11 sí versionó las suyas en `2026-11-02-sprint-correcciones-evidencia/`.
- **H15-clase · el gate mide ancestría, no pertinencia.**
  - Cualquier sha de main pasa `sprint-estado.py`.
  - **Instrumento versionado:** [`instrumentos/cierre-sha-nombra-la-ficha.py`](instrumentos/cierre-sha-nombra-la-ficha.py).
  - **Resultado @`4bd2df64`:** 93 shas ancestros citados, 21 no nombran su ficha (casi todos son referencias cruzadas rotuladas).
  - **Fichas SIN ningún sha propio: 4.** La única real es N25. L2 cita el dock de I2 a propósito, Z2 cita el id renombrado SM-A2 y N49 tiene el commit sin `SM-N49`.
  - **Controles:** el positivo es N25; el negativo, N23 con 2 propios.
  - **Fila propuesta:** que el gate exija «el mensaje del sha nombra la ficha, o el Cierre lo rotula como cruzado».

## INFO (sin acción salvo decisión)

- **SM-I3:** el DoD 2-3 se retiró explícitamente, porque el estado deshabilitado no es alcanzable. Es la forma correcta.
- **SM-K1:** «admin sí ve Homologación» no se probó en device; los controles positivos de backend están en 476f508a.
- **SM-N26:** el DoD 4 quedó refutado por la premisa («no hay modo que leer»), pero no se retiró explícitamente.
- **SM-N30:** la evidencia de los DoD 2-4 vive en el cuerpo de la ficha. El comentario de `textosEntrada.ts:23-26` está corregido @main.
- **SM-N20 y SM-Z2:** no tienen campo `DoD:`. N20 conserva al frente el párrafo «Por qué NO es TERMINADO», de una versión anterior.
- **SM-N46:** el DoD 4 (adversarial) no se cita. Existe `test_K07B_…` (`test_plata_por_voz.py:489`, 2026-09-21), pero es con fakes.
- **SM-N40:** el DoD 4 (leer la skill si hay refs imperativas) se cumple en la condición y no deja rastro.
- **SM-N17:** el Cierre acredita «deja de avisar» en la cuenta canónica, donde el 0 sale con o sin fix. El estado de la cuenta del operador sí está medido, pero en `evidencia/SM-N18.md:7` y no en el Cierre de N17.

## Modelos de un buen Cierre (para copiar la forma)

- **SM-N23:** 5 de 5 punto por punto, con `motionevent`, el bundle verificado contra main y 6/6 a dos alturas.
- **SM-N4:** el diferencial que mueve **una** variable, con la sombra revertida y la misma sesión, para descartar el instrumento antes de diagnosticar.
- **SM-N33:** las dos direcciones del defecto, el adversarial mismo-CUIT A/B y 71 passed en el VPS.
- **SM-H2:** los dos adversariales nombrados y el VPS con 2648 passed.
- **SM-N35:** el gate «sólo monotributo» verificado en las dos direcciones en device.

## Errores del auditor (dejados escritos, no borrados)

1. **H0.** Mi filtro de shas exigía una letra y no vio `03370978`, que es sólo dígitos. Eso acusó en falso a SM-N40.
2. **H2.** Acusé a 15 fichas de citar shas no ancestros sin leer el contexto. 17 de 20 menciones estaban rotuladas como «bundle», que no es procedencia y es aceptable, y `19af5a42` ni siquiera es un sha de commit. Lo retracté en el lote 1b.
3. **H5.** En SM-N2 un `grep --include` falló por sintaxis y lo leí como «vacío». El `cierre_` existía, así que bajó a la clase H6.
4. **H6 = 34.** La cifra tenía dos bugs: paths con puntuación pegada, y asociar el `cierre_` por nombre de archivo y no por el campo `FICHA:`. Además, un archivo no se leía por MAX_PATH. Recontado: cota de 40.
5. **H16.** Acusé a SM-N17 de medir «deja de avisar» en una cuenta que no podía fallar sin buscar la medición de la cuenta del operador, que estaba en `evidencia/SM-N18.md:7`. Lo encontré al consolidar este doc. Bajó a INFO.
6. **La regex de incompletitud** («sigue pendiente|sin medir|…») vio 15 de 18 DOD-PARCIAL en su control positivo, y al ampliar el vocabulario empeoró. Sólo sirve para generar candidatos. **Detectar «Cierre que no acredita el DoD» exige leer, no grepear.**

Los errores 1, 2, 3 y 5 tienen la misma forma: **concluir sobre la ausencia sin controlar que el instrumento viera la presencia.**

## Cómo se reproduce

- **Por ficha:** extraer `DoD:` y `Cierre:` del backlog @main y, por cada punto del DoD, preguntar dónde vive su evidencia: Cierre / commit / doc versionado / sólo el buzón / ningún lado.
- **La clase H15:** `instrumentos/cierre-sha-nombra-la-ficha.py`, con el uso en su docstring.
- **El cruce de cobertura:** ids nombrados en los lotes contra el conjunto `Estado: TERMINADO`.
