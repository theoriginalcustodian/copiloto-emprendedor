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
  No dice NADA: deja N segundos de silencio deliberado, con la app grabando.

  🔴 CORREGIDO 2026-11-05, DESPUÉS DE LA PRIMERA CORRIDA — este canario NO sirve en una pantalla
  con flujo propio, y la culpa es del canario, no de quien lo corrió.

  Corrido en el dock de Facturación (frontend1, APK `7d278a2c`, usuario canónico), la app contestó
  «¿Qué producto o servicio querés facturar?» y el veredicto fue «el STT alucina». **Ese veredicto
  no está atribuido.** Medido en el código: `PantallaFacturacion.tsx:596` llama `dictado.dictar(texto)`
  SIN guard de texto vacío, y `useDictadoFactura.ts:76-78` pinta la pregunta del agente cuando la
  respuesta viene `sin_propuesta / respuesta_sin_card`. Entonces DOS causas suficientes producen
  exactamente la misma pantalla:

    A. el STT alucinó texto (el «¡Gracias!» del 04-08), o
    B. la transcripción vino VACÍA y el flujo de factura preguntó igual, por falta de guard.

  Un test con dos causas suficientes no atribuye: no distingue «el instrumento no discrimina» de
  «el instrumento discrimina perfecto y la app no tiene guard de dictado vacío».

  ⇒ **El canario de aire va en el CHAT GENERAL**, donde una transcripción vacía no tiene un flujo
  que la rescate y la respuesta del agente delata el contenido. Y para aislar al STT de verdad no
  hace falta el teléfono: ver `-SilencioWav`.

.PARAMETER SilencioWav
  Escribe un WAV de silencio PCM válido (16 kHz, mono, 16-bit — lo que Whisper espera) en la ruta
  dada, para mandarlo DIRECTO a `POST /transcribir` y leer la transcripción CRUDA.

  Esto es el control que separa las dos variables que el canario de aire mezcla:
    · ¿el STT alucina con silencio?  -> este WAV contra el endpoint. Sin device, sin aire, determinista.
    · ¿el audio llega por el aire?   -> el canario en el chat general, con el teléfono.
  Mezcladas, ninguna de las dos se puede concluir.

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
  [string]$SilencioWav,
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
  "  -Canario              | canario de AIRE: silencio deliberado ($CanarioSegundos s)."
  "                          Va en el CHAT GENERAL, no en un dock de formulario."
  "  -SilencioWav <ruta>   | WAV de silencio para POST /transcribir: aísla al STT,"
  "                          sin device y sin aire. Es el control que ATRIBUYE."
  exit 0
}

if ($SilencioWav) {
  # WAV PCM de silencio: header RIFF + muestras en cero. 16 kHz, mono, 16-bit.
  # No usa TTS (hablar "nada" no produce archivo) y no necesita el teléfono: su destino es
  # POST /transcribir, para leer la transcripción CRUDA del STT ante silencio puro.
  $hz = 16000; $canales = 1; $bits = 16
  $muestras = $hz * $CanarioSegundos
  $bytesData = $muestras * $canales * ($bits / 8)
  $byteRate = $hz * $canales * ($bits / 8)
  $ms = New-Object System.IO.MemoryStream
  $w = New-Object System.IO.BinaryWriter($ms)
  $w.Write([char[]]'RIFF'); $w.Write([int](36 + $bytesData)); $w.Write([char[]]'WAVE')
  $w.Write([char[]]'fmt '); $w.Write([int]16); $w.Write([int16]1)
  $w.Write([int16]$canales); $w.Write([int]$hz); $w.Write([int]$byteRate)
  $w.Write([int16]($canales * ($bits / 8))); $w.Write([int16]$bits)
  $w.Write([char[]]'data'); $w.Write([int]$bytesData)
  $w.Write((New-Object byte[] $bytesData))   # el silencio: ceros
  $w.Flush()
  [IO.File]::WriteAllBytes($SilencioWav, $ms.ToArray())
  $w.Dispose(); $ms.Dispose()

  "WAV de silencio escrito: {0}" -f $SilencioWav
  "  {0} s · {1} Hz · mono · {2}-bit PCM · {3} bytes" -f $CanarioSegundos, $hz, $bits, (Get-Item $SilencioWav).Length
  ""
  "PARA QUÉ: mandalo a POST /transcribir y mirá la transcripción CRUDA."
  "  devuelve texto  -> el STT ALUCINA con silencio. Es un defecto del STT, medido sin device."
  "  devuelve vacío  -> el STT discrimina; entonces lo que haya pasado en pantalla es de la APP,"
  "                     no del STT (p.ej. falta de guard de dictado vacío)."
  ""
  "Esto NO reemplaza al canario de aire: éste mide al STT, aquél mide si el audio LLEGA."
  exit 0
}

if (-not $Canario -and -not $Frase) {
  Write-Error "Pasá -Frase <A|B|C1|C2>, -Canario, -SilencioWav <ruta>, o -Listar."
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
  "=== CANARIO DE AIRE — SILENCIO DELIBERADO, $CanarioSegundos s ==="
  ""
  "🔴 CORRELO EN EL CHAT GENERAL, NO EN UN DOCK DE FORMULARIO."
  "   En el dock de Facturación este canario NO atribuye: medido en código,"
  "   PantallaFacturacion.tsx:596 dicta SIN guard de texto vacío, así que una"
  "   transcripción vacía y una alucinada dan la MISMA pantalla («¿Qué producto"
  "   o servicio querés facturar?»). Dos causas suficientes, cero atribución."
  ""
  "Poné la app a grabar AHORA, en el chat, y soltá al terminar la cuenta."
  ""
  "LECTURA — MEDIDA el 2026-11-05 por backend, ya no es conjetura:"
  ""
  "   El STT ALUCINA con silencio, y lo hace con FIRMA ESTABLE: un WAV de silencio"
  "   puro contra POST /transcribir devolvió «Gracias.» en 6 de 6 corridas (contextos"
  "   factura y gasto, 3 cada uno). Es el mismo «¡Gracias!» del 2026-08-04."
  "   El guard NO existe: web.py:955-959 rechaza sólo el audio VACÍO; stt.py:87 pide"
  "   response_format=json, sin no_speech_prob ni umbral de energía."
  ""
  "   ⇒ Eso vuelve a este canario USABLE sin esperar ningún fix, porque la"
  "     alucinación tiene una huella reconocible:"
  ""
  "       transcripción = «Gracias.» (o similar)  -> NO LLEGÓ AUDIO. La corrida NO vale."
  "       transcripción = la frase que emití      -> el aire funciona. Seguí."
  ""
  "   ⚠️ POR ESO HACE FALTA VER LA TRANSCRIPCIÓN CRUDA, no la reacción del agente:"
  "      «Gracias.» metido en un dock de factura produce «¿Qué producto querés"
  "      facturar?», que es indistinguible de un dictado incompleto legítimo."
  "      En el chat general el texto dictado se ve; en el dock no."
  ""
  "Para saber si la culpa es del STT o de la app, el control que lo separa es"
  "-SilencioWav contra POST /transcribir: ahí se lee la transcripción CRUDA, sin device."
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
