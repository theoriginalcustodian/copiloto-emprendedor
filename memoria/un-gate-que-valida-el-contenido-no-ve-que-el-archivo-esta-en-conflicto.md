---
name: un-gate-que-valida-el-contenido-no-ve-que-el-archivo-esta-en-conflicto
description: sprint-estado.py --check dio CHECK-OK con los 6 marcadores de conflicto de git vivos en el doc; valida fichas, no integridad del archivo.
metadata:
  type: feedback
---

**Medido el 2026-11-04**, resolviendo el conflicto de `2026-11-02-BACKLOG-sprint-correcciones-mapa.md`
en `planificacion/marcar-n58`: con **seis** marcadores `<<<<<<<` / `=======` / `>>>>>>>` vivos en el
archivo, `sprint-estado.py --tabla` regeneró la tabla y `--check` dijo **`CHECK-OK`** — «99 fichas,
todos los TERMINADO con sha en origin/main». El gate es correcto en lo que mide (estado, `Cierre:`,
sha ancestro, tabla sincronizada) y **ciego a que el archivo que mide está partido en dos versiones**.

**Por qué muerde.** El parser toma el primer `- **Estado:**` que encuentra por ficha, y en un hunk en
conflicto ése es el del lado `HEAD`. O sea: **lee una mitad y la informa como si fuera el doc**. El
`CHECK-OK` no dice «el doc está bien», dice «la mitad que leí está bien» — y es indistinguible de un
verde legítimo. Si no hubiera mirado `git status` (`UU`), commiteaba los marcadores con el gate en
verde y la cifra 94/99 medida sobre medio archivo.

**Y hubo un segundo instrumento mintiendo en la misma operación:** el `.md` es **CRLF**, así que un
regex que ancla `^=======$` con `\n` **matchea cero** y el resolvedor sale «exitoso» sin tocar un solo
marcador — dos veces seguidas, con el `assert` disparando en silencio mientras el resto del script
seguía. Medir el separador antes de anclar (`[[anclar-texto-multilinea-sin-medir-el-separador-de-linea]]`)
no es una precaución de Windows: acá fue la diferencia entre resolver y creer que resolví.

**Cómo aplicarlo:** antes de citar un `--check` verde sobre un doc que acabás de mergear, corré
`git status --short <doc>` o `grep -c '^<<<<<<< '`. Un gate que valida **contenido** no acredita
**integridad del archivo**, y el verde de uno se lee como el verde del otro.
Relacionado: [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] ·
[[instrumento-que-no-mira-nunca-falla]] · [[resolver-tomando-un-lado-nunca-converge]].

**TAPADO el mismo día (2026-11-04), por frontend2.** `scripts/sprint-estado.py:103-112` en `main`
(`c269a8b3`, PR #1643, ancestro verificado): `RE_CONFLICTO = re.compile(r"^(<<<<<<< |>>>>>>> )",
re.MULTILINE)` y `leer()` aborta con `SystemExit` nombrando el archivo. Vale para `--marcar` y
`--tabla` también, así que **no se escribe en un doc partido**. Dejó `=======` **fuera a propósito**:
aparece legítimo en prosa y en tablas markdown, y un guard que grita en el caso normal se desarma
solo ([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]). Controles corridos: positivo (doc
con marcadores → aborta) y negativo (los 4 backlogs reales, 0 marcadores, `--check --sin-git` OK).

**Lo que sigue abierto, y es la mitad que importa: el guard NO tiene test versionado.** Verificado
contra `origin/main`: `git grep -l sprint-estado -- '*test*'` devuelve **vacío**. O sea que el control
positivo existió **una vez, a mano, en la sesión que lo escribió** — exactamente la forma en que un
mecanismo roto hacia el «no» deja de dar síntoma ([[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]).
Si un refactor futuro rompe el `RE_CONFLICTO`, el `--check` vuelve a dar verde sobre medio archivo y
nada avisa. Pedido a frontend2 el 04/11: un test que afirme el positivo (doc con marcadores ⇒
`SystemExit`) y el negativo (doc limpio ⇒ lee).

**CERRADO del todo el mismo día.** El límite de arriba —«el guard no tiene test versionado»— lo pagó
frontend2 a las pocas horas: `7ad21a67` (PR #1644, ancestro verificado), **dentro de
`sprint-estado.py --autotest`** y no en un `test_*.py` suelto, porque `lint.sh` ya corre ese autotest
y en el job `lint` **no hay pytest**: un archivo de test suelto no lo habría ejecutado ningún job, o
sea habría sido un control que nadie corre ([[instrumento-que-no-mira-nunca-falla]]). Cuatro casos,
con el separador **explícito** (`newline=""`): conflicto LF y conflicto CRLF ⇒ abortan nombrando el
archivo · sin marcadores ⇒ lee · `=======` solo en prosa o tabla ⇒ lee, que congela la decisión de
diseño en un test en vez de dejarla en un comentario. Y lo que lo hace acreditable: **corrió el
mutante** — con el regex roto el autotest da **rojo con 2 fallos**, así que el control distingue un
guard vivo de uno ausente. Eso es lo que convierte un verde en evidencia.
