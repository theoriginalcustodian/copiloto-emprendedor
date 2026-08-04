# Receta E2E device — BETA-1a feedback in-app (texto + voz)

> Preparada mientras se espera el endpoint backend (`POST /feedback` / `/feedback/audio`,
> contrato `coordinacion/abierto/2026-08-04_contrato_planificacion-a-todos_BETA1a-feedback-
> endpoint.md`). UI ya mergeada (PR#221, `9404c52`) — esta receta queda lista para correr apenas
> el endpoint esté desplegado, sin depender de ventana viva (patrón `gate-de-device-se-corre-con-
> receta-no-con-ventana-viva`). Usuario canónico: `e2e-device@copiloto.test`.

## Pre-condición

- Backend confirmó `POST /feedback` + `POST /feedback/audio` desplegados en prod (buzón:
  `avance_`/`listo_` de backend sobre este contrato).
- Dev-client ya instalado en el SM-A217M, Metro local por USB (sin rebuild — ver
  `iterar-en-device-es-metro-local-con-dev-client-ya-instalado`).

## Camino 1 — texto

1. Abrir la app, loguear con `e2e-device@copiloto.test`.
2. Ir a **Mi cuenta** → fila **Feedback** (`testID="cuenta-feedback"`, ícono mic, subtítulo
   "Contanos qué mejorarías, por texto o por voz.").
3. En la pantalla **Feedback** (`testID="pantalla-feedback"`), escribir texto en el campo
   "Tu feedback" (`testID="feedback-texto"`) — ej. `"prueba E2E device — texto"`.
4. Tocar **Enviar** (`testID="feedback-texto-enviar"`).
5. **Esperado:** botón pasa a "Enviando…", después aparece
   `testID="feedback-texto-confirmado"` → "¡Gracias! Guardamos tu feedback." y el campo se vacía.
6. **Verificar en DB** (SQL directo, sin UI admin — así quedó definido en el contrato §2):
   ```sql
   select id, tipo, texto, contexto, created_at
   from uc_factory.copiloto_feedback
   where cliente_id = (select id from ... where email = 'e2e-device@copiloto.test')
   order by created_at desc limit 1;
   ```
   Esperado: `tipo='texto'`, `texto` = lo tipeado, `contexto='Mi cuenta'`.

## Camino 2 — voz (transcripción REAL, no mock de STT)

1. Desde la misma pantalla, tocar el botón de mic (`testID="feedback-mic"`) — arranca a grabar.
2. Decir una frase corta y clara (ej. "esto es una prueba de feedback por voz").
3. Tocar de nuevo el mic para detener y enviar (label cambia a "Detener grabación y enviar";
   mientras graba muestra "Grabando… Ns — tocá de nuevo para enviar").
4. **Esperado:** "Enviando…" → `testID="feedback-audio-confirmado"` → `Guardamos: "<transcripción>"`.
   La transcripción debe corresponder razonablemente a lo dicho (Groq STT real).
5. **Verificar en DB:** mismo query que arriba, última fila con `tipo='voz'`, `texto` = la
   transcripción mostrada en pantalla (deben coincidir — la respuesta HTTP y lo persistido usan
   el mismo valor, contrato §1).

## Casos de error a probar (cubiertos por el contrato, no opcionales)

| Caso | Cómo forzarlo | Esperado |
|---|---|---|
| Texto vacío | Enviar con el campo vacío | Botón deshabilitado (`puedeEnviarTexto` en falso) — no llega a pegarle al backend |
| Texto >2000 chars | Pegar texto largo | 422 backend → `feedback-texto-error` con el `detail` tal cual vino ("feedback demasiado largo…") |
| Grabación sin audio útil | Tocar mic y soltar casi inmediato | El propio hook descarta (`voz.tomar()` retorna null) — no se llega a enviar nada |
| Audio vacío/silencio | Grabar solo silencio | 422 del backend → `feedback-audio-error` |
| STT no configurado / error del servicio | (si aplica en el ambiente) | 503/502 → `feedback-audio-error` con mensaje |

## DoD (contrato §4, verbatim)

Usuario envía feedback por voz Y por texto desde la app → ambos quedan en `copiloto_feedback`,
consultables por SQL → E2E en device con `e2e-device@copiloto.test`, los dos caminos, incluida la
transcripción real de un audio real (no un mock de STT). **Esta receta cubre ambos caminos.**
