---
name: git-bash-mangla-paths-con-punto-y-fabrica-handoffs-falsos
description: En Windows/Git Bash, git cat-file origin/main:.githooks/... falla por mangling de MSYS y se lee como "el archivo no está en main" — ya fabricó un handoff externo entero de trabajo inexistente
metadata:
  type: project
---

# 🪟💥 Git Bash mangla los paths que empiezan con punto — y el falso negativo llega disfrazado de tarea

En Windows con Git Bash (MSYS), cualquier `git <cmd> <ref>:<path>` donde el **path arranca con `.`**
se transforma antes de llegar a git:

```bash
git cat-file -e origin/main:.githooks/pre-push
# → fatal: Not a valid object name origin\main;.githooks\pre-push
#   (los ':' se volvieron ';' y las '/' se volvieron '\')
```

**Fix:** prefijar `MSYS_NO_PATHCONV=1`.

```bash
MSYS_NO_PATHCONV=1 git cat-file -e origin/main:.githooks/pre-push   # ✅
MSYS_NO_PATHCONV=1 git show     origin/main:.claude/commands/x.md    # ✅
```

Afecta a todo lo que empiece con punto: `.githooks/`, `.claude/`, `.github/`, `.gitignore`.

## Por qué es peligroso y no sólo molesto

El error **no dice "no puedo parsear tu path"**: dice `Not a valid object name`. Eso se lee como
*«ese objeto no existe en main»* — o sea, como un **hallazgo sobre el repositorio** cuando es una
falla del instrumento. Es el caso exacto de [[instrumentos-que-confirman-en-vez-de-verificar]] y de
[[vacio-no-es-hallazgo-correr-el-control]]: el control es correr el mismo comando con
`MSYS_NO_PATHCONV=1`, y si aparece, lo roto era tu llamada.

## El caso que lo convirtió en regla — un handoff EXTERNO fabricado (2026-07-24)

Un agente de otro repo (Graphity) entregó un handoff *«verificado empíricamente contra el repo real»*
pidiendo **dos acciones**: mergear `.githooks/pre-push` a `main` desde una rama, y correr
`git config core.hooksPath .githooks`.

Medido acá antes de ejecutar: el hook **ya estaba en `main`** (94 líneas, no las 61 que el handoff
describía — había crecido), `core.hooksPath` **ya estaba configurado** y **heredado por los 20
worktrees**, y la rama tenía **0 commits** sin mergear. Las dos acciones eran trabajo inexistente.

**Lo que hace a este caso peor que el propio:** un falso negativo interno lo cazás con el control.
Uno que llega **empaquetado como handoff de otro agente** viene con la verificación ya *declarada* —
«verificado empíricamente» — así que invita a ejecutar, no a medir. Y las dos acciones eran
plausibles y baratas: mergear una rama y setear un config. Nada en el pedido se siente sospechoso.

## La regla

**Un handoff externo se MIDE contra el repo antes de ejecutarlo, aunque diga que ya se verificó.**
La verificación de otro agente es una aserción sobre un sistema que vos tenés delante — y si corrió
en Windows/Git Bash, su instrumento pudo mentirle con la misma cara de certeza.

Barato: son 3 comandos. `git cat-file -e` del artefacto (con `MSYS_NO_PATHCONV=1`), `git config` de
la clave, y `git rev-list --count origin/main..origin/<rama>` — si da 0, no hay nada que mergear.

Corolario para el otro lado: si **vos** entregás un handoff medido en Windows y afirma que algo
falta, verificalo con `MSYS_NO_PATHCONV=1` antes de mandarlo. [[no-codificar-la-esperanza-principio-raiz]]

## No es sólo `git`: mordió en **adb**, y el éxito reportado traía la prueba adentro (2026-08-07)

Midiendo A8 en el teléfono, para leer la pantalla:

```bash
adb shell uiautomator dump /sdcard/a8.xml     # el path es del DEVICE, no de Windows
adb shell cat /sdcard/a8.xml > local.xml      # → 0 bytes
```

Git Bash tradujo `/sdcard/a8.xml` a una ruta de Windows **antes de que llegara al teléfono**, así que
el volcado se escribió en un lugar que en el device no existe, y el `cat` no encontró nada. **Cualquier
path absoluto del lado remoto sufre esto** — `/sdcard`, `/data`, `/tmp` de un contenedor, un `ssh
host "cat /var/log/..."`. La regla del punto inicial era un caso particular de algo más grande.

**Lo que me hizo perder el primer intento:** el XML de 0 bytes se lee como *«la app no expone textos»*
—una hipótesis perfectamente razonable sobre React Native y accesibilidad— o sea, otra vez un
**hallazgo sobre el sujeto** en vez de una falla del instrumento. Lo que lo delató fue barato y es el
control de siempre: la **captura de pantalla del mismo instante pesaba 269 KB**. Si un instrumento
devuelve nada y otro devuelve todo, lo roto es el primero.

**Y el detalle que más vale la pena robarle a este caso:** el comando **no falló**. Salió con éxito e
imprimió `UI hierchary dumped to: /Files/Git/sdcard/a8-b.xml` — la ruta manglada estaba **escrita en
el propio mensaje de éxito**. La primera vez no la vi porque yo mismo había mandado la salida a
`/dev/null` por prolijidad. **Silenciar la salida de un instrumento te saca la única pista que iba a
tener**, y encima deja un exit code 0 que parece confirmación. Hermana de
[[el-pipe-se-come-el-exit-code]]: allá el veredicto se pierde en la tubería, acá se pierde por
higiene.

Antídoto operativo: en comandos que cruzan a otra máquina, `export MSYS_NO_PATHCONV=1` una vez al
principio del script — y **no silenciar** la salida del comando de instrumentación hasta haber visto
una corrida completa.
