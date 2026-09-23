---
name: aislar-un-binario-del-path-se-hace-por-whitelist-no-por-dirname
description: Un test que arma un PATH "sin gh" restando dirname(sh):dirname(cat) asumía que gh vivía en otro directorio — falló en el runner de GitHub Actions, donde /usr/bin trae sh, cat y gh juntos.
metadata:
  type: feedback
---

**Al escribir un test que aísla un binario del PATH (para probar "¿qué pasa si falta la herramienta
X?"), construir el PATH recortado por WHITELIST explícita, nunca por "el directorio de otro
comando que sé que existe".**

2026-09-23, `test-ci-verde-gh-presente.sh` (PR #680). El test necesitaba simular "`gh` no está
instalado" para probar la guarda nueva de `ci-verde.sh`. Primer intento:

```bash
PATH_SIN_GH="$(dirname "$(command -v sh)"):$(dirname "$(command -v cat)")"
```

Pasó en dev. Falló en el runner de GitHub Actions: ahí `/usr/bin` trae `sh`, `cat` **y `gh`** en el
mismo directorio — la "exclusión" reincluía exactamente lo que quería excluir. El propio control
positivo del test lo cazó (`if PATH="$PATH_SIN_GH" command -v gh; then echo "el aislamiento no
tomó"; exit 2; fi` — ver [[instrumento-que-no-mira-nunca-falla]]) en vez de dar un falso verde: hizo
su trabajo. Pero la construcción del PATH era la que estaba mal, no el guard.

**Segundo intento, symlinkear `bash` a un bindir propio con sólo lo necesario** — rompió distinto,
esta vez en Windows/Git Bash: MSYS resuelve `msys-2.0.dll` relativa a la ruta **real** del `.exe`, así
que invocar un symlink a `bash` en otro directorio lo deja sin poder cargar la DLL.

**Fix que sobrevive a los dos entornos:** capturar la ruta absoluta del binario ANTES de recortar el
PATH, e invocar por esa ruta — así el PATH restringido sólo tiene que cumplir una cosa (no traer el
binario que se quiere ausente), sin tener que además resolver el intérprete:

```bash
BASH_BIN="$(command -v bash)"    # se resuelve con el PATH normal, todavía sin tocar
PATH_SIN_GH=""                   # o cualquier valor que sencillamente no contenga gh
PATH="$PATH_SIN_GH" "$BASH_BIN" "$ROOT/scripts/ci-verde.sh" ...
```

**La pregunta a hacerse antes de excluir algo del PATH por "vive en otro directorio":** ¿en qué
plataforma corre esto — sólo mi dev, o también CI? Un runner Linux con todo en `/usr/bin` y un dev
Windows con symlinks rotos son dos formas distintas de que la misma asunción falle.
