---
name: iterar-en-device-es-metro-local-con-dev-client-ya-instalado
description: REGLA DURA (confirmada por el operador 2026-07-23) — para iterar en el device NO se compila nada. El dev-client (la app) YA está instalado en el teléfono; se recarga el JS desde un Metro LOCAL por USB (`expo start` + `adb reverse`). NUNCA `expo run:android` ni build EAS nube para iterar. La nube/build nativo es solo "para el final" y ocasional
metadata:
  type: feedback
---

**Cómo se trabaja el device en este proyecto (confirmado por el operador 2026-07-23):**

1. **El dev-client (la app-shell nativa) YA está instalado en el teléfono.** Se buildeó una vez (nube/EAS
   o en una máquina con toolchain, ocasional, "para el final"). NO se rebuildeá para iterar.
2. **Iterar = Metro LOCAL + recarga de JS por USB.** `cd apps/mobile && npx expo start --dev-client`
   (o `--dev-client` ya está en el script `start`) + `adb reverse tcp:8081 tcp:8081`. Se edita JS/TS, se
   recarga en el dev-client — **sin recompilar nativo**.
3. **Para conectar el dev-client, entrar la URL a mano `localhost:8081`** (o deep-link directo), **NO** ir
   a la lista "Development Servers" ligada a la cuenta EAS — esa pantalla pega el **ANR upstream de Expo
   dev-launcher** (bug conocido, sin fix publicado). El bypass que funcionó: modo avión ON → `adb reverse`
   → Connect a `localhost:8081` → avión OFF (el fetch de cuenta falla rápido sin red, el bundle por USB
   llega igual).

**Lo que NO es la metodología (errores ya cometidos y pagados):**
- ❌ `expo run:android` / build nativo LOCAL: **esta PC no tiene toolchain Android** (sin `ANDROID_HOME`,
  sin `java`/`gradle`/SDK — medido por backend Y frontend, 2026-07-23). documed **tampoco** compila acá.
- ❌ **Build EAS en la NUBE para iterar:** cuenta tier free = **cola de HORAS** (un build previo tardó
  4h 36min). La nube es solo para producir el dev-client/release ocasionalmente, "para el final".

**Why:** el 2026-07-23, con el dev-client flaky por el ANR upstream, adiviné DOS caminos equivocados sin
verificar —primero el APK de EAS en la nube (cola de horas), después `expo run:android` local (toolchain
inexistente en esta PC)— y frené ~1h. El operador lo dijo desde el principio: *"siempre nos hemos manejado
en local"*, y "local" acá significa **Metro local + recarga de JS**, NO compilar nativo. Adiviné en vez de
preguntar cómo era el flujo real. [[no-codificar-la-esperanza-principio-raiz]]
[[consultar-documed-siempre-antes-de-implementar]] [[verificar-la-composicion-root-no-el-default]]

**How to apply:** para cargar/probar en el device, el default es **Metro local + el dev-client ya
instalado** (`expo start` + `adb reverse`, conectar por `localhost:8081` directo). Si el dev-client no
está instalado o quedó incompatible y hay que rebuildearlo, eso es **MAYOR** (necesita toolchain en alguna
máquina o build EAS que tarda horas) → se pregunta, NO se asume ni se dispara para "iterar". Antes de
proponer cualquier camino de device: verificar el `package.json` de `apps/mobile` Y preguntar el flujo si
hay duda — no adivinar. [[build-local-por-usb-es-la-metodologia-nunca-la-nube-para-iterar]] quedó RETIRADA
(decía `expo run:android`, era falso).
