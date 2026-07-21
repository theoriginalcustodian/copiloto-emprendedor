---
name: arranque-device-metro-disable-hierarchical-lookup
description: "La app Expo no arrancaba en device (core init 'Global was not installed') por metro disableHierarchicalLookup=true — no era versiones"
metadata:
  node_type: memory
  type: project
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-21T03:04:40.173Z
---

**Sprint mobile, 2026-07-21.** La app nativa (`apps/mobile`) **nunca arrancaba** en el SM-A217M:
pantalla roja `[runtime not ready] Cannot read property 'default' of undefined` en
`setUpDefaultReactNativeEnvironment` + `AppRegistryBinding::startSurface failed. Global was not
installed` — **antes** de correr una línea de la app. Los tests jest pasaban verdes igual (jsdom no
ejerce el runtime nativo, ver [[gate-jsdom-no-ve-gestos-tactiles]]).

**Causa raíz:** `apps/mobile/metro.config.js` tenía `resolver.disableHierarchicalLookup = true`
(lo puso el scaffold S4 "para evitar dos Reacts"). Con la estructura de node_modules de ESTE
workspace, ese flag dejaba un módulo del core init de RN sin resolver → Metro devolvía `undefined`
→ `.default` petaba. **Lo cazó `npx expo-doctor@latest`**: *"disableHierarchicalLookup mismatch,
expected false"*. Fix: `false` (el default de expo/metro-config, que ya maneja el monorepo vía
`nodeModulesPaths`). Commit `d161a0e`.

**Why (la parte cara):** perseguí ~6 hipótesis falsas antes del dato. El error `Global was not
installed` **suena** a Reanimated/Worklets, y las versiones diferían de documed (worklets 0.10.0 vs
0.10.2, etc.), así que gasté rato alineándolas — **no era eso**. La trampa: un mensaje de runtime que
nombra un síntoma (`Global`) muy lejos de la causa (un flag de resolución de Metro).

**How to apply — el orden que SÍ funcionó (para no repetir el pozo):**
1. **`npx expo-doctor@latest` PRIMERO** ante cualquier "no arranca en device". Da el diagnóstico
   oficial de config/deps en un comando. Es la herramienta canónica; usarla antes de teorizar.
2. **Test diferencial binario-vs-bundle:** apuntá TU dev-client (deep link
   `<scheme>://expo-development-client/?url=http://localhost:<puerto-de-otro-metro>`) al Metro de una
   app que SÍ arranca (documed en 8081). Si su bundle arranca en tu binario → tu binario está sano y
   el bug es tu bundle/config. Cortó el espacio de búsqueda a la mitad.
3. **Hello-world mínimo** (un `<Text>`, cero imports de app) servido a tu binario: si falla igual, el
   bug NO es tu cáscara ni tu dominio — es la config base del bundle. Aísla app-code de toolchain.
4. Las versiones de reanimated/worklets del **JS deben coincidir con las compiladas en el binario**
   (APK). Bumpear el JS sin rebuild las desalinea y crashea al usar worklets (el hello-world no las
   usa, por eso arrancaba; la app real sí). Mantener las que espera el SDK.

**Gotchas de instrumentación en device que costaron tiempo:**
- El screencap captura la app en **foreground**, que puede ser la de OTRA sesión (documed corría en
  el mismo teléfono). Verificar con `adb shell dumpsys window | grep mCurrentFocus` antes de creerle
  a una captura.
- El dev-client **cachea** el último bundle; `adb shell pm clear <pkg>` fuerza descarga fresca.

[[no-codificar-la-esperanza-principio-raiz]] · [[vacio-no-es-hallazgo-correr-el-control]] · [[copiloto-mobile-first-cascara-glass]]
