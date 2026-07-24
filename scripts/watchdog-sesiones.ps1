<#
.SYNOPSIS
  Watchdog FUERA del proceso vigilado (Gancho 2). Corre desde el Task Scheduler de Windows,
  independiente de que cualquier sesion de Claude Code este viva.

.DESCRIPTION
  Causa raiz que resuelve:
  docs/aprendizajes/pendientes/2026-07-24_watchdog-fuera-del-proceso-vigilado.md

  Hoy TODA la vigilancia (crones "vigia", "control de sesiones", el janitor del buzon) vive DENTRO
  de las sesiones de Claude Code que vigila. Si una sesion muere, la cuota se agota o la maquina
  duerme, el vigilante muere CON el vigilado, y el silencio resultante es identico al de una sesion
  que trabaja tranquila. Este script corre fuera de cualquier proceso de Claude Code: cero LLM,
  cero dependencia de que una REPL este viva, cero parseo de contenido.

  Que mide (SOLO metadata de archivo -- los transcripts .jsonl pesan cientos de MB, este script
  NUNCA los abre ni los lee, solo consulta LastWriteTime):
    1. VIDA  = minutos desde el .jsonl mas reciente entre TODAS las sesiones de este repo.
    2. COLA  = cantidad de archivos .md en coordinacion/en-curso/ (trabajo tomado, sin cerrar).
  Si VIDA >= UmbralMuertaMin Y COLA > 0 -> hay trabajo tomado y ninguna sesion escribio hace rato:
  notifica al operador (msg.exe, no bloqueante) y deja registro en un log.

  Si COLA = 0 (nadie tiene nada tomado) el silencio es NORMAL y no notifica, sea cual sea VIDA --
  es el control negativo del DoD: tres sesiones trabajando tranquilas, sin nada muerto, no deben
  generar notificaciones.

.PARAMETER RepoRoot
  Raiz del repo. Default: el repo real de copiloto-emprendedor.

.PARAMETER TranscriptsDir
  Carpeta de transcripts .jsonl a inspeccionar. Default: la carpeta real del slug de este repo.
  Parametrizable para poder probar el script sin tocar datos reales (precondicion del DoD).

.PARAMETER BuzonDir
  Carpeta coordinacion/ a inspeccionar. Default: RepoRoot\coordinacion. Parametrizable por el
  mismo motivo que TranscriptsDir.

.PARAMETER UmbralMuertaMin
  Minutos sin actividad en NINGUN transcript para considerar "sesion muda". Default 30 -- mismo
  umbral que scripts/no-ocio-check.sh y scripts/vigilancia-check.sh (UMBRAL_MUERTA), para que las
  tres capas de vigilancia (adentro del proceso, adentro del cron, afuera del proceso) hablen el
  mismo idioma de tiempos.

.PARAMETER LogPath
  Donde loguear cada corrida. Default: fuera del repo y fuera del buzon (no es un mensaje del
  buzon, es telemetria del propio watchdog) -- %USERPROFILE%\.claude\watchdog-copiloto-emprendedor.log

.PARAMETER WhatIf
  No notifica ni escribe log; solo imprime el veredicto a stdout. Para pruebas.

.EXAMPLE
  # Correr una vez a mano (prueba, no muta nada del sistema):
  powershell -File scripts\watchdog-sesiones.ps1 -WhatIf

.EXAMPLE
  # Instalar la tarea programada -- IDEMPOTENTE (correrlo N veces no duplica la tarea, -Force
  # reemplaza si ya existe). NO la corre este script: la instala el OPERADOR a mano cuando decide
  # activarla -- registrar una tarea programada muta la maquina y no es decision de un script.
  $ps1     = "C:\Proyectos\Claude\Claude code\copiloto-emprendedor\scripts\watchdog-sesiones.ps1"
  $action  = New-ScheduledTaskAction -Execute "powershell.exe" `
               -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ps1`""
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
               -RepetitionInterval (New-TimeSpan -Minutes 12) -RepetitionDuration ([TimeSpan]::MaxValue)
  Register-ScheduledTask -TaskName "CopilotoEmprendedor-WatchdogSesiones" -Action $action `
    -Trigger $trigger -Force `
    -Description "Watchdog fuera de proceso: avisa si ninguna sesion Claude Code escribio en 30min y en-curso/ tiene trabajo sin cerrar"

  # Desinstalar:
  Unregister-ScheduledTask -TaskName "CopilotoEmprendedor-WatchdogSesiones" -Confirm:$false

.NOTES
  Gancho 2 de chore/vigilancia-sin-modelo (2026-07-24).
  Sin dependencias externas: usa solo cmdlets nativos de PowerShell 5.1 + msg.exe (nativo de
  Windows, verificado presente en este equipo).
#>
[CmdletBinding()]
param(
    [string]$RepoRoot = "C:\Proyectos\Claude\Claude code\copiloto-emprendedor",
    [string]$TranscriptsDir = "$env:USERPROFILE\.claude\projects\c--Proyectos-Claude-Claude-code-copiloto-emprendedor",
    [string]$BuzonDir,
    [int]$UmbralMuertaMin = 30,
    [string]$LogPath = "$env:USERPROFILE\.claude\watchdog-copiloto-emprendedor.log",
    [switch]$WhatIf
)

if (-not $BuzonDir) { $BuzonDir = Join-Path $RepoRoot "coordinacion" }

$now = Get-Date

# ---- 1) VIDA: mtime mas reciente entre TODOS los transcripts. Solo metadata, nunca contenido. ----
$vidaMin = [int]::MaxValue
$vidaDetalle = "sin transcripts en $TranscriptsDir"
if (Test-Path $TranscriptsDir) {
    $transcripts = Get-ChildItem -Path $TranscriptsDir -Filter "*.jsonl" -File -ErrorAction SilentlyContinue
    if ($transcripts.Count -gt 0) {
        $masReciente = $transcripts | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        $vidaMin = [int]([Math]::Floor(($now - $masReciente.LastWriteTime).TotalMinutes))
        $vidaDetalle = "$($masReciente.Name) hace $vidaMin min"
    }
}

# ---- 2) COLA: cuantos archivos hay en en-curso/ (trabajo tomado, sin cerrar) ----
$encursoDir = Join-Path $BuzonDir "en-curso"
$colaCount = 0
if (Test-Path $encursoDir) {
    $colaCount = (Get-ChildItem -Path $encursoDir -Filter "*.md" -File -ErrorAction SilentlyContinue).Count
}

# ---- 3) Veredicto: VIDA muda Y COLA no vacia ----
$alarma = ($vidaMin -ge $UmbralMuertaMin) -and ($colaCount -gt 0)

$linea = "$($now.ToString('yyyy-MM-dd HH:mm:ss'))  VIDA=${vidaMin}min ($vidaDetalle)  COLA=$colaCount  ALARMA=$alarma"
Write-Output $linea

if ($WhatIf) {
    Write-Output "(WhatIf: no se notifica ni se escribe log)"
    if ($alarma) { exit 1 } else { exit 0 }
}

try {
    Add-Content -Path $LogPath -Value $linea -Encoding utf8 -ErrorAction Stop
} catch {
    Write-Output "  (no se pudo escribir el log en $LogPath : $($_.Exception.Message))"
}

if ($alarma) {
    $texto = "Copiloto emprendedor: ninguna sesion Claude Code escribio hace $vidaMin min y coordinacion\en-curso tiene $colaCount archivo(s) sin cerrar. Revisar las sesiones."
    try {
        & msg.exe $env:USERNAME $texto 2>$null | Out-Null
    } catch {
        Add-Content -Path $LogPath -Value "  (msg.exe fallo: $($_.Exception.Message))" -Encoding utf8
    }
    exit 1
}

exit 0
