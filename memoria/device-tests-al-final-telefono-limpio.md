---
name: device-tests-al-final-telefono-limpio
description: "LEVANTADA el 2026-10-13: el operador habilitó el device («está conectado y disponible, lo que vaya en device se puede hacer cuando quieras»). El diferimiento al «sprint siguiente» (2026-09-22) apuntaba al sprint que cerró el 2026-10-08 — ya venció. Medido: dev-client instalado, NO hace falta rebuild"
metadata: 
  node_type: memory
  type: project
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-09-21T22:23:37.724Z
---

> 🔴 **LEVANTADA — 2026-10-13.** Lo de abajo es HISTORIA, no la regla vigente. El operador habilitó
> el device: *«el device está conectado y disponible… lo que sea que vaya en device se puede hacer
> cuando quieras»*. **Y el diferimiento ya estaba vencido antes de eso:** decía «sprint siguiente» y
> ese sprint cerró el **2026-10-08** (DEC-14), así que durante días la orden apuntó a un sprint que ya
> era el actual. Una orden que nombra un sprint relativo no tiene vencimiento y se sigue leyendo como
> vigente — la misma clase que [[un-umbral-calibrado-al-corpus-del-dia-envejece-con-el]]. Costó que el
> operador preguntara «¿cuánto avanzamos en el sprint mobile?» y recibiera la cifra de **web**.
>
> **Lo medido el 2026-10-13 que además refuta el supuesto de fondo de este archivo:**
> - El teléfono **ya NO está limpio**. `app.copiloto.emprendedor` está instalado en `RF8T318RN9T`
>   (`SM_M127F`) con `expo-dev-launcher` ⇒ **es un dev-client**. Instalado **2026-10-11 17:53:50**,
>   `firstInstall == lastUpdate`. El `cierre_` de frontend1 del 10-08 midió «sólo Expo Go» y era cierto
>   entonces: el dev-client entró 3 días después.
> - ✅ **NO hace falta rebuild ni EAS.** De los 8 commits a `apps/mobile`/`packages/core` posteriores al
>   binario, **0** tocan superficie nativa. Control de ceguera: de 6 paths, 3 no existen (es CNG,
>   `android/` se genera) y los 3 reales (`app.json`, `package.json`, `eas.json`) tienen su último
>   cambio el **2026-09-17**, anterior al binario. Control positivo: esos 3 tienen 5, 9 y 1 commits de
>   historia ⇒ el «0» es una medición, no un silencio.
>   ⚠️ **Corrección de FRONTEND2 (mismo día), y cambia el signo:** ese «2026-09-17» es cierto **de
>   `main`**, pero el binario **no salió de `main`** — salió de `5e19949f` (11/10 17:22, 40 min antes de
>   la instalación), que toca `apps/mobile/app.json` y **no está en main ni tenía rama en `origin`**.
>   O sea: la superficie nativa del binario es un **superconjunto** de la de main (íconos adaptativos,
>   splash con imagen, `android.permission.CAMERA`). La conclusión «no hace falta rebuild para correr el
>   JS de main» **sobrevive** —el binario tiene más, no menos—, pero el riesgo real es el inverso del que
>   escribí: **un build desde `main` HOY pierde esos 5 assets y el permiso de cámara.** Yo medí la
>   historia de main y la leí como si fuera la del binario:
>   [[el-instrumento-respondio-sobre-otro-sujeto]]. El JS llega por **Metro local por USB**, así que
>   [[iterar-en-device-es-metro-local-con-dev-client-ya-instalado]] **ya aplica tal cual**: su supuesto
>   («dev-client ya instalado») hoy se cumple.
> - 🔴 **La mitad que SIGUE EN PIE:** el binario **no declara SHA** (`versionName=0.1.0`,
>   `versionCode=1`, estáticos). Ningún «probado en device» **anterior** sabe contra qué código se
>   probó. Toda evidencia nueva cita **el SHA que Metro sirve**, no el del binario.
>
> **Dueño del device hoy: frontend2** (fila `DEVICE15`, las 15 `nativa-con-device`), con dueño ÚNICO —
> dos ADB fabrican evidencia falsa y el device ESCRIBE en la base
> ([[device-fisico-exige-dueno-unico]], [[usuario-de-prueba-canonico-uno-solo-a-fuego]]).
> ⚠️ **Matiz honesto, por si el operador quiere corregirlo:** este archivo registraba que **BACKEND**
> era dueña de las tandas de device (corrección del operador 2026-09-21, plan §5.6). La puesta a punto
> —lo que esa corrección cubría— **ya está hecha**, y backend declaró hoy por buzón que `apps/mobile`
> no es suyo. Las 15 filas son de frontend por el doc de contratos del mapeo. Si el operador quiere a
> backend como dueña de las tandas igual, manda él.
Orden del operador (2026-09-21, ~22:30): el teléfono **ya está conectado a la PC**, pero es un
**Android recién instalado, limpio**: no tiene dev-client ni nada. Antes de probar hay que montar
Metro y todo lo necesario, y después instalar la app.

**Las pruebas en el teléfono se hacen AL FINAL, cuando termine toda la implementación.** Hasta
entonces **no se baja ningún contrato ni pedido sobre el teléfono a ninguna sesión**.

**Why:** el operador prefiere terminar de programar todo y hacer una sola tanda de pruebas en el
teléfono, no intercalarlas.

**How to apply:**
- Las filas táctiles quedan en CIERRA_SALVO_DEVICE sin reclamo; no son bloqueo mientras se programa.
- Los `pedido_…device…` que ya están en `en-curso/` se dejan quietos: no se re-empujan ni se escalan.
- Disparador para arrancar: cola de implementación vacía (Cierre A salvo device). Ahí
  planificación le baja a **BACKEND** el contrato de puesta a punto del teléfono. **Planificación
  NO prepara el teléfono** (corrección del operador, 2026-09-21): lo prepara BACKEND, dueña de las
  tandas de device (plan §5.6). Hay que montar dev-client + Metro por USB desde cero: la memoria
  [[iterar-en-device-es-metro-local-con-dev-client-ya-instalado]] asume un dev-client ya
  instalado, y acá no lo hay. Recién con el teléfono listo se baja la tanda de pruebas.
- Usuario de prueba: [[usuario-de-prueba-canonico-uno-solo-a-fuego]].

**Actualización 2026-09-22 (después del corte de luz):** el operador decidió que **todo lo relativo al móvil pasa
al sprint siguiente**. Este sprint **se cierra sin device**: las filas `PENDIENTE_DEVICE` no lo bloquean, y ⚠️ **VENCIDO — ESE SPRINT ES ESTE (13-10, `DEC-21`).** — lo de abajo describe el sprint que cerró el 08/10; HOY device está DENTRO del alcance y esas filas SÍ se miden. Sigue leyendo el párrafo como registro, no como regla vigente:
la puesta a punto del teléfono (que hace BACKEND) ya no es el último paso de este sprint sino el primero del
próximo. Los crones de las sesiones se apagan **al terminar la implementación**, por mensaje directo.
