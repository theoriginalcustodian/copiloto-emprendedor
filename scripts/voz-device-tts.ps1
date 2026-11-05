<#
.SYNOPSIS
  Emite por los parlantes de la PC, con TTS en español, las frases de la receta de voz,
  para que el micrófono del teléfono las capte y se ejercite el dictado REAL en device.

.DESCRIPTION
  PARA QUÉ EXISTE
  La receta `docs/copiloto-emprendedor/2026-11-05-RECETA-una-sola-sentada-de-voz-y-device.md`
  estaba declarada como «hace falta la voz del operador». NO hace falta: este camino ya se
  ejerció y quedó acreditado el 2026-08-04, en el cierre de BETA-1a por backend —
  `coordinacion/cerrado/2026-08-04/2026-08-04_listo_frontend-a-backend_e2e-BETA1a-feedback-texto-y-voz.md`:

      «Grabé el mic mientras reproducía por los parlantes de la PC (TTS real, Windows SAPI,
       voz Microsoft Helena Desktop) ... el mic del device la captó de verdad»

  Y el STT devolvió la transcripción correcta. O sea: el camino es el de PRODUCCIÓN (aire →
  mic del device → STT real), no un mock ni una inyección por la API.

  🔴 EL MODO DE FALLA QUE ESE MISMO PRECEDENTE DOCUMENTÓ — y es la razón del canario
  Dos intentos de aquella corrida NO valieron, y uno es peligroso:
    · con música de fondo el STT devolvió "Música Música Música Música" — ruido evidente;
    · **con SILENCIO, Whisper ALUCINÓ «¡Gracias!»** — una transcripción PLAUSIBLE.
  Lo segundo es un FALSO VERDE: si el audio no llega al teléfono (salida por defecto puesta en
  auriculares USB, volumen al mínimo, teléfono lejos), la pantalla igual muestra texto y la
  corrida «anda». Por eso el canario de abajo NO es opcional: es el control positivo de lo que
  falla callado.

  🔊 ESTA PC TIENE DOS SALIDAS DE AUDIO (medido 2026-11-05: «Realtek High Definition Audio» y
  «Dispositivo de audio USB»). Si la de por defecto no es la de los parlantes que el teléfono
  oye, el canario es exactamente lo que lo destapa. Un canario que habla ⇒ la corrida entera
  queda invalidada, no «hay que subir el volumen».

.PARAMETER Frase
  Clave del catálogo: A, B, C1, C2. Las cuatro son textuales de la receta — NO se editan acá:
  la receta es del operador, y cambiar la frase cambia lo que se mide.

.PARAMETER Canario
  No dice NADA: deja N segundos de silencio deliberado. Corré ESTO PRIMERO, con la app grabando.
  · Si la app transcribe algo ⇒ el STT está alucinando: ninguna corrida posterior acredita nada.
  · Si la app no transcribe nada (o da error de audio vacío) ⇒ el instrumento discrimina, seguí.

.PARAMETER Async
  Devuelve el control de inmediato y sigue hablando de fondo. Es lo que hace falta para el
  bloque A de la receta, donde hay que MANTENER apretado el mic (`adb input motionevent` DOWN)
  mientras suena el audio, y recién después soltar (UP).

.PARAMETER DelayMs
  Espera antes de empezar a hablar. Sirve para lanzar el audio primero y hacer el gesto después,
  sin depender de reflejos.

.EXAMPLE
  # 0. canario OBLIGATORIO, con la app grabando
  .\scripts\voz-device-tts.ps1 -Canario

.EXAMPLE
  # bloque A: gesto sostenido en el teléfono mientras el audio suena
  .\scripts\voz-device-tts.ps1 -Frase A -Async -DelayMs 700
  # ...y en paralelo, el dueño del device hace DOWN / espera / UP con motionevent

.NOTES
  Idempotente: no escribe estado ni archivos. Falla CERRADO si no hay voz en español —
  una voz inglesa leyendo «Pagué quince mil de mercadería» produce fonética basura y el STT
  español la rechaza, lo que daría un rojo FALSO (defecto del instrumento leído como defecto
  de la app).

  ⚠️ NO toca el teléfono y no invoca adb a propósito: el device tiene DUEÑO ÚNICO y dos
  sesiones de ADB fabrican evidencia mezclada. Este script es sólo el lado del audio; los
  gestos los hace quien tiene el device, que es el único que conoce las coordenadas reales.
#>
[CmdletBinding()]
param(
  [ValidateSet('A', 'B', 'C1', 'C2')]
  [string]$Frase,
  [switch]$Canario,
  [switch]$Listar,
  [switch]$Async,
  [int]$DelayMs = 0,
  [int]$CanarioSegundos = 5,
  [int]$Velocidad = -1
)

$ErrorActionPreference = 'Stop'

# Textuales de la receta (2026-11-05-RECETA-una-sola-sentada-de-voz-y-device.md). No editar.
$CATALOGO = [ordered]@{
  'A'  = @{ texto = 'Pagué quince mil de mercadería ayer'
            bloque = 'A — dictado de gasto (chat / Mi día / Gastos)' }
  'B'  = @{ texto = 'Facturale a Cliente Seed Mi Dia un servicio por cinco mil pesos'
            bloque = 'B — factura prellenada; NADA se emite' }
  'C1' = @{ texto = 'una factura'
            bloque = 'C paso 1 — incompleta: espera PREGUNTA, sin card' }
  'C2' = @{ texto = 'a Cliente Seed Mi Dia por cinco mil'
            bloque = 'C paso 2 — misma conversación: espera la CARD' }
}

if ($Listar) {
  "CATÁLOGO (textual de la receta):"
  foreach ($k in $CATALOGO.Keys) {
    "  -Frase {0,-3} | {1}" -f $k, $CATALOGO[$k].bloque
    "      «{0}»" -f $CATALOGO[$k].texto
  }
  ""
  "  -Canario    | SILENCIO deliberado ($CanarioSegundos s). Corré esto PRIMERO."
  exit 0
}

if (-not $Canario -and -not $Frase) {
  Write-Error "Pasá -Frase <A|B|C1|C2>, o -Canario, o -Listar. El canario va PRIMERO."
  exit 2
}

Add-Type -AssemblyName System.Speech
$voces = (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() |
  Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq 'es' }

if (-not $voces) {
  Write-Error @"
FALLA CERRADA: no hay ninguna voz TTS en español habilitada en esta máquina.

NO se cae a una voz inglesa a propósito. Una voz en-US leyendo «Pagué quince mil de mercadería»
produce fonética que el STT español no reconoce, y eso daría un ROJO FALSO: parecería que el
dictado de la app está roto cuando lo que está mal es el instrumento.

Instalá una voz es-* (Configuración → Hora e idioma → Voz) y volvé a correr.
"@
  exit 3
}

$voz = ($voces | Where-Object { $_.VoiceInfo.Name -eq 'Microsoft Helena Desktop' } |
        Select-Object -First 1)
if (-not $voz) { $voz = $voces | Select-Object -First 1 }

$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice($voz.VoiceInfo.Name)
$s.Rate = $Velocidad
$s.SetOutputToDefaultAudioDevice()

# Procedencia: que la evidencia diga con qué se midió, no «se dictó la frase».
"voz      : {0} ({1})" -f $voz.VoiceInfo.Name, $voz.VoiceInfo.Culture
"velocidad: {0}" -f $Velocidad
"salida   : dispositivo de audio POR DEFECTO de Windows"
"           (esta PC tiene DOS salidas; si la default no es la que el teléfono oye,"
"            el canario lo destapa y la corrida NO vale)"

if ($Canario) {
  ""
  "=== CANARIO — SILENCIO DELIBERADO, $CanarioSegundos s ==="
  "Poné la app a grabar AHORA y soltá al terminar la cuenta."
  ""
  "LECTURA del resultado:"
  "  app transcribe ALGO  -> el STT ALUCINA. Ninguna corrida posterior acredita nada."
  "                          (el 2026-08-04 el silencio dio «¡Gracias!»)"
  "  app NO transcribe    -> el instrumento DISCRIMINA. Seguí con -Frase."
  ""
  for ($i = $CanarioSegundos; $i -gt 0; $i--) {
    Write-Host ("  silencio... {0}" -f $i)
    Start-Sleep -Seconds 1
  }
  "=== fin del canario (no se emitió ningún sonido) ==="
  $s.Dispose()
  exit 0
}

$item = $CATALOGO[$Frase]
""
"bloque   : {0}" -f $item.bloque
"frase    : «{0}»" -f $item.texto
""

if ($DelayMs -gt 0) {
  "esperando {0} ms antes de hablar (hacé el gesto ahora)..." -f $DelayMs
  Start-Sleep -Milliseconds $DelayMs
}

if ($Async) {
  "hablando en SEGUNDO PLANO: mantené el gesto y soltá cuando termine el audio."
  $s.SpeakAsync($item.texto) | Out-Null
  while ($s.State -ne 'Ready') { Start-Sleep -Milliseconds 100 }
  "audio terminado."
} else {
  "hablando..."
  $s.Speak($item.texto)
  "audio terminado."
}

$s.Dispose()
