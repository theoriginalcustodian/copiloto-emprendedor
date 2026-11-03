---
name: set-location-no-mueve-el-cwd-de-dotnet-y-el-path-relativo-escribe-en-otro-repo
description: En PowerShell, Set-Location NO cambia [IO.Directory]::GetCurrentDirectory(). Un WriteAllText con path relativo escribió en el checkout COMPARTIDO mientras yo creía estar en el worktree, y lo dejó en 0 líneas.
metadata:
  type: feedback
---

`Set-Location` (y `cd`) mueven el *provider path* de PowerShell, **no** el
`CurrentDirectory` del proceso .NET. Así que `Get-Content memoria/X.md` y
`[System.IO.File]::ReadAllText("memoria/X.md")`, en la misma línea, **leen archivos distintos**: el
primero resuelve contra el worktree, el segundo contra el directorio donde arrancó el proceso — que
en este repo es **el checkout compartido**.

**Caso raíz (2026-11-03).** Trabajando en `C:\gfw-src\wt-plan-lote18`, con `Set-Location` hecho,
escribí el índice de memoria con `[System.IO.File]::WriteAllLines("memoria\MEMORY.md", $lines, …)`.
Fue a `C:\Proyectos\Claude\Claude code\copiloto-emprendedor\memoria\MEMORY.md`, y como `$lines`
venía de una lectura que había fallado, **lo dejó en 0 líneas** (`@@ -1,180 +0,0 @@`). El checkout
compartido es el que sirve Metro y el que las seis sesiones comparten.

**Lo que hizo el diagnóstico largo, y es lo peor del patrón:** mis mediciones salían
**intercaladas**. `Select-String memoria\MEMORY.md` (PowerShell → worktree) decía que una línea
existía; `ReadAllText("memoria\MEMORY.md")` (.NET → compartido) devolvía otro contenido. Pasé tres
intentos creyendo que el reemplazo «no se aplicaba», cuando se aplicaba perfectamente **en el otro
repo**. Dos instrumentos, dos sujetos, el mismo nombre de archivo.

**La regla, sin excepción en este repo:**

1. **Todo `System.IO.*` lleva path ABSOLUTO.** Nunca relativo, ni después de `Set-Location`.
2. Si hay que usar relativo, fijar explícitamente
   `[System.IO.Directory]::SetCurrentDirectory($pwd.Path)` — pero preferir el absoluto, que no
   depende de recordarlo.
3. **El control por efecto se mide con path absoluto**, o mide el archivo equivocado y «confirma»
   que no pasó nada.
4. Antes de escribir un archivo versionado: `git status --short` **del repo que creés estar
   tocando**. Si aparece modificado un repo que no tocaste, es esto.

La restauración se hizo leyendo el blob (`git show HEAD:<path>`) y reescribiendo el archivo, **no**
con `git checkout --` (CANON 9), y se verificó comparando contenido contra `HEAD`: idéntico.

Es [[open-w-trunca-al-abrir-y-una-excepcion-en-el-write-destruye-el-archivo]] con una capa más: ahí
el truncado destruía **el archivo que querías**; acá destruye **un archivo de otro repo**, y el
control que corrés para verificar mira el que sí está bien. Hermana de
[[el-instrumento-versionado-difiere-por-rama]] y de [[un-nombre-con-dos-referentes-prueba-A-y-concluye-B]].