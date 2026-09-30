<#
.SYNOPSIS
    Destraba el reconcile del grafo cuando el guard de 200 borrados lo aborta. Idempotente.

.DESCRIPTION
    El reconcile del bridge aborta cuando el diff `present - expected` pasa el tope absoluto de 200
    objetos, y el `pre-push` es fail-closed: si el sync aborta, NADIE puede pushear. Pasó el
    2026-07-31 (221 objetos) y el 2026-09-30 (1406), las dos veces por una re-poda legítima.

    ⚠️ El tope NO es un límite de lote: `plan_deletions` (`differ.py:77`) computa el diff COMPLETO y
    evalúa el tope sobre ese total, así que fragmentar el borrado no sirve — cada corrida ve los
    mismos 1406. La única salida es `--force`, y sólo después de MIRAR qué borraría.

    Este script hace las tres cosas en orden, y la 1 puede abortar la 2:
      1. dry-run READ-ONLY  -> imprime qué borraría, y ABORTA si FALTANTES != 0
      2. sync con --force   -> log COMPLETO a archivo, nunca por un pipe
      3. verificación con DOS instrumentos independientes:
           (a) el dry-run tiene que dar ZOMBIES 0
           (b) el marcador de la bitácora tiene que haberse MOVIDO

    Por qué el guard del paso 1 es el que importa: el criterio de seguridad lo declara el propio
    dry-run — «FALTANTES = 0 significa que la ingesta completó; un sync sano deja FALTANTES en 0». Si
    hay faltantes, los zombies pueden ser identidad cambiada o un enricher que devolvió vacío, y
    `--force` ahí sí sería un borrado a ciegas.

    Por qué el paso 3 usa DOS controles: un `git push` sale exit 0 sin haber pusheado, y un push
    puede pasar por CONTENCIÓN DEL LOCK sin sincronizar (`graph-sync.sh:155-156`) — medido el
    2026-09-30 17:02, `rc=0 motivo=contencion-otro-sync` con el marcador quieto. El marcador se
    escribe SÓLO al final, después de las 3 capas de verificación, así que es el único testigo de
    que el reconcile completó.

.PARAMETER Force
    Sin este switch el script hace el dry-run y NO muta nada. Es el modo por defecto a propósito.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\destrabar-grafo-force.ps1
    # sólo mide, no toca nada

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\destrabar-grafo-force.ps1 -Force
    # mide, borra y verifica

.NOTES
    ⚠️ ESTE ARCHIVO TIENE QUE GUARDARSE COMO UTF-8 **CON BOM**. No es estética: PowerShell 5.1 lee
    un .ps1 sin BOM como ANSI (CP1252), y ahí el em-dash `—` (bytes E2 80 94) se decodifica como
    `â€”` — cuyo último carácter es `”`, que PowerShell trata como DELIMITADOR DE STRING. O sea que
    una string con un guion largo se CIERRA sola y el resto de la línea se parsea como código.

    🔴 Lo que lo hace peligroso es el mensaje de error: apunta a la palabra que quedó suelta
    («Token 'objetos' inesperado») y a un `&&` treinta líneas más abajo. Nada dice «encoding». Se
    puede perder una vuelta entera reescribiendo PowerShell correcto.

    Control: `[System.IO.File]::ReadAllBytes($f)[0..2]` tiene que dar 239,187,191. Si un editor
    guarda sin BOM, re-aplicarlo con
    `[System.IO.File]::WriteAllText($f, (Get-Content -Raw -Encoding UTF8 $f), (New-Object System.Text.UTF8Encoding($true)))`
    y volver a pasar el parser.
#>
param(
    [switch]$Force,
    [string]$Bridge = 'C:\Proyectos\Claude\Claude code\graphify-graphity-bridge',
    [string]$DryRun = 'C:\gfw-src\copiloto-grafo\scripts\graphity_dry_run_reconcile.py',
    [string]$RepoRoot = ''
)

$ErrorActionPreference = 'Continue'

function Say([string]$m, [string]$c = 'Gray') { Write-Host $m -ForegroundColor $c }
function Die([string]$m) { Say "`n[X] $m" 'Red'; exit 1 }

# ── 0. herramientas y rutas, verificadas antes de empezar ────────────────────────────────────
# Un path que no existe tiene que fallar ACÁ y no a mitad de un borrado.
$uv = (Get-Command uv -ErrorAction SilentlyContinue).Source
if (-not $uv) {
    $cand = "$env:USERPROFILE\.local\bin\uv.exe"
    if (Test-Path $cand) { $uv = $cand }
}
if (-not $uv) { Die "no encontre 'uv'. Instalado en ~\.local\bin\uv.exe normalmente." }

$bash = (Get-Command bash -ErrorAction SilentlyContinue).Source
if (-not $bash) {
    foreach ($c in @("$env:ProgramFiles\Git\bin\bash.exe", "${env:ProgramFiles(x86)}\Git\bin\bash.exe")) {
        if (Test-Path $c) { $bash = $c; break }
    }
}
if (-not $bash) { Die "no encontre 'bash.exe' (Git for Windows)." }

if (-not (Test-Path $Bridge)) { Die "no existe el bridge: $Bridge" }
if (-not (Test-Path $DryRun)) { Die "no existe el dry-run: $DryRun" }

# El checkout desde el que se corre `graph-sync.sh`. Se elige el PRIMERO que exista y que tenga
# soporte de UC_GRAPH_FORCE: un checkout viejo ignoraria la variable EN SILENCIO y el sync abortaria
# igual, que es indistinguible de «el force no sirvio».
if (-not $RepoRoot) {
    foreach ($c in @('C:\gfw-src\wt-medidor', 'C:\Proyectos\Claude\Claude code\copiloto-emprendedor')) {
        $s = Join-Path $c 'scripts\graph-sync.sh'
        if ((Test-Path $s) -and (Select-String -Path $s -Pattern 'UC_GRAPH_FORCE' -Quiet)) {
            $RepoRoot = $c; break
        }
    }
}
if (-not $RepoRoot) { Die "ningun checkout tiene scripts/graph-sync.sh con soporte de UC_GRAPH_FORCE." }

$bitacora = Join-Path $Bridge '.bridge\graph-sync.log'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logSync = Join-Path $env:TEMP "graph-force-$stamp.log"

Say "bridge     : $Bridge"
Say "dry-run    : $DryRun"
Say "checkout   : $RepoRoot"
Say "log del sync: $logSync"
Say ""

# ── 1. marcador ANTES (el testigo del paso 3) ────────────────────────────────────────────────
$marcadorAntes = ''
if (Test-Path $bitacora) {
    $ult = Get-Content $bitacora -Tail 1
    $m = [regex]::Match($ult, 'marcador=(\S+)')
    if ($m.Success) { $marcadorAntes = $m.Groups[1].Value }
}
Say "marcador ANTES: $(if ($marcadorAntes) { $marcadorAntes } else { '(bitacora vacia)' })" 'Cyan'

# ── 2. dry-run READ-ONLY, con su guard ───────────────────────────────────────────────────────
Say "`n=== PASO 1/3 — dry-run READ-ONLY (no borra nada) ===" 'Yellow'
Push-Location $Bridge
$salida = & $uv run python $DryRun --config config/repos.toml --repo copiloto-emprendedor 2>&1
$rcDry = $LASTEXITCODE
Pop-Location
$salida | ForEach-Object { Say "  $_" }
if ($rcDry -ne 0) { Die "el dry-run salio $rcDry. Su exit 2 significa 'expected vino vacio: el instrumento no midio nada'. NO se sigue." }

$txt = ($salida | Out-String)
$mZ = [regex]::Match($txt, 'ZOMBIES.*?:\s*(\d+)')
$mF = [regex]::Match($txt, 'FALTANTES.*?:\s*(\d+)')
if (-not $mZ.Success -or -not $mF.Success) { Die "no pude leer ZOMBIES/FALTANTES de la salida del dry-run. No se sigue a ciegas." }
$zombies = [int]$mZ.Groups[1].Value
$faltantes = [int]$mF.Groups[1].Value
Say "`n  -> ZOMBIES $zombies  ·  FALTANTES $faltantes" 'Cyan'

if ($faltantes -ne 0) {
    Die "FALTANTES = $faltantes (deberia ser 0). El propio dry-run lo declara grave: la ingesta NO completo, asi que los zombies pueden ser identidad cambiada y no re-poda. --force aca seria un borrado a ciegas. ESCALAR, no forzar."
}
if ($zombies -eq 0) {
    Say "`n[OK] ZOMBIES 0: el grafo ya esta reconciliado. No hay nada que forzar." 'Green'
    Say "     Si igual no podes pushear, el problema NO es el reconcile." 'Green'
    exit 0
}

if (-not $Force) {
    Say "`n=== MODO MEDICION (sin -Force): no toque nada ===" 'Yellow'
    Say "Para ejecutar el borrado de los $zombies zombies, volve a correr con  -Force" 'Yellow'
    exit 0
}

# ── 3. el sync con --force ───────────────────────────────────────────────────────────────────
Say "`n=== PASO 2/3 — sync con --force ($zombies objetos) ===" 'Yellow'
Say "OJO: el primer sync completo tras drift ingiere >17 min. No lo cortes." 'Yellow'
Say "El log COMPLETO va a $logSync (no se pipea: un tail borraria la evidencia del fallo)." 'Yellow'

# `C:\x\y` -> `/c/x/y`. Git Bash no entiende el path de Windows en un `cd`.
function APosix([string]$p) {
    return '/' + $p.Substring(0, 1).ToLower() + ($p.Substring(2) -replace '\\', '/')
}

# `-lc` y no `-c`: el script necesita el PATH del profile para `uv`/`git`. El `cd` va adentro de
# bash con la ruta en formato POSIX, porque `graph-sync.sh` resuelve rutas con `git rev-parse`.
#
# La redireccion la hace BASH, no PowerShell: en 5.1, redirigir el stderr de un exe nativo desde
# PowerShell envuelve cada linea en un ErrorRecord (NativeCommandError) y ensucia el log justo
# cuando mas se necesita leerlo. `> log 2>&1` adentro de bash deja el log tal cual lo escribio el
# script, y `$LASTEXITCODE` sigue siendo el del sync.
$cmd = "cd '$(APosix $RepoRoot)' && UC_GRAPH_FORCE=1 bash scripts/graph-sync.sh > '$(APosix $logSync)' 2>&1"
Say "`n  bash -lc `"$cmd`"" 'DarkGray'
& $bash -lc $cmd
$rcSync = $LASTEXITCODE
Say "`n  exit del sync: $rcSync" 'Cyan'
Say "  ultimas 25 lineas del log (el COMPLETO esta en el archivo):" 'DarkGray'
Get-Content $logSync -Tail 25 | ForEach-Object { Say "    $_" }

# ── 4. verificación con DOS instrumentos independientes ──────────────────────────────────────
Say "`n=== PASO 3/3 — verificacion (dos instrumentos) ===" 'Yellow'

Push-Location $Bridge
$salida2 = & $uv run python $DryRun --config config/repos.toml --repo copiloto-emprendedor 2>&1
Pop-Location
$txt2 = ($salida2 | Out-String)
$mZ2 = [regex]::Match($txt2, 'ZOMBIES.*?:\s*(\d+)')
$mF2 = [regex]::Match($txt2, 'FALTANTES.*?:\s*(\d+)')
$z2 = if ($mZ2.Success) { [int]$mZ2.Groups[1].Value } else { -1 }
$f2 = if ($mF2.Success) { [int]$mF2.Groups[1].Value } else { -1 }
Say "  (a) dry-run: ZOMBIES $z2 · FALTANTES $f2   (esperado: 0 y 0)" 'Cyan'

$marcadorDespues = ''
if (Test-Path $bitacora) {
    $ult2 = Get-Content $bitacora -Tail 1
    $m2 = [regex]::Match($ult2, 'marcador=(\S+)')
    if ($m2.Success) { $marcadorDespues = $m2.Groups[1].Value }
    Say "  ultima linea de la bitacora:" 'DarkGray'
    Say "    $ult2" 'DarkGray'
}
Say "  (b) marcador: $marcadorAntes -> $marcadorDespues" 'Cyan'

$okZ = ($z2 -eq 0)
$okM = ($marcadorDespues -ne '' -and $marcadorDespues -ne $marcadorAntes)

if ($okZ -and $okM) {
    Say "`n[OK] DESTRABADO. El reconcile completo y el marcador se movio." 'Green'
    Say "     Ahora las sesiones pueden pushear. Deciles que pusheen UNA A LA VEZ:" 'Green'
    Say "     dos pushes simultaneos hacen que el segundo pase por CONTENCION del lock," 'Green'
    Say "     o sea exit 0 SIN sincronizar, y eso acredita un verde que nadie midio." 'Green'
    exit 0
}

Say "`n[!] NO se puede declarar destrabado todavia:" 'Red'
if (-not $okZ) { Say "    - el dry-run sigue viendo $z2 zombies" 'Red' }
if (-not $okM) { Say "    - el marcador NO se movio (sigue en '$marcadorAntes'): el reconcile no completo" 'Red' }
Say "    Log completo: $logSync" 'Red'
Say "    Si el log muestra 'contencion-otro-sync', habia otro sync corriendo: volve a correrlo." 'Red'
exit 1
