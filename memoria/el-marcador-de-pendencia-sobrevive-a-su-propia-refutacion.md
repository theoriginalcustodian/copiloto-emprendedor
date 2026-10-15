---
name: el-marcador-de-pendencia-sobrevive-a-su-propia-refutacion
description: Un marcador ⚠/P sigue contando aunque su hecho fue refutado y la enmienda esté escrita al lado; y el texto ANTES del marcador es lo HECHO, no el motivo
metadata:
  type: feedback
---

Un renglón de registro que mezcla **lo hecho** y **lo que falta** falla de dos maneras opuestas, y
las dos se pagaron el mismo día (2026-10-15, sprint mobile).

## Cara A — el marcador sobrevive a su refutación

La fila `bi-refresh` del mapeo contaba `PENDIENTE-DECLARADA` por un `**P**` que decía «el refresh se
dispara **antes** del UP — observación de device sin atribución de causa». Ese hecho estaba
**refutado desde dos días antes**, en tres lugares:

- `docs/copiloto-emprendedor/2026-10-13-veredictos-device2-remedicion-triaje15-fe2.md:68` — re-medido
  con `refresh2.py` (DOWN, 15 MOVE, sostener 1,5 s, UP, 22 muestras): «Actualizando…» aparece
  **después** del UP, t=5,2 s contra UP en 4,8 s.
- la tabla de enmiendas del mismo doc, `:119` — **E2**, con la causa atribuida y su `path:línea`.
- el código: `PantallaInteligencia.tsx:4-7` ya importa `RefreshControl` de RNGH, y su comentario
  habla **en pasado** («`onRefresh` **se disparaba** a los 0,3 s del DOWN»).

Y lo que lo vuelve no-obvio: **la enmienda fundada ya estaba escrita en la misma fila.** Crucé las 8
enmiendas `E1`–`E8` de la re-medición contra las 54 filas del mapeo: **7 de 8 reflejadas**, E2 entre
ellas. O sea que la fila tenía la enmienda **y** el `**P**` obsoleto conviviendo, y
`medir-mapeo-implementacion.py:338` clasifica por el ⚠ (`if s & {"⛓","⚠"}`). **El medidor hace bien
su trabajo.** Lo que falla es que retirar un marcador no es parte de escribir su refutación: el
re-marcado tiene dueña (`DEC-18`), la refutación la escribió otra sesión en otro doc, y nadie es
responsable del renglón viejo. Dos días de deuda inflada, 1 punto de sprint (47/54 → 48/54).

**Pregunta que lo caza:** *¿el hecho que este marcador afirma sigue siendo cierto hoy, o sólo sigue
escrito?* Un ⚠ hay que poder fechar: si su evidencia es más vieja que la última medición del frente,
es sospechoso de muerto.

Inverso de [[una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira]] (allá sobrevive
la observación y se retira la causa; acá sobrevive el marcador y el hecho ya no está) y hermano de
[[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]].

## Cara B — el texto ANTES del marcador es lo HECHO, no el motivo

Leyendo esas mismas filas para repartir trabajo, extraje el texto **que precede** a cada `**P**` y lo
leí como «el trabajo que falta». Es exactamente lo contrario: en estas filas lo que precede al
marcador es el trabajo **ya cerrado**, y el motivo de la pendencia va **después**. Con eso bajé un
contrato que mandaba a una sesión a hacer **dos cosas ya hechas**:

- `soporte` → leí «card "Ticket #…"» como faltante. Después del marcador decía
  `NO_REPRODUCIBLE_SIN_EFECTO — abrir un ticket real avisa al equipo`, y los dos `**R**` de la misma
  fila decían «**el código ya existía** (#1115)»: `TarjetaTicketSoporte` montada en
  `PantallaSoporte.tsx:231-235`, verificada en device con 5 tickets.
- `splash` → leí «wordmark letra por letra con rebote» como faltante. El código existe **en otro
  archivo**: `IdentidadEntrada.tsx:28-29` dice que el wordmark «ya **NO** se anima acá: vive en
  `RevealEntrada`», con el bounce en `:45,52` y el mismo `cubic-bezier` del prototipo.

Leídos bien, **ninguno de los 6 elementos `**P**` era código faltante salvo uno** (`entrada`): los
otros cinco eran `NO_MEDIBLE` / `NO_REPRODUCIBLE_SIN_EFECTO`, o sea límites del **instrumento**
([[instrumento-que-no-mira-nunca-falla]],
[[la-condicion-que-el-instrumento-exige-para-ver-cambia-lo-medido]]). Un sprint que parecía 6
implementaciones era 1 implementación + 3 mediciones + decisiones del operador.

**Why:** cuando un renglón codifica estado con marcadores embebidos en prosa, la **posición** del
texto respecto del marcador es significado — y es significado que nadie documentó. Leerlo al revés
no da error: da un contrato plausible que manda a trabajar sobre lo ya hecho
([[el-contrato-que-manda-a-hacer-algo-ya-hecho]]).

**How to apply:** antes de repartir trabajo desde un registro con marcadores, (1) leé lo que sigue al
marcador, que es el motivo, y (2) buscá el símbolo en el árbol —`git ls-tree`/`grep`— antes de
declararlo faltante, porque puede vivir en otro archivo del mismo módulo
([[el-fix-ya-existe-en-otro-call-site]]). Y (3) fechá cada marcador contra la última medición del
frente: el que no sobrevive a esa comparación se retira, y retirarlo es trabajo con dueño, no un
subproducto de escribir la refutación.
